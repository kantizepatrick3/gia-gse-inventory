// src/api/config.js
// Central API Configuration - Update ONLY this file when backend URL changes

// Production URL (Render)
export const API_BASE_URL = 'https://gia-gse-inventory.onrender.com';

// Development URL (local) - Uncomment for local development
// export const API_BASE_URL = `http://${window.location.hostname}:5000`;

// Full API URL
export const API_URL = `${API_BASE_URL}/api`;

// Helper function to get auth headers
export const getAuthHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token}` }
});