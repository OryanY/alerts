// hooks/useApiData.js - Reusable data fetching hook with abort control.

import { useEffect, useState, useRef, useCallback } from 'react';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { fetchApi } from '../utils/api';

export const useApiData = (endpoint, params = {}, options = {}) => {
  const { skip = false, keepPreviousData = true } = options;
  const { dateRange, getApiParams } = useClientConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const paramsStr = params ? JSON.stringify(params) : '';
  const dateRangeStr = JSON.stringify(dateRange || {});
  const globalParamsStr = JSON.stringify(typeof getApiParams === 'function' ? getApiParams() : {});

  const fetchData = useCallback(async () => {
    if (skip || !params) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const json = await fetchApi(endpoint, {
        ...dateRange,
        ...getApiParams(),
        ...params,
      }, {
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setData(json.data ?? json);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;

      setError({
        message: e.message || 'Unknown error',
        endpoint,
        params,
        timestamp: new Date().toISOString(),
        isNetworkError: e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError'),
      });

      if (!keepPreviousData) setData(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  // Deep-compare strings intentionally keep callers from refetching on every render
  // when they pass equivalent object literals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, skip, paramsStr, dateRangeStr, globalParamsStr, keepPreviousData]);

  useEffect(() => {
    if (!skip && params) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, skip, paramsStr, dateRangeStr, globalParamsStr]);

  return { data, loading, error, refetch: fetchData };
};
