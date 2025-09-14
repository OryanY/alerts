// hooks/useUrlState.js — URL state management utilities
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import { toYMD_IL } from '../utils/time';

// Hook for managing date range in URL
export const useDateRangeUrl = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const dateRange = useMemo(() => {
    const start = searchParams.get('start_date');
    const end = searchParams.get('end_date');
    
    // If no dates in URL, default to last 7 days
    if (!start || !end) {
      const now = Date.now();
      return {
        start_date: toYMD_IL(now - 6 * 864e5),
        end_date: toYMD_IL(now)
      };
    }
    
    return { start_date: start, end_date: end };
  }, [searchParams]);

  const setDateRange = useCallback((newRange) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      
      if (newRange.start_date) {
        next.set('start_date', newRange.start_date);
      } else {
        next.delete('start_date');
      }
      
      if (newRange.end_date) {
        next.set('end_date', newRange.end_date);
      } else {
        next.delete('end_date');
      }
      
      return next;
    });
  }, [setSearchParams]);

  const setPresetRange = useCallback((days) => {
    const now = Date.now();
    const endDate = toYMD_IL(now);
    const startDate = toYMD_IL(now - (days - 1) * 864e5);
    setDateRange({ start_date: startDate, end_date: endDate });
  }, [setDateRange]);

  return { dateRange, setDateRange, setPresetRange };
};

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
          // Store sort_order in lowercase in URL for readability
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
      
      // Reset page when filters change (except when explicitly setting page)
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

// Hook for generating shareable URLs
export const useShareableUrl = () => {
  const navigate = useNavigate();
  
  const generateShareUrl = useCallback((path, params = {}) => {
    const url = new URL(window.location.origin + path);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }, []);

  const shareCurrentUrl = useCallback(async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Dashboard',
          url: url
        });
      } catch (e) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        // You could show a toast notification here
      }
    } else {
      await navigator.clipboard.writeText(url);
      // You could show a toast notification here
    }
  }, []);

  const navigateWithParams = useCallback((path, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    
    const search = searchParams.toString();
    navigate(path + (search ? `?${search}` : ''));
  }, [navigate]);

  return { generateShareUrl, shareCurrentUrl, navigateWithParams };
};

// Hook for managing pagination with URL state
export const usePagination = (totalItems, itemsPerPage = 50) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
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

  const goToFirstPage = useCallback(() => setPage(1), [setPage]);
  const goToLastPage = useCallback(() => setPage(totalPages), [setPage, totalPages]);
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) setPage(currentPage + 1);
  }, [currentPage, totalPages, setPage]);
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) setPage(currentPage - 1);
  }, [currentPage, setPage]);

  const getPageInfo = () => ({
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    startIndex: (currentPage - 1) * itemsPerPage,
    endIndex: Math.min(currentPage * itemsPerPage, totalItems),
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  });

  return {
    ...getPageInfo(),
    setPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage
  };
};