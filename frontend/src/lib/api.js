// src/lib/api.js - Enhanced API with error handling, caching, and retry logic

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

export class APIError extends Error {
  constructor(message, status, endpoint) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const apiRequest = async (url, options = {}) => {
  const { retries = 3, timeout = 10000, useCache = true } = options;
  
  // Check cache first
  if (useCache && cache.has(url)) {
    const cached = cache.get(url);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          url
        );
      }

      const data = await response.json();
      
      // Cache successful responses
      if (useCache) {
        cache.set(url, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      if (attempt === retries) {
        throw error instanceof APIError ? error : new APIError(error.message, 0, url);
      }
      
      // Exponential backoff: wait 1s, 2s, 4s between retries
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

export const fetchAlerts = async (params) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== '' && value != null)
  );
  const url = `${API_BASE}/alerts?${new URLSearchParams(cleanParams)}`;
  return apiRequest(url);
};

export const fetchOverview = async (params) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== '' && value != null)
  );
  const url = `${API_BASE}/stats/overview?${new URLSearchParams(cleanParams)}`;
  return apiRequest(url);
};

export const fetchByPanel = async (params) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== '' && value != null)
  );
  const url = `${API_BASE}/stats/by-panel?${new URLSearchParams(cleanParams)}`;
  return apiRequest(url);
};

export const fetchByApplication = async (params) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== '' && value != null)
  );
  const url = `${API_BASE}/stats/by-application?${new URLSearchParams(cleanParams)}`;
  return apiRequest(url);
};

export const exportAlerts = async (params, format = 'csv') => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== '' && value != null)
  );
  cleanParams.format = format;
  const url = `${API_BASE}/alerts/export?${new URLSearchParams(cleanParams)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new APIError(`Export failed: ${response.statusText}`, response.status, url);
  }
  
  return response.blob();
};

// Clear cache utility
export const clearCache = () => {
  cache.clear();
};