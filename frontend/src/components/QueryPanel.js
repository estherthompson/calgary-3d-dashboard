import React, { useState } from 'react';
import './QueryPanel.css';

const QueryPanel = ({
  queryText,
  setQueryText,
  onSubmit,
  loading,
  interpretedFilter,
  availableFilters,
  onClear,
  onSave,
  canSave
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      onSubmit();
    }
  };

  return (
    <div className="query-panel">
      <div className="panel-header">
        <h3>Natural Language Query</h3>
        <p className="panel-subtitle">Ask about buildings in natural language</p>
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="query-form">
        <div className="input-group">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., 'show buildings over 100 feet tall'"
            className="query-input"
            disabled={loading}
          />
          <button
            type="submit"
            className="query-submit-btn"
            disabled={loading || !queryText.trim()}
          >
            {loading ? 'Processing...' : 'Query'}
          </button>
        </div>
      </form>

      {/* Available Filters Info */}
      {availableFilters.available_attributes && (
        <div className="filters-info">
          <h4>Available Filters</h4>
          <div className="attributes-list">
            {Object.entries(availableFilters.available_attributes).map(([key, desc]) => (
              <div key={key} className="attribute-item">
                <span className="attribute-name">{key}</span>
                <span className="attribute-desc">{desc}</span>
              </div>
            ))}
          </div>
          
          <h4>Example Queries</h4>
          <div className="examples-list">
            {availableFilters.examples?.map((example, index) => (
              <div key={index} className="example-item" onClick={() => setQueryText(example)}>
                {example}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interpreted Filter Display */}
      {interpretedFilter && (
        <div className="filter-result">
          <h4>Interpreted Filter</h4>
          <div className="filter-details">
            <div className="filter-row">
              <span className="filter-label">Attribute:</span>
              <span className="filter-value">{interpretedFilter.attribute}</span>
            </div>
            <div className="filter-row">
              <span className="filter-label">Operator:</span>
              <span className="filter-value">{interpretedFilter.operator}</span>
            </div>
            <div className="filter-row">
              <span className="filter-label">Value:</span>
              <span className="filter-value">{interpretedFilter.value}</span>
            </div>
            {interpretedFilter.description && (
              <div className="filter-row">
                <span className="filter-label">Description:</span>
                <span className="filter-value">{interpretedFilter.description}</span>
              </div>
            )}
          </div>
          
          <div className="filter-actions">
            <button
              onClick={onClear}
              className="clear-btn"
              disabled={loading}
            >
              Clear Filter
            </button>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="save-btn"
              disabled={!canSave || loading}
            >
              Save Project
            </button>
          </div>
        </div>
      )}

      {/* Save Project Dialog */}
      {showSaveDialog && (
        <div className="save-dialog-overlay">
          <div className="save-dialog">
            <h4>Save Project</h4>
            <p>Give your analysis a name to save it for later.</p>
            <input
              type="text"
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="project-name-input"
              autoFocus
            />
            <div className="dialog-actions">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (projectName.trim()) {
                    onSave(projectName.trim());
                    setProjectName('');
                    setShowSaveDialog(false);
                  }
                }}
                className="confirm-save-btn"
                disabled={!projectName.trim()}
              >
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="help-section">
        <h4>How to Use</h4>
        <ul className="help-list">
          <li>Type natural language queries about buildings</li>
          <li>Use attributes like height, floors, building type</li>
          <li>Examples: "tall buildings", "commercial properties"</li>
          <li>Save interesting filters as projects</li>
        </ul>
      </div>
    </div>
  );
};

export default QueryPanel;
