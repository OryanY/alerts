// hooks/useApiData.js - Reusable data fetching hook, backed by React Query so
// identical endpoint+params requests are cached/deduped across components
// instead of each caller firing its own independent fetch.

import { useQuery, keepPreviousData as keepPreviousDataFn } from '@tanstack/react-query';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { fetchApi } from '../utils/api';

export const useApiData = (endpoint, params = {}, options = {}) => {
  const { skip = false, keepPreviousData = true } = options;
  const { dateRange, getApiParams } = useClientConfig();

  const enabled = !skip && !!params;
  const globalParams = typeof getApiParams === 'function' ? getApiParams() : {};

  const query = useQuery({
    // React Query hashes queryKey by content (stable, sorted-key JSON), so
    // passing these objects directly is enough — no need to hand-roll a
    // stringify + useMemo just to keep the key "stable" across renders.
    queryKey: [endpoint, dateRange, globalParams, params],
    queryFn: ({ signal }) => fetchApi(endpoint, { ...dateRange, ...globalParams, ...params }, { signal })
      .then((json) => json.data ?? json),
    enabled,
    // The original hook never retried failed requests; match that instead of
    // the app-wide QueryClient default (retry: 1) so a broken endpoint fails
    // fast and surfaces its error immediately.
    retry: false,
    placeholderData: keepPreviousData ? keepPreviousDataFn : undefined,
  });

  // React Query doesn't clear a query's error when a new fetch starts on the
  // same key — it persists until the new attempt settles. Suppress it while
  // a fetch is actively in flight so consumers (ChartCard/MetricCard check
  // `error` before `loading`) don't show a stale failure banner over an
  // in-flight, possibly-successful refetch — matching the old hook's
  // guarantee that loading and error were never both true.
  const error = (query.error && !query.isFetching)
    ? {
      message: query.error.message || 'Unknown error',
      endpoint,
      params: { ...dateRange, ...globalParams, ...params },
      timestamp: new Date().toISOString(),
      isNetworkError: query.error.message?.includes('Failed to fetch') || query.error.message?.includes('NetworkError'),
    }
    : null;

  return {
    data: query.data ?? null,
    loading: enabled && query.isFetching,
    error,
    refetch: query.refetch,
  };
};
