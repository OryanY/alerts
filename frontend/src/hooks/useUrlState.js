// hooks/useUrlState.js — URL state management for explorer filters
import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

// Hook for managing explorer filters in URL
export const useExplorerFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    search: searchParams.get('search') || '',
    panel_title: searchParams.get('panel') || '',
    application: searchParams.get('app') || '',
    operator: searchParams.get('operator') || '',
    duration_category: searchParams.get('duration') || '',
    min_duration: searchParams.get('min_dur') || '',
    max_duration: searchParams.get('max_dur') || '',
    sort_by: searchParams.get('sort') || 'time_fired',
    sort_order: searchParams.get('order') || 'desc',
    page: parseInt(searchParams.get('page') || '1', 10)
  }), [searchParams]);

  const setFilters = useCallback((newFilters) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      // Handle filter updates
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) {
          next.delete(key === 'panel_title' ? 'panel' :
            key === 'application' ? 'app' :
              key === 'min_duration' ? 'min_dur' :
                key === 'max_duration' ? 'max_dur' :
                  key === 'duration_category' ? 'duration' :
                    key === 'sort_by' ? 'sort' :
                      key === 'sort_order' ? 'order' : key);
        } else {
          const urlValue = key === 'sort_order' ? String(value).toLowerCase() : String(value);
          next.set(key === 'panel_title' ? 'panel' :
            key === 'application' ? 'app' :
              key === 'min_duration' ? 'min_dur' :
                key === 'max_duration' ? 'max_dur' :
                  key === 'duration_category' ? 'duration' :
                    key === 'sort_by' ? 'sort' :
                      key === 'sort_order' ? 'order' : key, urlValue);
        }
      });

      if (!('page' in newFilters)) {
        next.delete('page');
      }

      return next;
    });
  }, [setSearchParams]);

  const setPage = useCallback((page) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (page === 1) {
        next.delete('page');
      } else {
        next.set('page', String(page));
      }
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      // Keep date range, clear everything else
      const start = next.get('start_date');
      const end = next.get('end_date');
      next.clear();
      if (start) next.set('start_date', start);
      if (end) next.set('end_date', end);
      return next;
    });
  }, [setSearchParams]);

  return { filters, setFilters, setPage, clearFilters };
};