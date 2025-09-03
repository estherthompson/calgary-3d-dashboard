import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models import User, Project, SavedFilter, SessionLocal


def generate_project_name() -> str:
    """Generate auto project name with timestamp."""
    now = datetime.now()
    return f"Project {now.strftime('%Y-%m-%d %H:%M')}"


def create_user(username: str) -> Dict[str, Any]:
    """Create a new user."""
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            return {
                "success": False,
                "error": "Username already exists",
                "user_id": existing_user.id
            }
        
        # Create new user
        new_user = User(username=username)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "success": True,
            "user_id": new_user.id,
            "username": new_user.username,
            "created_at": new_user.created_at.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def save_project(
    username: str,
    project_name: Optional[str] = None,
    description: Optional[str] = None,
    target_area: Optional[str] = None,
    total_buildings: Optional[int] = None,
    filters: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Save a new project with filters."""
    db = SessionLocal()
    try:
        # Get or create user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user_result = create_user(username)
            if not user_result["success"]:
                return user_result
            user = db.query(User).filter(User.username == username).first()
        
        # Generate project name if not provided
        if not project_name:
            project_name = generate_project_name()
        
        # Create project
        new_project = Project(
            user_id=user.id,
            name=project_name,
            description=description,
            target_area=target_area,
            total_buildings=total_buildings
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        # Add filters if provided
        saved_filters = []
        if filters:
            for filter_data in filters:
                saved_filter = SavedFilter(
                    project_id=new_project.id,
                    query_text=filter_data.get("query_text", ""),
                    parsed_filters_json=json.dumps(filter_data.get("parsed_filters", {})),
                    matching_buildings_count=filter_data.get("matching_count")
                )
                db.add(saved_filter)
                saved_filters.append(saved_filter)
            db.commit()
        
        return {
            "success": True,
            "project_id": new_project.id,
            "project_name": new_project.name,
            "user_id": user.id,
            "username": username,
            "filters_count": len(saved_filters),
            "created_at": new_project.created_at.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def get_user_projects(username: str) -> Dict[str, Any]:
    """Get all projects for a user."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "error": "User not found"}
        
        projects = db.query(Project).filter(Project.user_id == user.id).all()
        
        project_list = []
        for project in projects:
            # Get filters for this project
            filters = db.query(SavedFilter).filter(SavedFilter.project_id == project.id).all()
            
            project_data = {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "target_area": project.target_area,
                "total_buildings": project.total_buildings,
                "created_at": project.created_at.isoformat(),
                "filters": [
                    {
                        "id": f.id,
                        "query_text": f.query_text,
                        "parsed_filters": json.loads(f.parsed_filters_json),
                        "matching_buildings_count": f.matching_buildings_count,
                        "created_at": f.created_at.isoformat()
                    }
                    for f in filters
                ]
            }
            project_list.append(project_data)
        
        return {
            "success": True,
            "username": username,
            "projects": project_list,
            "total_projects": len(project_list)
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def get_project(project_id: int) -> Dict[str, Any]:
    """Get a specific project by ID."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {"success": False, "error": "Project not found"}
        
        # Get user info
        user = db.query(User).filter(User.id == project.user_id).first()
        
        # Get filters for this project
        filters = db.query(SavedFilter).filter(SavedFilter.project_id == project.id).all()
        
        project_data = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "target_area": project.target_area,
            "total_buildings": project.total_buildings,
            "created_at": project.created_at.isoformat(),
            "user": {
                "id": user.id,
                "username": user.username
            },
            "filters": [
                {
                    "id": f.id,
                    "query_text": f.query_text,
                    "parsed_filters": json.loads(f.parsed_filters_json),
                    "matching_buildings_count": f.matching_buildings_count,
                    "created_at": f.created_at.isoformat()
                }
                for f in filters
            ]
        }
        
        return {
            "success": True,
            "project": project_data
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def delete_project(project_id: int, username: str) -> Dict[str, Any]:
    """Delete a project (only if user owns it)."""
    db = SessionLocal()
    try:
        # Get user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Get project and verify ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user.id
        ).first()
        
        if not project:
            return {"success": False, "error": "Project not found or access denied"}
        
        # Delete project (cascade will delete filters)
        db.delete(project)
        db.commit()
        
        return {
            "success": True,
            "message": f"Project '{project.name}' deleted successfully"
        }
        
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def get_all_users() -> Dict[str, Any]:
    """Get all users (for admin/debug purposes)."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        user_list = [
            {
                "id": user.id,
                "username": user.username,
                "created_at": user.created_at.isoformat(),
                "projects_count": len(user.projects)
            }
            for user in users
        ]
        
        return {
            "success": True,
            "users": user_list,
            "total_users": len(user_list)
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()
