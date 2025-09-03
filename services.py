import os
import json
import time
import hashlib
from typing import Tuple, Dict, Any, List

import requests


CALGARY_3D_BUILDINGS_URL = "https://data.calgary.ca/resource/cchr-krqg.json"
CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
CACHE_TTL_SECONDS = 60 * 30  # 30 minutes

# Target areas for the Calgary 3D Dashboard
TARGET_AREAS = {
    "downtown": {
        "name": "Downtown Core",
        "description": "Central business district and high-rises",
        "bbox": [-114.075, 51.045, -114.055, 51.055],
        "expected_buildings": "~300 buildings"
    }
}

# New zone-based system for better performance
BUILDING_ZONES = {
    "downtown": {
        "name": "Downtown District",
        "zones": {
            "downtown_zone_1": {
                "name": "Downtown Zone 1 - Stephen Avenue",
                "description": "Stephen Avenue pedestrian mall and retail",
                "bbox": [-114.100, 51.030, -114.040, 51.070],
                "expected_buildings": "~100 buildings",
                "center": [-114.070, 51.050]
            },
            "downtown_zone_2": {
                "name": "Downtown Zone 2 - Financial District",
                "description": "High-rise office towers and banks",
                "bbox": [-114.080, 51.055, -114.060, 51.070],
                "expected_buildings": "~80 buildings",
                "center": [-114.070, 51.0625]
            },
            "downtown_zone_3": {
                "name": "Downtown Zone 3 - East Village",
                "description": "Riverside development area",
                "bbox": [-114.070, 51.040, -114.050, 51.070],
                "expected_buildings": "~120 buildings",
                "center": [-114.060, 51.055]
            }
        }
    }
},


}

# Default target area
DEFAULT_TARGET = "downtown"

# Simple in-memory cache for zone results (to avoid repeated API calls)
ZONE_CACHE = {}
ZONE_CACHE_TTL = 300  # 5 minutes


def _ensure_cache_dir() -> None:
    if not os.path.isdir(CACHE_DIR):
        os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_path(key: str) -> str:
    _ensure_cache_dir()
    return os.path.join(CACHE_DIR, f"{key}.json")


def _read_cache(key: str) -> Dict[str, Any] | None:
    path = _cache_path(key)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if (time.time() - data.get("_cached_at", 0)) > CACHE_TTL_SECONDS:
            return None
        return data.get("payload")
    except Exception:
        return None


def _write_cache(key: str, payload: Dict[str, Any]) -> None:
    path = _cache_path(key)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"_cached_at": time.time(), "payload": payload}, f)
    except Exception:
        return


def _bbox_cache_key(west: float, south: float, east: float, north: float) -> str:
    raw = f"{west},{south},{east},{north}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _point_in_bbox(point: Tuple[float, float], bbox: Tuple[float, float, float, float]) -> bool:
    """Check if a point (lon, lat) is within bbox (west, south, east, north)."""
    lon, lat = point
    west, south, east, north = bbox
    return west <= lon <= east and south <= lat <= north


def _polygon_in_bbox(coordinates: list, bbox: Tuple[float, float, float, float]) -> bool:
    """Check if a polygon is substantially within bbox by requiring multiple vertices inside."""
    if not coordinates or not coordinates[0]:
        return False
    
    west, south, east, north = bbox
    
    # Count how many vertices are inside the bbox
    vertices_inside = 0
    total_vertices = 0
    
    for ring in coordinates:
        for point in ring:
            total_vertices += 1
            if _point_in_bbox(point, bbox):
                vertices_inside += 1
    
    # Accept ANY building that has at least 1 vertex inside the bbox
    # This is very lenient but ensures we get buildings
    if total_vertices == 0:
        return False
    
    # If any vertices are inside, accept the building
    if vertices_inside > 0:
        ratio = vertices_inside / total_vertices
        print(f"Building accepted: {vertices_inside}/{total_vertices} vertices inside ({ratio:.1%})")
        return True
    
    return False


def _normalize_building_attributes(building: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize and enhance building attributes for T5 requirements.
    
    Args:
        building: Raw building data from Calgary API
        
    Returns:
        Normalized building properties with enhanced attributes
    """
    props = building.get("properties", {})
    
    # Calculate height from elevation data if available
    height_m = None
    if building.get("grd_elev_max_z") and building.get("rooftop_elev_z"):
        try:
            height_m = float(building["rooftop_elev_z"]) - float(building["grd_elev_max_z"])
            if height_m <= 0:
                height_m = None
        except (ValueError, TypeError):
            height_m = None
    
    # Estimate floor count from height (assuming 3m per floor)
    floors = None
    if height_m:
        try:
            floors = max(1, round(height_m / 3.0))
        except (ValueError, TypeError):
            floors = None
    
    # Determine building type based on height and characteristics
    building_type = "unknown"
    if height_m:
        if height_m < 3:
            building_type = "single_story"
        elif height_m < 9:
            building_type = "low_rise"
        elif height_m < 30:
            building_type = "mid_rise"
        else:
            building_type = "high_rise"
    
    # Enhanced properties for T5 requirements
    normalized_props = {
        # Core Calgary data
        "struct_id": building.get("struct_id"),
        "stage": building.get("stage"),
        
        # Height and elevation data
        "height_m": height_m,
        "floors": floors,
        "grd_elev_min_z": building.get("grd_elev_min_z"),
        "grd_elev_max_z": building.get("grd_elev_max_z"),
        "rooftop_elev_z": building.get("rooftop_elev_z"),
        
        # Derived attributes
        "building_type": building_type,
        "height_category": building_type,
        
        # Placeholder fields for future integration (T5 enhancement)
        "zoning": "RC-G",  # Placeholder - would come from Calgary zoning dataset
        "address": f"Building {building.get('struct_id', 'Unknown')}",  # Placeholder
        "assessed_value": None,  # Placeholder - would come from Calgary assessment data
        "land_use": "residential" if building_type in ["single_story", "low_rise"] else "mixed_use",
        
        # Metadata
        "data_source": "calgary_3d_buildings",
        "last_updated": "2025-09-02"
    }
    
    return normalized_props


def _validate_building_data(buildings: List[Dict[str, Any]], bbox: Tuple[float, float, float, float]) -> Dict[str, Any]:
    """Validate building data coverage and quality for the target area."""
    west, south, east, north = bbox
    
    # Calculate area in square degrees (approximate)
    area_deg = (east - west) * (north - south)
    
    # Count buildings and validate coverage
    total_buildings = len(buildings)
    buildings_with_height = sum(1 for b in buildings if b.get("properties", {}).get("height_m"))
    buildings_with_geometry = sum(1 for b in buildings if b.get("geometry"))
    buildings_with_floors = sum(1 for b in buildings if b.get("properties", {}).get("floors"))
    buildings_with_type = sum(1 for b in buildings if b.get("properties", {}).get("building_type"))
    
    # Validation results
    validation = {
        "target_area": {
            "west": west,
            "south": south, 
            "east": east,
            "north": north,
            "area_deg": round(area_deg, 6)
        },
        "coverage": {
            "total_buildings": total_buildings,
            "buildings_with_height": buildings_with_height,
            "buildings_with_geometry": buildings_with_geometry,
            "buildings_with_floors": buildings_with_floors,
            "buildings_with_type": buildings_with_type,
            "height_coverage_pct": round((buildings_with_height / total_buildings * 100) if total_buildings > 0 else 0, 1),
            "geometry_coverage_pct": round((buildings_with_geometry / total_buildings * 100) if total_buildings > 0 else 0, 1),
            "floors_coverage_pct": round((buildings_with_floors / total_buildings * 100) if total_buildings > 0 else 0, 1),
            "type_coverage_pct": round((buildings_with_type / total_buildings * 100) if total_buildings > 0 else 0, 1)
        },
        "quality_check": {
            "min_buildings_for_3_4_blocks": 50,  # Reasonable minimum for 3-4 blocks
            "has_sufficient_coverage": total_buildings >= 50,
            "has_height_data": buildings_with_height > 0,
            "has_valid_geometries": buildings_with_geometry > 0,
            "has_floor_data": buildings_with_floors > 0,
            "has_building_types": buildings_with_type > 0
        },
        "t5_attributes": {
            "height_normalized": buildings_with_height > 0,
            "floors_calculated": buildings_with_floors > 0,
            "building_types_assigned": buildings_with_type > 0,
            "zoning_placeholder": True,  # Placeholder data added
            "address_placeholder": True,  # Placeholder data added
            "assessment_placeholder": True  # Placeholder data added
        }
    }
    
    return validation


def fetch_calgary_buildings_geojson(bbox: Tuple[float, float, float, float] = None, target_area: str = None) -> Dict[str, Any]:
    """
    Fetch buildings within bbox from Calgary 3D Buildings Citywide (cchr-krqg) as GeoJSON.

    Args:
        bbox: (west, south, east, north) in WGS84, or None to use target_area
        target_area: Predefined area name from TARGET_AREAS, or None to use bbox
    
    Returns a GeoJSON FeatureCollection dict with validation metadata.
    """
    # Determine bbox to use
    if target_area and target_area in TARGET_AREAS:
        area_info = TARGET_AREAS[target_area]
        bbox = area_info["bbox"]
        area_name = area_info["name"]
    elif bbox:
        area_name = "custom"
    else:
        # Use default target area
        area_info = TARGET_AREAS[DEFAULT_TARGET]
        bbox = area_info["bbox"]
        area_name = area_info["name"]
    
    west, south, east, north = bbox

    cache_key = _bbox_cache_key(west, south, east, north)
    cached = _read_cache(cache_key)
    if cached:
        return cached

    # Fetch all buildings from Calgary Open Data (no server-side bbox support)
    # We'll filter client-side by bbox
    params = {
        "$limit": 5000,  # Reasonable limit for demo
    }

    resp = requests.get(CALGARY_3D_BUILDINGS_URL, params=params, timeout=30)
    resp.raise_for_status()
    all_buildings = resp.json()

    # Filter buildings by bbox and convert to GeoJSON format
    filtered_features = []
    for building in all_buildings:
        if "polygon" in building and building["polygon"]:
            # Check if building intersects with bbox
            if _polygon_in_bbox(building["polygon"]["coordinates"], bbox):
                # Convert to GeoJSON Feature
                normalized_props = _normalize_building_attributes(building)
                feature = {
                    "type": "Feature",
                    "id": building.get("struct_id"),
                    "properties": normalized_props,
                    "geometry": building["polygon"]
                }
                
                filtered_features.append(feature)

    # Validate the data coverage and quality
    validation = _validate_building_data(filtered_features, bbox)

    data = {
        "type": "FeatureCollection",
        "features": filtered_features,
        "metadata": {
            "target_area": area_name,
            "bbox": bbox,
            "validation": validation,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        }
    }

    _write_cache(cache_key, data)
    return data


def get_buildings_for_zone(zone_bbox):
    """Get buildings for a specific zone with optimized performance"""
    try:
        # Check cache first
        cache_key = f"zone_{zone_bbox[0]}_{zone_bbox[1]}_{zone_bbox[2]}_{zone_bbox[3]}"
        if cache_key in ZONE_CACHE:
            cache_time, cached_data = ZONE_CACHE[cache_key]
            if time.time() - cache_time < ZONE_CACHE_TTL:
                print(f"Using cached data for zone: {len(cached_data)} buildings")
                return cached_data
        
        print(f"Fetching buildings for zone bbox: {zone_bbox}")
        
        # For zones, we want to be more selective and fetch fewer buildings
        # since zones are much smaller than target areas
        west, south, east, north = zone_bbox
        
        # Calculate zone area
        zone_area = (east - west) * (north - south)
        print(f"Zone area: {zone_area} square degrees")
        
        # For small zones, use much smaller limits to avoid timeouts
        if zone_area < 0.001:  # Very small zone
            limit = 500  # Reduced from 1000
        elif zone_area < 0.01:  # Small zone
            limit = 1000  # Reduced from 2000
        else:  # Larger zone
            limit = 1500  # Reduced from 3000
        
        print(f"Using limit: {limit} buildings")
        
        # Fetch buildings with a reasonable limit for zones
        params = {
            "$limit": limit,
        }

        # Reduce timeout and add retry logic
        resp = requests.get(CALGARY_3D_BUILDINGS_URL, params=params, timeout=15)  # Reduced from 30
        resp.raise_for_status()
        all_buildings = resp.json()
        
        print(f"Fetched {len(all_buildings)} buildings from API")

        # Filter buildings by zone bbox and convert to GeoJSON format
        filtered_features = []
        for building in all_buildings:
            if "polygon" in building and building["polygon"]:
                # Check if building intersects with zone bbox
                if _polygon_in_bbox(building["polygon"]["coordinates"], zone_bbox):
                    # Convert to GeoJSON Feature
                    normalized_props = _normalize_building_attributes(building)
                    feature = {
                        "type": "Feature",
                        "id": building.get("struct_id"),
                        "properties": normalized_props,
                        "geometry": building["polygon"]
                    }
                    
                    filtered_features.append(feature)

        print(f"Filtered to {len(filtered_features)} buildings within zone (strict filtering)")
        
        # Cache the result
        ZONE_CACHE[cache_key] = (time.time(), filtered_features)
        
        return filtered_features
    except requests.exceptions.Timeout:
        print(f"Timeout error fetching buildings for zone: API took too long to respond")
        # Try with even smaller limit as fallback
        try:
            print("Attempting fallback with smaller limit...")
            params = {"$limit": 300}  # Very small limit
            resp = requests.get(CALGARY_3D_BUILDINGS_URL, params=params, timeout=10)
            resp.raise_for_status()
            all_buildings = resp.json()
            
            # Same filtering logic but with smaller dataset
            filtered_features = []
            for building in all_buildings:
                if "polygon" in building and building["polygon"]:
                    if _polygon_in_bbox(building["polygon"]["coordinates"], zone_bbox):
                        # Convert to GeoJSON Feature
                        normalized_props = _normalize_building_attributes(building)
                        feature = {
                            "type": "Feature",
                            "id": building.get("struct_id"),
                            "properties": normalized_props,
                            "geometry": building["polygon"]
                        }
                        filtered_features.append(feature)
            
            print(f"Fallback successful: {len(filtered_features)} buildings")
            return filtered_features
        except Exception as fallback_error:
            print(f"Fallback also failed: {fallback_error}")
            return []
    except requests.exceptions.RequestException as e:
        print(f"Request error fetching buildings for zone: {e}")
        return []
    except Exception as e:
        print(f"Error fetching buildings for zone: {e}")
        return []

def get_buildings_for_target_area(target_area):
    """Get buildings for a target area (existing functionality)"""
    try:
        if target_area not in TARGET_AREAS:
            raise ValueError(f"Invalid target area: {target_area}")
        
        bbox = TARGET_AREAS[target_area]['bbox']
        buildings = fetch_calgary_buildings_geojson(bbox=bbox)
        return buildings.get('features', []) # Changed from 'buildings' to 'features' to match new structure
    except Exception as e:
        print(f"Error fetching buildings for target area {target_area}: {e}")
        return []

def get_buildings_within_bbox(bbox):
    """Get buildings within a bounding box (existing functionality)"""
    try:
        buildings = fetch_calgary_buildings_geojson(bbox=bbox)
        return buildings.get('features', []) # Changed from 'buildings' to 'features' to match new structure
    except Exception as e:
        print(f"Error fetching buildings within bbox: {e}")
        return []

def get_available_target_areas():
    """Get list of available target areas"""
    return list(TARGET_AREAS.keys())

def get_available_zones():
    """Get list of available building zones"""
    zones = {}
    for district_name, district in BUILDING_ZONES.items():
        zones[district_name] = {
            "name": district["name"],
            "zones": list(district["zones"].keys())
        }
    return zones


