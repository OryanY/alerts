// frontend/src/hooks/useApiData.js
// COMPLETE REPLACEMENT - Copy this entire file

import { useEffect, useState, useRef } from 'react';
import { API_BASE } from '../utils/constants';

export const useApiData = (endpoint, params = {}, options = {}) => {
  const { skip = false } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  
  // Track abort controller for cleanup
  const abortControllerRef = useRef(null);

  const fetchData = async () => {
    if (skip || !params) return;
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);

      const queryString = new URLSearchParams(
        Object.entries(params || {}).filter(([_, v]) => v !== '' && v != null)
      ).toString();

      const url = `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, {
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json.data || json);
    } catch (e) {
      // Ignore abort errors (they're intentional)
      if (e.name === 'AbortError') return;
      
      setError({
        message: e.message || 'Unknown error',
        endpoint,
        params,
        timestamp: new Date().toISOString(),
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!skip && params) {
      fetchData();
    }
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [endpoint, skip, params ? JSON.stringify(params) : '']); // Simple stable dependency

  return { data, loading, error, refetch: fetchData };
};