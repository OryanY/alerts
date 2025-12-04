import { useEffect, useState } from 'react';
import { API_BASE } from '../utils/constants';

export const useApiData = (endpoint, params = {}, options = {}) => {
  const { skip = false } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (skip || !params) return;
    
    try {
      setLoading(true);
      setError(null);

      const queryString = new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== '' && v != null)
      ).toString();

      const url = `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json.data || json);
    } catch (e) {
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
  }, [endpoint, JSON.stringify(params), skip]);

  return { data, loading, error, refetch: fetchData };
};
