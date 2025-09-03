import React, { useState, useEffect } from 'react';
import { buildingsAPI } from '../services/api';
import './ZoneSelector.css';

const ZoneSelector = ({ onZoneSelect, selectedZone }) => {
  const [zones, setZones] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDistrict, setExpandedDistrict] = useState(null);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await buildingsAPI.getBuildingZones();
      setZones(response.data.zones);
    } catch (err) {
      console.error('Failed to load zones:', err);
      setError('Failed to load building zones');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneSelect = (zoneId, zoneData) => {
    onZoneSelect(zoneId, zoneData);
    setExpandedDistrict(null); // Collapse after selection
  };

  const toggleDistrict = (districtName) => {
    setExpandedDistrict(expandedDistrict === districtName ? null : districtName);
  };

  if (loading) {
    return (
      <div className="zone-selector">
        <div className="zone-selector-header">
          <h3>Select Zone</h3>
          <div className="loading-spinner"></div>
        </div>
        <p>Loading available zones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="zone-selector">
        <div className="zone-selector-header">
          <h3>Select Zone</h3>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadZones} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="zone-selector">
      <div className="zone-selector-header">
        <h3>Select Zone</h3>
        <p className="zone-subtitle">Choose a specific zone for optimal performance</p>
      </div>
      
      <div className="zones-container">
        {Object.entries(zones).map(([districtKey, district]) => (
          <div key={districtKey} className="district-group">
            <div 
              className="district-header"
              onClick={() => toggleDistrict(districtKey)}
            >
              <h4>{district.name}</h4>
              <span className="district-toggle">
                {expandedDistrict === districtKey ? '▼' : '▶'}
              </span>
            </div>
            
            {expandedDistrict === districtKey && (
              <div className="zones-list">
                {Object.keys(district.zones).map((zoneId) => {
                  // Get zone data from the zones object
                  const zoneData = district.zones[zoneId];
                  if (!zoneData) return null;
                  
                  const isSelected = selectedZone === zoneId;
                  
                  return (
                    <div 
                      key={zoneId}
                      className={`zone-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleZoneSelect(zoneId, zoneData)}
                    >
                      <div className="zone-info">
                        <h5>{zoneData.name}</h5>
                        <p className="zone-description">{zoneData.description}</p>
                        <div className="zone-meta">
                          <span className="zone-buildings">
                            {zoneData.expected_buildings}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="selection-indicator">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedZone && (
        <div className="selected-zone-info">
          <h4>Selected Zone</h4>
          <p className="selected-zone-name">{selectedZone}</p>
          <button 
            onClick={() => onZoneSelect(null, null)}
            className="clear-selection-button"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};

export default ZoneSelector;
