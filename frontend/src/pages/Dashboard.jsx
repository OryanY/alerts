import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import StatCard from '../components/StatCard';
import Filters from '../components/Filters';
import TopStats from '../components/TopStats';
import AlertTable from '../components/AlertTable';
import { fetchAlerts, fetchOverview, fetchByPanel, fetchByApplication, exportAlerts } from '../lib/api';
import { formatDuration } from '../lib/formatters';
import './Dashboard.css';

const DEFAULT_FILTERS = {
  panel_title: '',
  application: '',
  node_name: '',
  network: '',
  object: '',
  operator: '',
  min_duration: '',
  max_duration: '',
  start_date: '',
  end_date: '',
};

// shallow equality for simple objects
const shallowEqual = (a, b) => {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
};

// Custom debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// small toast stub (replace with your favorite lib)
const useToasts = () => {
  const [msg, setMsg] = useState(null);
  const show = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3500); };
  const node = msg ? (
    <div style={{
      position:'fixed', right:16, bottom:16, background:'#111', color:'#fff',
      padding:'10px 14px', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', zIndex:1000
    }}>{msg}</div>
  ) : null;
  return { show, node };
};

const parseQuery = () => {
  const p = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(filters)) {
    const v = p.get(key);
    if (v != null) filters[key] = v;
  }
  const page = Math.max(1, parseInt(p.get('page') || '1', 10));
  const limit = [25, 50, 100].includes(parseInt(p.get('limit'), 10)) ? parseInt(p.get('limit'), 10) : 50;
  return { filters, page, limit };
};

const writeQuery = (filters, page, limit) => {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
  if (page > 1) p.set('page', String(page));
  if (limit !== 50) p.set('limit', String(limit));
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  window.history.replaceState(null, '', url);
};

const Dashboard = () => {
  const initial = parseQuery();
  const [filters, setFilters] = useState(initial.filters);
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [panelStats, setPanelStats] = useState([]);
  const [applicationStats, setApplicationStats] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);

  const [pagination, setPagination] = useState({ page: initial.page, totalPages: 1, total: 0, limit: initial.limit });
  const [isFilterChanged, setIsFilterChanged] = useState(false);
  const lastFiltersRef = useRef(filters);
  const abortControllerRef = useRef(null);

  // Debounce filters with 500ms delay
  const debouncedFilters = useDebounce(filters, 500);

  const { show, node: toastNode } = useToasts();

  // keep URL in sync (use debounced filters for URL)
  useEffect(() => { 
    writeQuery(debouncedFilters, pagination.page, pagination.limit); 
  }, [debouncedFilters, pagination.page, pagination.limit]);

  // Validate filters before making requests
  const validateFilters = (filters) => {
    const min = filters.min_duration === '' ? null : Number(filters.min_duration);
    const max = filters.max_duration === '' ? null : Number(filters.max_duration);
    
    // Check duration range validity
    if (min !== null && max !== null && min > max) {
      return false;
    }
    
    // Check date range validity
    if (filters.start_date && filters.end_date) {
      const start = new Date(filters.start_date);
      const end = new Date(filters.end_date);
      if (start > end) {
        return false;
      }
    }
    
    return true;
  };

  // build params (use debounced filters)
  const alertParams = useMemo(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    Object.entries(debouncedFilters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  }, [debouncedFilters, pagination.page, pagination.limit]);

  const rangeParams = useMemo(() => {
    const p = {};
    if (debouncedFilters.start_date) p.start_date = debouncedFilters.start_date;
    if (debouncedFilters.end_date) p.end_date = debouncedFilters.end_date;
    return p;
  }, [debouncedFilters.start_date, debouncedFilters.end_date]);

  // Show loading state when filters change but debounce hasn't kicked in yet
  useEffect(() => {
    const filtersChanged = !shallowEqual(filters, debouncedFilters);
    if (filtersChanged && !initialLoading) {
      setIsFilterChanged(true);
    } else {
      setIsFilterChanged(false);
    }
  }, [filters, debouncedFilters, initialLoading]);

  // fetch effect (now only runs when debounced filters change)
  useEffect(() => {
    // Skip requests if filters are invalid
    if (!validateFilters(debouncedFilters)) {
      console.log('Skipping request due to invalid filters');
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const filterChanged = !shallowEqual(lastFiltersRef.current, debouncedFilters);
    if (!initialLoading && filterChanged) {
      setFilterLoading(true);
    }

    const run = async () => {
      try {
        setError(null);
        
        // Add signal to requests if your API supports AbortController
        const [alertsData, overviewData, byPanel, byApp] = await Promise.all([
          fetchAlerts(alertParams),
          fetchOverview(rangeParams),
          fetchByPanel(rangeParams),
          fetchByApplication(rangeParams),
        ]);

        if (controller.signal.aborted) return;

        setAlerts(alertsData.alerts || []);
        setPagination((prev) => ({
          ...prev,
          totalPages: alertsData.totalPages || 1,
          total: alertsData.total || 0,
        }));
        setOverview(overviewData || null);
        setPanelStats(byPanel || []);
        setApplicationStats(byApp || []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch data:', err);
        setError(err?.message || 'Failed to load data');
        show(`Error: ${err?.status ? `${err.status} – ` : ''}${err?.message || 'Request failed'}`);
      } finally {
        if (controller.signal.aborted) return;
        setInitialLoading(false);
        setFilterLoading(false);
        lastFiltersRef.current = debouncedFilters;
      }
    };

    run();

    return () => {
      controller.abort();
    };
  }, [alertParams, rangeParams]); // These now use debouncedFilters

  const handleFilterChange = useCallback((next) => {
    setPagination((p) => ({ ...p, page: 1 })); // reset page on filter change
    setFilters(next);
  }, []);

  const changePage = useCallback((next) => {
    setPagination((p) => ({ ...p, page: next }));
  }, []);

  const changeLimit = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    setPagination((p) => ({ ...p, page: 1, limit: val }));
  }, []);

  const doExport = useCallback(async (fmt) => {
    try {
      // Use debounced filters for export
      const params = { page: 1, limit: 200000 };
      Object.entries(debouncedFilters).forEach(([k, v]) => { if (v) params[k] = v; });
      
      const blob = await exportAlerts(params, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alerts.${fmt === 'csv' ? 'csv' : 'json'}`;
      a.click();
      URL.revokeObjectURL(url);
      show('Export ready');
    } catch (e) {
      console.error(e);
      show(`Export failed: ${e?.message || 'unknown error'}`);
    }
  }, [debouncedFilters, show]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // initial skeleton
  if (initialLoading) {
    return (
      <div className="container">
        <header className="page-header">
          <h1 className="header-title">🔔 Noisemaker Alert Analytics</h1>
          <p className="header-subtitle">Analyze and research your alert history</p>
        </header>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading alert data...</p>
        </div>
        {toastNode}
      </div>
    );
  }

  const showLoadingOverlay = filterLoading || isFilterChanged;

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="header-title">🔔 Noisemaker Alert Analytics</h1>
        <p className="header-subtitle">Analyze and research your alert history</p>
      </header>

      {error && (
        <div className="card" style={{ background:'#ffecec', border:'1px solid #fda4af', color:'#7f1d1d', padding:'10px 12px', marginBottom:12 }}>
          <strong>We hit a snag:</strong> {error}
        </div>
      )}

      {overview && (
        <section
          className={`grid grid-auto stats ${showLoadingOverlay ? 'stats-loading' : ''}`}
          style={{ opacity: showLoadingOverlay ? 0.6 : 1, transition: 'opacity 0.2s ease-in-out' }}
        >
          <StatCard title="Total Alerts" value={overview.total_alerts?.toLocaleString?.() ?? '0'} />
          <StatCard title="Average Duration" value={formatDuration(Math.round(overview.avg_duration || 0))} />
          <StatCard
            title="Short Alerts (≤30s)"
            value={`${overview.short_alerts} (${overview.total_alerts ? Math.round((overview.short_alerts / overview.total_alerts) * 100) : 0}%)`}
          />
          <StatCard
            title="Long Alerts (>5min)"
            value={`${overview.long_alerts} (${overview.total_alerts ? Math.round((overview.long_alerts / overview.total_alerts) * 100) : 0}%)`}
          />
        </section>
      )}

      <div style={{ opacity: showLoadingOverlay ? 0.6 : 1, transition: 'opacity 0.2s ease-in-out' }}>
        <TopStats
          panelStats={panelStats}
          applicationStats={applicationStats}
          onClickPanel={(panel_title) => handleFilterChange({ ...DEFAULT_FILTERS, panel_title })}
          onClickApp={(application) => handleFilterChange({ ...DEFAULT_FILTERS, application })}
        />
      </div>

      <div className="card" style={{alignItems:'center', justifyContent:'space-between', gap:12, marginTop:12 }}>
        <Filters filters={filters} setFilters={handleFilterChange} />
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label className="muted">Rows per page:</label>
          <select className="input" value={pagination.limit} onChange={changeLimit} aria-label="Rows per page">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="btn btn-secondary" onClick={() => doExport('csv')}>Export CSV</button>
          <button className="btn btn-secondary" onClick={() => doExport('json')}>Export JSON</button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {showLoadingOverlay && (
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(255, 255, 255, 0.9)', padding: '12px 20px',
              borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              {filterLoading ? 'Updating results...' : 'Preparing search...'}
            </span>
          </div>
        )}

        <div style={{ opacity: showLoadingOverlay ? 0.4 : 1, transition: 'opacity 0.2s ease-in-out' }}>
          <AlertTable alerts={alerts} />
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <p className="muted">
            Showing {alerts.length} of {pagination.total.toLocaleString()} results
            {isFilterChanged && <span style={{ color: '#f59e0b' }}> • Searching...</span>}
            {filterLoading && <span style={{ color: '#f59e0b' }}> • Loading...</span>}
          </p>
          <div className="pager">
            <button
              className="btn btn-secondary"
              onClick={() => changePage(pagination.page - 1)}
              disabled={pagination.page === 1 || showLoadingOverlay}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="muted">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              className="btn btn-secondary"
              onClick={() => changePage(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || showLoadingOverlay}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {toastNode}
    </div>
  );
};

export default Dashboard;