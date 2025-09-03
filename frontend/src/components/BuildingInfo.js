import React from 'react';
import { apiUtils } from '../services/api';
import './BuildingInfo.css';

const BuildingInfo = ({ building, onClose }) => {
  if (!building) {
    return (
      <div className="building-info">
        <div className="panel-header">
          <h3>Building Information</h3>
          <p className="panel-subtitle">Click on a building to see details</p>
        </div>
      </div>
    );
  }

  const { properties } = building;

  return (
    <div className="building-info">
      <div className="panel-header">
        <h3>Building Details</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="building-content">
        <div className="building-id">
          <strong>ID:</strong> {properties.struct_id}
        </div>

        <div className="info-section">
          <h4>Physical Properties</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Height:</span>
              <span className="value">{apiUtils.formatHeight(properties.height_m)}</span>
            </div>
            <div className="info-item">
              <span className="label">Floors:</span>
              <span className="value">{properties.floors || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Type:</span>
              <span className="value">{apiUtils.formatBuildingType(properties.building_type)}</span>
            </div>
            <div className="info-item">
              <span className="label">Land Use:</span>
              <span className="value">{properties.land_use || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h4>Location & Zoning</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Zoning:</span>
              <span className="value">{properties.zoning || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Address:</span>
              <span className="value">{properties.address || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Elevation Min:</span>
              <span className="value">{properties.grd_elev_min_z || 'Unknown'}m</span>
            </div>
            <div className="info-item">
              <span className="label">Elevation Max:</span>
              <span className="value">{properties.grd_elev_max_z || 'Unknown'}m</span>
            </div>
          </div>
        </div>

        {properties.assessed_value && (
          <div className="info-section">
            <h4>Property Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Assessed Value:</span>
                <span className="value">
                  {properties.assessed_value ? `$${properties.assessed_value.toLocaleString()}` : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="info-section">
          <h4>Metadata</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Data Source:</span>
              <span className="value">{properties.data_source}</span>
            </div>
            <div className="info-item">
              <span className="label">Last Updated:</span>
              <span className="value">{properties.last_updated}</span>
            </div>
            <div className="info-item">
              <span className="label">Stage:</span>
              <span className="value">{properties.stage || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div className="coordinates-info">
          <h4>Coordinates</h4>
          <div className="coords-display">
            <div className="coord-item">
              <span className="coord-label">Longitude:</span>
              <span className="coord-value">{building.geometry.coordinates[0][0][0].toFixed(6)}</span>
            </div>
            <div className="coord-item">
              <span className="coord-label">Latitude:</span>
              <span className="coord-value">{building.geometry.coordinates[0][0][1].toFixed(6)}</span>
            </div>
          </div>
          
          {/* Google Maps Button */}
          <div className="maps-actions">
            <button 
              onClick={() => {
                const lat = building.geometry.coordinates[0][0][1];
                const lng = building.geometry.coordinates[0][0][0];
                const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                window.open(googleMapsUrl, '_blank');
              }}
              className="google-maps-btn"
            >
              🗺️ View on Google Maps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildingInfo;
