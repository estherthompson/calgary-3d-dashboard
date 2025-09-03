from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database setup
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'calgary_dashboard.db')}"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """User model for simple username identification."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"


class Project(Base):
    """Project model for saved map analyses."""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)  # Auto-generated or user-provided
    description = Column(Text, nullable=True)   # Optional user description
    target_area = Column(String(50), nullable=True)  # e.g., "beltline", "downtown"
    total_buildings = Column(Integer, nullable=True)  # Total buildings in the area
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="projects")
    saved_filters = relationship("SavedFilter", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', user_id={self.user_id})>"


class SavedFilter(Base):
    """Saved filter model for LLM queries and parsed results."""
    __tablename__ = "saved_filters"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    query_text = Column(Text, nullable=False)  # "highlight buildings over 100 feet"
    parsed_filters_json = Column(Text, nullable=False)  # {"attribute": "height", "operator": ">", "value": "100"}
    matching_buildings_count = Column(Integer, nullable=True)  # How many buildings matched this filter
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="saved_filters")
    
    def __repr__(self):
        return f"<SavedFilter(id={self.id}, project_id={self.project_id}, query='{self.query_text[:30]}...')>"


def create_tables():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database with sample data."""
    db = SessionLocal()
    try:
        # Check if we already have data
        if db.query(User).first():
            print("Database already has data, skipping initialization")
            return
        
        # Create sample user
        sample_user = User(username="demo_user")
        db.add(sample_user)
        db.commit()
        
        # Create sample project
        sample_project = Project(
            user_id=sample_user.id,
            name="Sample Project - Beltline Analysis",
            description="Example project showing building height analysis",
            target_area="beltline",
            total_buildings=5000
        )
        db.add(sample_project)
        db.commit()
        
        # Create sample filter
        sample_filter = SavedFilter(
            project_id=sample_project.id,
            query_text="show buildings over 100 feet tall",
            parsed_filters_json='{"attribute": "height_m", "operator": ">", "value": 30.48}',
            matching_buildings_count=47
        )
        db.add(sample_filter)
        db.commit()
        
        print("Database initialized with sample data")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_tables()
    init_db()
