import axios from 'axios';
import { appEnv } from '../lib/env';

const baseURL = appEnv.apiUrl();

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
