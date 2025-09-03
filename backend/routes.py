from flask import Blueprint, jsonify, request
from services import (
    fetch_calgary_buildings_geojson, 
    get_available_target_areas,
    get_buildings_for_zone,
    get_buildings_for_target_area,
    get_buildings_within_bbox,
    TARGET_AREAS,
    BUILDING_ZONES
)
from project_services import (
    create_user, save_project, get_user_projects, 
    get_project, delete_project, get_all_users
)
from llm_service import llm_service

bp = Blueprint("api", __name__, url_prefix="/api")

@bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@bp.get("/target-areas")
def get_target_areas():
    """Get available target areas for building data"""
    return jsonify({
        "areas": TARGET_AREAS,
        "message": "Available target areas for building data"
    })

@bp.get("/building-zones")
def get_building_zones():
    """Get available building zones for better performance"""
    return jsonify({
        "zones": BUILDING_ZONES,
        "message": "Available building zones for optimized rendering"
    })

@bp.get("/buildings")
def get_buildings():
    """Get building data for a specific target area or bounding box"""
    try:
        # Get parameters
        target_area = request.args.get('target_area')
        bbox = request.args.get('bbox')
        zone = request.args.get('zone')  # New zone parameter
        
        if zone:
            # Get buildings for specific zone
            if zone not in [zone_id for district in BUILDING_ZONES.values() for zone_id in district['zones'].keys()]:
                return jsonify({"error": f"Invalid zone: {zone}"}), 400
            
            # Find the zone data
            zone_data = None
            for district in BUILDING_ZONES.values():
                if zone in district['zones']:
                    zone_data = district['zones'][zone]
                    break
            
            if not zone_data:
                return jsonify({"error": f"Zone data not found: {zone}"}), 400
            
            # Get buildings for this specific zone
            buildings = get_buildings_for_zone(zone_data['bbox'])
            return jsonify({
                "buildings": buildings,
                "zone": zone_data,
                "total": len(buildings),
                "message": f"Buildings for {zone_data['name']}"
            })
        
        elif target_area:
            # Get buildings for target area (existing functionality)
            if target_area not in TARGET_AREAS:
                return jsonify({"error": f"Invalid target area: {target_area}"}), 400
            
            buildings = get_buildings_for_target_area(target_area)
            return jsonify({
                "buildings": buildings,
                "area": TARGET_AREAS[target_area],
                "total": len(buildings),
                "message": f"Buildings for {TARGET_AREAS[target_area]['name']}"
            })
        
        elif bbox:
            # Get buildings within bounding box (existing functionality)
            try:
                bbox_coords = [float(x) for x in bbox.split(',')]
                if len(bbox_coords) != 4:
                    return jsonify({"error": "Bbox must have 4 coordinates: min_lng,min_lat,max_lng,max_lat"}), 400
                
                buildings = get_buildings_within_bbox(bbox_coords)
                return jsonify({
                    "buildings": buildings,
                    "bbox": bbox_coords,
                    "total": len(buildings),
                    "message": f"Buildings within bounding box"
                })
            except ValueError:
                return jsonify({"error": "Invalid bbox coordinates"}), 400
        
        else:
            return jsonify({"error": "Must provide either 'zone', 'target_area', or 'bbox' parameter"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Failed to get buildings: {str(e)}"}), 500


# Project Management Endpoints

@bp.post("/users")
def create_new_user():
    """Create a new user with username."""
    data = request.get_json()
    if not data or "username" not in data:
        return jsonify({"error": "Username is required"}), 400
    
    username = data["username"].strip()
    if not username:
        return jsonify({"error": "Username cannot be empty"}), 400
    
    result = create_user(username)
    if result["success"]:
        return jsonify(result), 201
    else:
        return jsonify(result), 400


@bp.get("/users")
def list_users():
    """List all users (for admin/debug purposes)."""
    result = get_all_users()
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 500


@bp.post("/projects")
def create_new_project():
    """Save a new project with filters."""
    data = request.get_json()
    if not data or "username" not in data:
        return jsonify({"error": "Username is required"}), 400
    
    username = data["username"]
    project_name = data.get("project_name")
    description = data.get("description")
    target_area = data.get("target_area")
    total_buildings = data.get("total_buildings")
    filters = data.get("filters", [])
    
    result = save_project(
        username=username,
        project_name=project_name,
        description=description,
        target_area=target_area,
        total_buildings=total_buildings,
        filters=filters
    )
    
    if result["success"]:
        return jsonify(result), 201
    else:
        return jsonify(result), 400


@bp.get("/projects")
def list_user_projects():
    """Get all projects for a specific user."""
    username = request.args.get("username")
    if not username:
        return jsonify({"error": "Username parameter is required"}), 400
    
    result = get_user_projects(username)
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 404


@bp.get("/projects/<int:project_id>")
def get_specific_project(project_id):
    """Get a specific project by ID."""
    result = get_project(project_id)
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 404


@bp.delete("/projects/<int:project_id>")
def remove_project(project_id):
    """Delete a project (only if user owns it)."""
    data = request.get_json()
    if not data or "username" not in data:
        return jsonify({"error": "Username is required"}), 400
    
    username = data["username"]
    result = delete_project(project_id, username)
    
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 404


# LLM Query Interpretation Endpoints

@bp.post("/interpret-query")
def interpret_natural_language_query():
    """Interpret a natural language query and return structured filter(s)."""
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Query text is required"}), 400
    
    user_query = data["query"].strip()
    if not user_query:
        return jsonify({"error": "Query cannot be empty"}), 400
    
    # Interpret the query using LLM service
    result = llm_service.interpret_query(user_query)
    
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 400


@bp.get("/available-filters")
def get_available_filter_options():
    """Get information about available filter attributes and operators."""
    return jsonify(llm_service.get_available_filters())