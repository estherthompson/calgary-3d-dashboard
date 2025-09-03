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
      
      const query = queryText.toLowerCase();
      let filteredBuildings = [];
      let filter = null;
      
      // Building type queries
      if (query.includes('low rise') || query.includes('low-rise')) {
        filteredBuildings = buildings.filter(b => 
          b.properties?.building_type === 'low_rise'
        );
        filter = {
          attribute: 'building_type',
          operator: '=',
          value: 'low_rise',
          description: 'Low rise buildings (2-4 floors)'
        };
      } else if (query.includes('mid rise') || query.includes('mid-rise') || query.includes('medium rise')) {
        filteredBuildings = buildings.filter(b => 
          b.properties?.building_type === 'mid_rise'
        );
        filter = {
          attribute: 'building_type',
          operator: '=',
          value: 'mid_rise',
          description: 'Mid rise buildings (5-9 floors)'
        };
      } else if (query.includes('high rise') || query.includes('high-rise') || query.includes('tall')) {
        filteredBuildings = buildings.filter(b => 
          b.properties?.building_type === 'high_rise'
        );
        filter = {
          attribute: 'building_type',
          operator: '=',
          value: 'high_rise',
          description: 'High rise buildings (10+ floors)'
        };
      } else if (query.includes('single story') || query.includes('single-story') || query.includes('one story')) {
        filteredBuildings = buildings.filter(b => 
          b.properties?.building_type === 'single_story'
        );
        filter = {
          attribute: 'building_type',
          operator: '=',
          value: 'single_story',
          description: 'Single story buildings'
        };
      }
      // Height queries
      else if (query.includes('height') || query.includes('tall') || query.includes('meters') || query.includes('metres') || query.includes('feet') || query.includes('ft')) {
        let heightValue = 50; // default
        let operator = '>';
        
        // Extract height value from query
        const heightMatch = query.match(/(\d+)\s*(?:meters?|metres?|m|feet?|ft)/i);
        if (heightMatch) {
          heightValue = parseInt(heightMatch[1]);
          // Convert feet to meters if needed
          if (query.includes('feet') || query.includes('ft')) {
            heightValue = Math.round(heightValue * 0.3048 * 100) / 100; // Round to 2 decimal places
          }
        }
        
        // Check for "over", "above", "more than" vs "under", "below", "less than"
        if (query.includes('under') || query.includes('below') || query.includes('less than')) {
          operator = '<';
        }
        
        // Debug: Log building height properties
        console.log('Height filtering - looking for buildings with height properties');
        console.log('Sample building properties:', buildings.slice(0, 3).map(b => ({
          id: b.id,
          height_m: b.properties?.height_m,
          height_ft: b.properties?.height_ft,
          floors: b.properties?.floors,
          raw_height: b.properties?.height
        })));
        
        filteredBuildings = buildings.filter(b => {
          // Check multiple possible height properties and handle string formats
          let heightInMeters = null;
          
          // Try to get height from various properties
          if (b.properties?.height_m) {
            heightInMeters = parseFloat(b.properties.height_m);
          } else if (b.properties?.height_ft) {
            heightInMeters = parseFloat(b.properties.height_ft) * 0.3048;
          } else if (b.properties?.height) {
            // Handle string formats like "11.5ft" or "3.5m"
            const heightStr = b.properties.height.toString().toLowerCase();
            if (heightStr.includes('ft') || heightStr.includes('feet')) {
              const ftValue = parseFloat(heightStr.replace(/[^\d.]/g, ''));
              if (!isNaN(ftValue)) {
                heightInMeters = ftValue * 0.3048;
              }
            } else if (heightStr.includes('m') || heightStr.includes('meters') || heightStr.includes('metres')) {
              const mValue = parseFloat(heightStr.replace(/[^\d.]/g, ''));
              if (!isNaN(mValue)) {
                heightInMeters = mValue;
              }
            }
          }
          
          if (heightInMeters === null || isNaN(heightInMeters)) {
            return false;
          }
          
          if (operator === '>') {
            return heightInMeters > heightValue;
          } else {
            return heightInMeters < heightValue;
          }
        });
        
        filter = {
          attribute: 'height_m',
          operator: operator,
          value: heightValue,
          description: `Buildings ${operator === '>' ? 'taller' : 'shorter'} than ${heightValue} meters`
        };
        
        console.log(`Height filter applied: ${operator} ${heightValue}m, found ${filteredBuildings.length} buildings`);
      }
      // Floor count queries
      else if (query.includes('floor') || query.includes('floors') || query.includes('story') || query.includes('stories')) {
        let floorValue = 5; // default
        let operator = '>';
        
        // Extract floor count from query
        const floorMatch = query.match(/(\d+)\s*(?:floor|story)/i);
        if (floorMatch) {
          floorValue = parseInt(floorMatch[1]);
        }
        
        // Check for "over", "above", "more than" vs "under", "below", "less than"
        if (query.includes('under') || query.includes('below') || query.includes('less than')) {
          operator = '<';
        }
        
        filteredBuildings = buildings.filter(b => {
          if (!b.properties?.floors) return false;
          if (operator === '>') {
            return b.properties.floors > floorValue;
          } else {
            return b.properties.floors < floorValue;
          }
        });
        
        filter = {
          attribute: 'floors',
          operator: operator,
          value: floorValue,
          description: `Buildings with ${operator === '>' ? 'more' : 'fewer'} than ${floorValue} floors`
        };
      }
      // Land use queries
      else if (query.includes('commercial') || query.includes('business') || query.includes('office') || query.includes('retail')) {
        // Debug: Log land use properties
        console.log('Land use filtering - looking for commercial buildings');
        console.log('Sample building land use properties:', buildings.slice(0, 5).map(b => ({
          id: b.id,
          land_use: b.properties?.land_use,
          building_type: b.properties?.building_type,
          address: b.properties?.address
        })));
        
        filteredBuildings = buildings.filter(b => {
          const landUse = b.properties?.land_use?.toLowerCase() || '';
          return landUse.includes('commercial') || 
                 landUse.includes('business') || 
                 landUse.includes('office') ||
                 landUse.includes('retail') ||
                 landUse.includes('shop') ||
                 landUse.includes('store');
        });
        filter = {
          attribute: 'land_use',
          operator: '=',
          value: 'commercial',
          description: 'Commercial buildings (business, office, retail)'
        };
      } else if (query.includes('residential') || query.includes('home') || query.includes('house') || query.includes('apartment')) {
        // Debug: Log land use properties
        console.log('Land use filtering - looking for residential buildings');
        console.log('Sample building land use properties:', buildings.slice(0, 5).map(b => ({
          id: b.id,
          land_use: b.properties?.land_use,
          building_type: b.properties?.building_type,
          address: b.properties?.address
        })));
        
        filteredBuildings = buildings.filter(b => {
          const landUse = b.properties?.land_use?.toLowerCase() || '';
          return landUse.includes('residential') || 
                 landUse.includes('home') || 
                 landUse.includes('house') ||
                 landUse.includes('apartment') ||
                 landUse.includes('condo') ||
                 landUse.includes('dwelling');
        });
        filter = {
          attribute: 'land_use',
          operator: '=',
          value: 'residential',
          description: 'Residential buildings (homes, apartments, condos)'
        };
      } else if (query.includes('mixed use') || query.includes('mixed-use') || query.includes('mixed')) {
        filteredBuildings = buildings.filter(b => {
          const landUse = b.properties?.land_use?.toLowerCase() || '';
          return landUse.includes('mixed') || 
                 landUse.includes('multi') ||
                 landUse.includes('combination');
        });
        filter = {
          attribute: 'land_use',
          operator: '=',
          value: 'mixed_use',
          description: 'Mixed use buildings (residential + commercial)'
        };
      }
      // Default: no specific filter
      else {
        filteredBuildings = [];
        filter = null;
      }
      
      setHighlightedBuildings(filteredBuildings);
      setInterpretedFilter(filter);
      
      if (filter) {
        console.log(`Query interpreted: ${filter.description}`);
        console.log(`Highlighted ${filteredBuildings.length} buildings`);
      } else {
        console.log('No specific filter found for query');
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

  // Handle loading a saved project
  const handleLoadProject = useCallback((project) => {
    if (!project) return;
    
    try {
      // Set the current project
      setCurrentProject(project);
      
      // Restore the saved filters if they exist
      if (project.filters && project.filters.length > 0) {
        const savedFilter = project.filters[0];
        setInterpretedFilter(savedFilter);
        
        // Apply the filter to highlight buildings
        let filteredBuildings = [];
        
        if (savedFilter.attribute === 'height_m') {
          if (savedFilter.operator === '>') {
            filteredBuildings = buildings.filter(b => 
              b.properties?.height_m && b.properties.height_m > savedFilter.value
            );
          } else if (savedFilter.operator === '<') {
            filteredBuildings = buildings.filter(b => 
              b.properties?.height_m && b.properties.height_m < savedFilter.value
            );
          }
        } else if (savedFilter.attribute === 'floors') {
          if (savedFilter.operator === '>') {
            filteredBuildings = buildings.filter(b => 
              b.properties?.floors && b.properties.floors > savedFilter.value
            );
          } else if (savedFilter.operator === '<') {
            filteredBuildings = buildings.filter(b => 
              b.properties?.floors && b.properties.floors < savedFilter.value
            );
          }
        } else if (savedFilter.attribute === 'building_type') {
          filteredBuildings = buildings.filter(b => 
            b.properties?.building_type === savedFilter.value
          );
        } else if (savedFilter.attribute === 'land_use') {
          // Handle land use filtering with case-insensitive matching
          filteredBuildings = buildings.filter(b => {
            const buildingLandUse = b.properties?.land_use?.toLowerCase() || '';
            const filterValue = savedFilter.value.toLowerCase();
            
            if (filterValue === 'commercial') {
              return buildingLandUse.includes('commercial') || 
                     buildingLandUse.includes('business') || 
                     buildingLandUse.includes('office') ||
                     buildingLandUse.includes('retail');
            } else if (filterValue === 'residential') {
              return buildingLandUse.includes('residential') || 
                     buildingLandUse.includes('home') || 
                     buildingLandUse.includes('house') ||
                     buildingLandUse.includes('apartment');
            } else if (filterValue === 'mixed_use') {
              return buildingLandUse.includes('mixed') || 
                     buildingLandUse.includes('multi') ||
                     buildingLandUse.includes('combination');
            }
            return buildingLandUse === filterValue;
          });
        }
        
        setHighlightedBuildings(filteredBuildings);
        
        // Set the query text
        if (project.query_text) {
          setQueryText(project.query_text);
        }
        
        console.log(`Loaded project: ${project.name} with ${project.highlighted_count} highlighted buildings`);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }, [buildings]);

  // Clear query and filters
  const handleClearQuery = useCallback(() => {
    setQueryText('');
    setInterpretedFilter(null);
    setHighlightedBuildings([]);
  }, []);

  // Handle project save
  const handleSaveProject = useCallback(async (projectName) => {
    if (!username || !selectedZone) return;

    try {
      const projectData = {
        username,
        name: projectName || `Analysis of ${zoneData?.name || selectedZone}`,
        description: `LLM analysis of buildings in ${zoneData?.name || selectedZone}`,
        target_area: selectedZone,
        total_buildings: buildings.length,
        highlighted_count: highlightedBuildings.length,
        query_results: highlightedBuildings.map(b => ({
          id: b.id,
          properties: b.properties
        })),
        filters: interpretedFilter ? [interpretedFilter] : [],
        query_text: queryText
      };

      const response = await projectsAPI.saveProject(projectData);
      console.log('Project saved:', response.data);
      
      // Refresh user projects
      loadUserProjects();
      
      // Clear the current query after saving
      setQueryText('');
      setInterpretedFilter(null);
      setHighlightedBuildings([]);
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }, [username, selectedZone, zoneData, buildings, highlightedBuildings, interpretedFilter, queryText, loadUserProjects]);

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
            "show buildings over 100 feet tall",
            "find buildings under 20 meters",
            "highlight high-rise buildings",
            "find buildings with more than 10 floors",
            "show commercial buildings",
            "show residential buildings",
            "show mixed use buildings"
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

          {/* Query Panel - always show for better UX */}
          <QueryPanel 
            onSubmit={handleQuerySubmit}
            onClear={handleClearQuery}
            onSave={handleSaveProject}
            queryText={queryText}
            setQueryText={setQueryText}
            loading={loading}
            interpretedFilter={interpretedFilter}
            availableFilters={availableFilters}
            canSave={!!username && buildings.length > 0}
          />

          {/* Project Panel - only show when zone is selected */}
          {selectedZone && (
            <ProjectPanel 
              username={username}
              setUsername={setUsername}
              projects={userProjects}
              currentProject={currentProject}
              onLoadProject={handleLoadProject}
              onSaveProject={handleSaveProject}
              canSave={!!username && buildings.length > 0}
            />
          )}

          {/* Building Info - only show when building is selected */}
          {selectedBuilding && (
            <BuildingInfo 
              building={selectedBuilding} 
              onClose={() => setSelectedBuilding(null)}
            />
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
