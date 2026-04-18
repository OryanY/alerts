// hooks/useApiData.js — Reusable data fetching hook with abort control and error handling

import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE } from '../utils/constants';
import { useClientConfig } from '../contexts/ClientConfigContext';

export const useApiData = (endpoint, params = {}, options = {}) => {
  const { skip = false } = options;
  const { dateRange, getApiParams } = useClientConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  // Track abort controller for cleanup
  const abortControllerRef = useRef(null);

  // Stringify dependencies to avoid infinite re-renders while allowing deep comparison
  const paramsStr = params ? JSON.stringify(params) : '';
  const dateRangeStr = JSON.stringify(dateRange || {});
  const globalParamsStr = JSON.stringify(typeof getApiParams === 'function' ? getApiParams() : {});

  const fetchData = useCallback(async () => {
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

      // Auto-merge global config (dateRange + getApiParams) with specific params
      const finalParams = {
        ...dateRange,
        ...getApiParams(),
        ...params
      };

      const queryString = new URLSearchParams(
        Object.entries(finalParams || {}).filter(([_, v]) => v !== '' && v != null)
      ).toString();

      const url = `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

      // Add timeout (60 seconds) for heavy analytical queries
      const timeoutId = setTimeout(() => {
        abortControllerRef.current.abort();
      }, 60000);

      const res = await fetch(url, {
        signal: abortControllerRef.current.signal,
        credentials: 'include' // Required for Windows Authentication
      });

      clearTimeout(timeoutId);

      // Handle empty responses (e.g. 401 challenges with no body)
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (e) {
        // If not JSON, but has text (e.g. HTML error page), use text as error
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
        }
        // If successful but not JSON, this is unexpected for API
        throw new Error('Invalid JSON response from server');
      }

      if (!res.ok) {
        throw new Error(json.error || json.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      setData(json.data || json);
    } catch (e) {
      // Ignore abort errors (they're intentional)
      if (e.name === 'AbortError') {
        const isTimeout = e.message && e.message.includes('abort'); // Simplify timeout check
        if (isTimeout) {
          setError({
            message: 'Request timed out. Please check your internet connection.',
            endpoint,
            params,
            timestamp: new Date().toISOString(),
            isTimeout: true,
          });
          setData(null);
          setLoading(false);
        }
        return;
      }

      setError({
        message: e.message || 'Unknown error',
        endpoint,
        params,
        timestamp: new Date().toISOString(),
        isNetworkError: e.message.includes('Failed to fetch') || e.message.includes('NetworkError'),
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint, skip, paramsStr, dateRangeStr, globalParamsStr]);

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
  }, [fetchData, skip, paramsStr, dateRangeStr, globalParamsStr]);

  return { data, loading, error, refetch: fetchData };
};