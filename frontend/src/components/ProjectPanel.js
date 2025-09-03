import React from 'react';
import './ProjectPanel.css';

const ProjectPanel = ({
  username,
  projects,
  currentProject,
  onLoadProject,
  onRefresh
}) => {
  if (!username) {
    return (
      <div className="project-panel">
        <div className="panel-header">
          <h3>Project Management</h3>
          <p className="panel-subtitle">Enter a username to manage projects</p>
        </div>
      </div>
    );
  }

  return (
    <div className="project-panel">
      <div className="panel-header">
        <h3>Saved Projects</h3>
        <div className="header-actions">
          <button onClick={onRefresh} className="refresh-btn">
            ↻ Refresh
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="no-projects">
          <p>No projects saved yet.</p>
          <p className="hint">Create filters and save them as projects!</p>
        </div>
      ) : (
        <div className="projects-list">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`project-item ${currentProject?.id === project.id ? 'active' : ''}`}
              onClick={() => onLoadProject(project)}
            >
              <div className="project-header">
                <h4 className="project-name">{project.name}</h4>
                <span className="project-date">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="project-details">
                <span className="project-area">{project.target_area}</span>
                <span className="project-buildings">{project.total_buildings} buildings</span>
              </div>
              
              {project.filters && project.filters.length > 0 && (
                <div className="project-filters">
                  <span className="filters-count">{project.filters.length} filter(s)</span>
                  {project.filters[0] && (
                    <div className="filter-preview">
                      {project.filters[0].query_text}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentProject && (
        <div className="current-project">
          <h4>Current Project</h4>
          <div className="current-project-info">
            <strong>{currentProject.project_name}</strong>
            <span>Target Area: {currentProject.target_area}</span>
            <span>Buildings: {currentProject.total_buildings}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPanel;
