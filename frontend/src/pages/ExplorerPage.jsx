import { useMemo, useEffect, useState, useRef } from 'react';
import { Search, Filter, Download, RefreshCw, X } from 'lucide-react';

import { S } from '../utils/styles';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useExplorerFilters } from '../hooks/useUrlState';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';

import { DateRangePicker } from '../components/DateRangePicker';
import { ErrorCallout } from '../components/ErrorCallout';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;

const ExplorerPage = () => {
  const { 
    config, 
    getApiParams,
    dateRange,
    setDateRange,
    setPresetRange
  } = useClientConfig();
  
  const { filters, setFilters, setPage } = useExplorerFilters();
  const { colorByDuration } = useDurationBands(config);

  // Adjust same-day date ranges
  const adjustedDateRange = useMemo(() => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date === dateRange.end_date) {
      return {
        start_date: dateRange.start_date,
        end_date: `${dateRange.end_date}T23:59:59`
      };
    }
    return dateRange;
  }, [dateRange]);

  // Extract page and debounce filters
  const rawPage = Number(filters.page) || 1;
  const { page: _omitPage, ...filtersNoPage } = filters;

  const [debouncedFilters, setDebouncedFilters] = useState(filtersNoPage);
  const debounceIdRef = useRef(null);

  // 👇 NEW: memoized string key for filters to satisfy ESLint
  const filtersKey = useMemo(() => JSON.stringify(filtersNoPage), [filtersNoPage]);

  // Debounce filters (except page)
  useEffect(() => {
    if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
    debounceIdRef.current = setTimeout(() => {
      setDebouncedFilters(filtersNoPage);
      setPage(1);
      debounceIdRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (debounceIdRef.current) {
        clearTimeout(debounceIdRef.current);
        debounceIdRef.current = null;
      }
    };
  }, [filtersKey, setPage, filtersNoPage]);

  // Cancel pending debounce if user paginates
  useEffect(() => {
    if (debounceIdRef.current) {
      clearTimeout(debounceIdRef.current);
      debounceIdRef.current = null;
    }
  }, [rawPage]);

  // Build API params
  const apiParams = useMemo(() => {
    const f = debouncedFilters || {};
    const normalizedSortOrder = (f.sort_order || 'desc').toString().toUpperCase();
    const serverFilters = {};
    const serverSideFields = ['panel_title', 'application', 'operator', 'min_duration', 'max_duration'];

    serverSideFields.forEach(field => {
      if (f[field] && f[field] !== '') {
        serverFilters[field] = f[field];
      }
    });

    return {
      ...adjustedDateRange,
      ...getApiParams(),
      ...serverFilters,
      sort_by: f.sort_by || 'time_fired',
      sort_order: normalizedSortOrder,
      limit: 1000
    };
  }, [debouncedFilters, adjustedDateRange, getApiParams]);

  // Fetch data
  const { data: alerts, loading, error, refetch } = useApiData('/alerts', apiParams);

  // Client-side filtering & sorting for fields not handled server-side
  const processedAlerts = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return [];
    const f = debouncedFilters || {};
    let filtered = [...alerts];

    // Client-side search across all fields
    if (f.search) {
      const q = String(f.search).toLowerCase();
      filtered = filtered.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }

    // Client-side duration category filtering
    if (f.duration_category) {
      const cat = String(f.duration_category);
      filtered = filtered.filter(a => {
        const d = Number(a.duration_sec) || 0;
        if (cat === 'short') return d <= (config.bands?.[0]?.max || 59);
        if (cat === 'medium') return d >= (config.bands?.[1]?.min || 60) && d <= (config.bands?.[1]?.max || 299);
        if (cat === 'long') return d >= (config.bands?.[2]?.min || 300);
        return true;
      });
    }

    const sortKey = f.sort_by || 'time_fired';
    const dir = (f.sort_order || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      let aVal = a?.[sortKey];
      let bVal = b?.[sortKey];

      if (sortKey === 'time_fired' || String(sortKey).includes('time')) {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortKey === 'duration_sec' || sortKey === 'id') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal ?? '').toLowerCase();
        bVal = String(bVal ?? '').toLowerCase();
      }

      if (aVal === bVal) return 0;
      return aVal > bVal ? dir : -dir;
    });

    return filtered;
  }, [alerts, debouncedFilters, config.bands]);

  // Pagination driven by URL (no debounce)
  const totalItems = processedAlerts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(rawPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(totalItems, startIndex + PAGE_SIZE);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const goToPrevPage = () => { if (hasPrev) setPage(currentPage - 1); };
  const goToNextPage = () => { if (hasNext) setPage(currentPage + 1); };

  const paginatedAlerts = useMemo(() => {
    return processedAlerts.slice(startIndex, endIndex);
  }, [processedAlerts, startIndex, endIndex]);

  // Sorting toggles (immediate); also reset to page 1
  const handleSort = (key) => {
    const newOrder = filters.sort_by === key && filters.sort_order === 'asc' ? 'desc' : 'asc';
    setFilters({ sort_by: key, sort_order: newOrder });
    setPage(1);
  };

  const formatHourAndDay = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  };

  // Export CSV using FILTERED data, not all alerts
  const exportToCsv = () => {
    const headers = ['ID', 'Panel Title', 'Application', 'Time Fired (IL)', 'Duration (sec)', 'Operator', 'Status'];
    const csvContent = [
      headers.join(','),
      ...processedAlerts.map(alert => [
        alert.id || '',
        `"${(alert.panel_title || '').replace(/"/g, '""')}"`,
        `"${(alert.application || '').replace(/"/g, '""')}"`,
        formatHourAndDay(alert.time_fired) || '',
        alert.duration_sec || '',
        `"${(alert.operator || 'System/Auto').replace(/"/g, '""')}"`,
        alert.time_resolved ? 'Resolved' : 'Open'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = adjustedDateRange.start_date ? adjustedDateRange.start_date.split('T')[0] : 'filtered';
    const endDateStr = adjustedDateRange.end_date ? adjustedDateRange.end_date.split('T')[0] : '';
    a.download = `alerts_${dateStr}_to_${endDateStr}_filtered.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <ErrorCallout message={error.message} details={error} />;
  }

  return (
    <div>
      {/* Header Controls */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              Alert Explorer
            </h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0 0' }}>
              {loading ? 'Loading...' : `${processedAlerts.length} alerts found`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={refetch}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>

            <button
              onClick={exportToCsv}
              disabled={!processedAlerts.length}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: 'white',
                cursor: processedAlerts.length ? 'pointer' : 'not-allowed',
                fontSize: 14,
                opacity: processedAlerts.length ? 1 : 0.6
              }}
            >
              <Download size={14} />
              Export Filtered CSV ({processedAlerts.length} records)
            </button>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          position: 'relative'
        }}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card(), marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} style={{ color: '#6B7280' }} />
            <span style={{ fontWeight: 600 }}>Filters</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12
        }}>
          <input
            type="text"
            placeholder="Search all fields..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ search: e.target.value })}
            style={S.input}
          />
          
          <input
            type="text"
            placeholder="Panel title..."
            value={filters.panel_title || ''}
            onChange={(e) => setFilters({ panel_title: e.target.value })}
            style={S.input}
          />
          
          <input
            type="text"
            placeholder="Application..."
            value={filters.application || ''}
            onChange={(e) => setFilters({ application: e.target.value })}
            style={S.input}
          />
          
          <input
            type="text"
            placeholder="Operator..."
            value={filters.operator || ''}
            onChange={(e) => setFilters({ operator: e.target.value })}
            style={S.input}
          />
          
          <select
            value={filters.duration_category || ''}
            onChange={(e) => setFilters({ duration_category: e.target.value })}
            style={S.select}
          >
            <option value="">All Durations</option>
            <option value="short">Short (≤{config.bands?.[0]?.max || 59}s)</option>
            <option value="medium">Medium ({config.bands?.[1]?.min || 60}-{config.bands?.[1]?.max || 299}s)</option>
            <option value="long">Long (≥{config.bands?.[2]?.min || 300}s)</option>
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Min duration"
              value={filters.min_duration || ''}
              onChange={(e) => setFilters({ min_duration: e.target.value })}
              style={{ ...S.input, flex: 1 }}
            />
            <input
              type="number"
              placeholder="Max duration"
              value={filters.max_duration || ''}
              onChange={(e) => setFilters({ max_duration: e.target.value })}
              style={{ ...S.input, flex: 1 }}
            />
          </div>
        </div>

        {/* Active filters display */}
        <div style={{ marginTop: 12 }}>
          {Object.entries(filters).filter(([key, value]) => 
            value && key !== 'sort_by' && key !== 'sort_order' && key !== 'page'
          ).map(([key, value]) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                margin: '0 8px 8px 0',
                padding: '4px 8px',
                background: '#EBF8FF',
                color: '#2563EB',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 500
              }}
            >
              {key}: {value}
              <button
                onClick={() => setFilters({ [key]: '' })}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#2563EB'
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div style={S.card()}>
        {loading ? (
          <div>
            <LoadingSkeleton width="100%" height={40} />
            {Array(10).fill().map((_, i) => (
              <LoadingSkeleton key={i} width="100%" height={60} style={{ marginTop: 8 }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                minWidth: 800
              }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {[
                      { key: 'id', label: 'ID' },
                      { key: 'panel_title', label: 'Panel' },
                      { key: 'application', label: 'Application' },
                      { key: 'time_fired', label: 'Time Fired (IL)'},
                      { key: 'duration_sec', label: 'Duration' },
                      { key: 'operator', label: 'Operator' }
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        style={{
                          ...S.tableHeadCell,
                          background: filters.sort_by === key ? '#EBF8FF' : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {label}
                          {filters.sort_by === key && (
                            <span style={{ fontSize: 12 }}>
                              {filters.sort_order === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.map((alert, i) => (
                    <tr
                      key={alert.id || i}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        ':hover': { background: '#F9FAFB' }
                      }}
                    >
                      <td style={{ ...S.tableCell, color: '#6B7280', fontFamily: 'monospace' }}>
                        {alert.id}
                      </td>
                      <td style={S.tableCell} title={alert.panel_title || 'N/A'}>
                        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.panel_title || 'N/A'}
                        </div>
                      </td>
                      <td style={S.tableCell}>{alert.application || 'N/A'}</td>
                      <td style={{ ...S.tableCell, fontSize: 13, fontFamily: 'monospace' }}>
                        {formatHourAndDay(alert.time_fired)}
                      </td>
                      <td style={S.tableCell}>
                        <span style={{
                          background: `${colorByDuration(alert.duration_sec)}20`,
                          color: colorByDuration(alert.duration_sec),
                          padding: '4px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {alert.duration_sec}s
                        </span>
                      </td>
                      <td style={S.tableCell}>{alert.operator || 'System/Auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16
              }}>
                <div style={{ fontSize: 14, color: '#6B7280' }}>
                  Showing {startIndex + 1} to {endIndex} of {totalItems} alerts
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={goToPrevPage}
                    disabled={!hasPrev}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      background: hasPrev ? 'white' : '#F3F4F6',
                      color: hasPrev ? '#374151' : '#9CA3AF',
                      cursor: hasPrev ? 'pointer' : 'not-allowed',
                      fontSize: 14
                    }}
                  >
                    Previous
                  </button>
                  
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontSize: 14
                  }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={goToNextPage}
                    disabled={!hasNext}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      background: hasNext ? 'white' : '#F3F4F6',
                      color: hasNext ? '#374151' : '#9CA3AF',
                      cursor: hasNext ? 'pointer' : 'not-allowed',
                      fontSize: 14
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {processedAlerts.length === 0 && !loading && (
              <div style={{
                marginTop: 16,
                padding: 40,
                background: '#F9FAFB',
                borderRadius: 6,
                textAlign: 'center',
                color: '#6B7280'
              }}>
                <Search size={48} style={{ color: '#D1D5DB', marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  No alerts found
                </div>
                <div style={{ fontSize: 14 }}>
                  Try adjusting your filters or date range to find more results.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExplorerPage;