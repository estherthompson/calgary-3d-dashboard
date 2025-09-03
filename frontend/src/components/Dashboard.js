import React, { useState, useEffect, useCallback } from 'react';
import ZoneSelector from './ZoneSelector';
import QueryPanel from './QueryPanel';
import ProjectPanel from './ProjectPanel';
import BuildingInfo from './BuildingInfo';
import ThreeMap from './ThreeMap';
import { buildingsAPI, projectsAPI } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  // State for zone selection and buildings
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneData, setZoneData] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [highlightedBuildings, setHighlightedBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for query and filters
  const [queryText, setQueryText] = useState('');
  const [interpretedFilter, setInterpretedFilter] = useState(null);
  const [availableFilters, setAvailableFilters] = useState({});

  // State for user and projects
  const [username, setUsername] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [userProjects, setUserProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  // Load buildings when zone is selected
  const handleZoneSelect = useCallback(async (zoneId, zoneInfo) => {
    if (!zoneId) {
      setSelectedZone(null);
      setZoneData(null);
      setBuildings([]);
      setHighlightedBuildings([]);
      setSelectedBuilding(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setBuildings([]);
      setHighlightedBuildings([]);
      setSelectedBuilding(null);

      console.log(`Loading buildings for zone: ${zoneId}`);
      const response = await buildingsAPI.getBuildingsByZone(zoneId);
      
      setSelectedZone(zoneId);
      setZoneData(zoneInfo);
      setBuildings(response.data.buildings || []);
      
      console.log(`Loaded ${response.data.buildings?.length || 0} buildings for zone ${zoneId}`);
    } catch (err) {
      console.error('Failed to load buildings for zone:', err);
      setError(`Failed to load buildings for zone: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle building selection
  const handleBuildingSelect = useCallback((building) => {
    setSelectedBuilding(building);
  }, []);

  // Handle LLM query interpretation and building highlighting
  const handleQuerySubmit = useCallback(async () => {
    if (!queryText.trim()) return;
    
    try {
      setLoading(true);
      console.log('LLM Query submitted:', queryText);
      
      // Example: highlight buildings over 50m height
      if (queryText.toLowerCase().includes('tall') || queryText.toLowerCase().includes('height')) {
        const tallBuildings = buildings.filter(b => 
          b.properties?.height_m && b.properties.height_m > 50
        );
        setHighlightedBuildings(tallBuildings);
        setInterpretedFilter({
          attribute: 'height_m',
          operator: '>',
          value: 50,
          description: 'Buildings taller than 50 meters'
        });
        console.log(`Highlighted ${tallBuildings.length} tall buildings`);
      } else {
        setHighlightedBuildings([]);
        setInterpretedFilter(null);
      }
    } catch (err) {
      console.error('Failed to process query:', err);
    } finally {
      setLoading(false);
    }
  }, [queryText, buildings]);

  // Load user projects
  const loadUserProjects = useCallback(async () => {
    if (!username) return;

    try {
      const response = await projectsAPI.getUserProjects(username);
      setUserProjects(response.data.projects || []);
    } catch (err) {
      console.error('Failed to load user projects:', err);
    }
  }, [username]);

  // Clear query and filters
  const handleClearQuery = useCallback(() => {
    setQueryText('');
    setInterpretedFilter(null);
    setHighlightedBuildings([]);
  }, []);

  // Handle project save
  const handleSaveProject = useCallback(async () => {
    if (!username || !selectedZone) return;

    try {
      const projectData = {
        username,
        name: `Analysis of ${zoneData?.name || selectedZone}`,
        description: `LLM analysis of buildings in ${zoneData?.name || selectedZone}`,
        target_area: selectedZone,
        total_buildings: buildings.length,
        highlighted_count: highlightedBuildings.length,
        query_results: highlightedBuildings.map(b => ({
          id: b.id,
          properties: b.properties
        }))
      };

      const response = await projectsAPI.saveProject(projectData);
      console.log('Project saved:', response.data);
      
      // Refresh user projects
      loadUserProjects();
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }, [username, selectedZone, zoneData, buildings, highlightedBuildings]);

  // Load projects when username changes
  useEffect(() => {
    if (username) {
      loadUserProjects();
    }
  }, [username, loadUserProjects]);

  // Load available filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        // For now, set some example filters
        setAvailableFilters({
          available_attributes: {
            height_m: "Building height in meters",
            floors: "Number of floors",
            building_type: "Type of building (single_story, low_rise, mid_rise, high_rise)",
            zoning: "Zoning classification"
          },
          examples: [
            "show buildings over 50 meters tall",
            "highlight high-rise buildings",
            "find buildings with more than 10 floors",
            "show commercial buildings"
          ]
        });
      } catch (err) {
        console.error('Failed to load available filters:', err);
      }
    };
    
    loadFilters();
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-text">
            <h1>Calgary 3D Building Dashboard</h1>
            <p>Explore Calgary's buildings in 3D with AI-powered analysis</p>
          </div>
          <div className="user-section">
            {!username ? (
              <div className="username-input-section">
                <input
                  type="text"
                  placeholder="Enter username"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="username-input"
                />
                <button 
                  onClick={() => setUsername(tempUsername)}
                  className="set-username-btn"
                  disabled={!tempUsername.trim()}
                >
                  Set Username
                </button>
              </div>
            ) : (
              <div className="user-info">
                <span className="username-display">User: {username}</span>
                <button 
                  onClick={() => setUsername('')}
                  className="change-username-btn"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="left-panel">
          {/* Zone Selection */}
          <ZoneSelector 
            onZoneSelect={handleZoneSelect}
            selectedZone={selectedZone}
          />

          {/* Query Panel - only show when zone is selected */}
          {selectedZone && (
            <QueryPanel 
              onSubmit={handleQuerySubmit}
              onClear={handleClearQuery}
              queryText={queryText}
              setQueryText={setQueryText}
              loading={loading}
              interpretedFilter={interpretedFilter}
              availableFilters={availableFilters}
              canSave={!!username && buildings.length > 0}
            />
          )}

          {/* Project Panel - only show when zone is selected */}
          {selectedZone && (
            <ProjectPanel 
              username={username}
              setUsername={setUsername}
              projects={userProjects}
              currentProject={currentProject}
              onLoadProject={setCurrentProject}
              onSaveProject={handleSaveProject}
              canSave={!!username && buildings.length > 0}
            />
          )}

          {/* Building Info - only show when building is selected */}
          {selectedBuilding && (
            <BuildingInfo building={selectedBuilding} />
          )}
        </div>

        <div className="right-panel">
          {/* 3D Map - only show when zone is selected */}
          {selectedZone ? (
            <ThreeMap
              buildings={buildings}
              highlightedBuildings={highlightedBuildings}
              onBuildingSelect={handleBuildingSelect}
              targetArea={zoneData?.name || selectedZone}
            />
          ) : (
            <div className="map-placeholder">
              <div className="placeholder-content">
                <h2>Select a Zone to Begin</h2>
                <p>Choose a specific zone from the left panel to load the 3D building visualization.</p>
                <div className="zone-examples">
                  <h3>Available Zones:</h3>
                  <ul>
                    <li><strong>Stephen Avenue</strong></li>
                    <li><strong>Financial District</strong></li>
                    <li><strong>East Village</strong></li>
                  </ul>
                </div>
                <p className="performance-note">
                  <strong>Performance Note:</strong> Each zone contains only 2-20 buildings for optimal 3D rendering performance.
                </p>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading buildings for {zoneData?.name || selectedZone}...</p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="error-overlay">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button onClick={() => setError(null)} className="error-dismiss">
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
