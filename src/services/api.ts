import axios from 'axios';

// Use VITE_API_URL from environment variables (must include /api)
// This MUST be set in frontend/.env - no fallbacks allowed
const baseURL = (import.meta as any).env?.VITE_API_URL;

if (!baseURL) {
  console.error('❌ VITE_API_URL is not configured. Please set it in frontend/.env');
  console.error('⚠️  Example: VITE_API_URL="http://localhost:3001/api"');
  throw new Error('VITE_API_URL is required. Please configure it in frontend/.env');
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const cleanedToken = token.trim().replace(/^Bearer\s+/i, '');
    if (cleanedToken && cleanedToken !== 'null' && cleanedToken !== 'undefined') {
      config.headers.Authorization = `Bearer ${cleanedToken}`;
    }
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
