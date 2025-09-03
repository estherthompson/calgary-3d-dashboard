import axios from 'axios';

// API base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Building Data API
export const buildingsAPI = {
  // Get buildings for a target area
  getBuildings: (targetArea = 'beltline') => 
    api.get(`/buildings?target_area=${targetArea}`),
  
  // Get buildings within a bounding box
  getBuildingsByBbox: (bbox) => 
    api.get(`/buildings?bbox=${bbox.join(',')}`),
  
  // Get buildings for a specific zone (new)
  getBuildingsByZone: (zone) => 
    api.get(`/buildings?zone=${zone}`),
  
  // Get available target areas
  getTargetAreas: () => 
    api.get('/target-areas'),
  
  // Get available building zones (new)
  getBuildingZones: () => 
    api.get('/building-zones'),
};

// LLM Query API
export const llmAPI = {
  // Interpret natural language query
  interpretQuery: (query) => 
    api.post('/interpret-query', { query }),
  
  // Get available filter options
  getAvailableFilters: () => 
    api.get('/available-filters'),
};

// Project Management API
export const projectsAPI = {
  // Create new user
  createUser: (username) => 
    api.post('/users', { username }),
  
  // Save project
  saveProject: (projectData) => 
    api.post('/projects', projectData),
  
  // Get user's projects
  getUserProjects: (username) => 
    api.get(`/projects?username=${username}`),
  
  // Get specific project
  getProject: (projectId) => 
    api.get(`/projects/${projectId}`),
  
  // Delete project
  deleteProject: (projectId, username) => 
    api.delete(`/projects/${projectId}`, { data: { username } }),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

// Utility functions
export const apiUtils = {
  // Convert feet to meters
  feetToMeters: (feet) => feet * 0.3048,
  
  // Convert meters to feet
  metersToFeet: (meters) => meters / 0.3048,
  
  // Format building height
  formatHeight: (heightM) => {
    if (!heightM) return 'Unknown';
    const feet = apiUtils.metersToFeet(heightM);
    return `${heightM.toFixed(1)}m (${feet.toFixed(1)}ft)`;
  },
  
  // Format building type
  formatBuildingType: (type) => {
    const types = {
      'single_story': 'Single Story',
      'low_rise': 'Low Rise',
      'mid_rise': 'Mid Rise',
      'high_rise': 'High Rise',
    };
    return types[type] || type;
  },
  
  // Get building color based on type
  getBuildingColor: (type, isHighlighted = false) => {
    if (isHighlighted) return '#ff6b6b'; // Bright red for highlighted buildings
    return '#4A90E2'; // Same blue color for all regular buildings
  },
};

export default api;
