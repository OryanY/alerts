// pages/ExplorerPage.jsx — Main alert exploration interface with filtering and visualization
import { useMemo, useEffect, useState, useRef } from 'react';
import { Search, Filter, Download, RefreshCw, X, AlertCircle } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useExplorerFilters } from '../hooks/useUrlState';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { formatHourAndDay } from "../utils/dateUtils";
import { escapeCsv } from '../utils/formatters';

import { DateRangePicker } from '../components/ui/DateRangePicker';
import { LazyInput } from '../components/ui/LazyInput';
import { ErrorCallout } from '../components/ui/ErrorCallout';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import SearchableSelect from '../components/common/SearchableSelect';
import { ColumnVisibilityPanel, getDefaultVisibleColumns, getAllColumns } from '../components/layout/ColumnVisibilityPanel';
import { AlertTable } from '../components/dashboard/AlertTable';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;
const ALL_COLUMNS = getAllColumns();


const ExplorerPage = () => {
  const { config, dateRange, setDateRange, setPresetRange } = useClientConfig();
  const { colors, styles: S } = useTheme();
  const { filters, setFilters, setPage } = useExplorerFilters();
  const { colorByDuration } = useDurationBands(config);

  // No need to format dates - backend handles Israeli timezone conversion
  const adjustedDateRange = dateRange;

  const rawPage = Number(filters.page) || 1;
  const { page: _omitPage, ...filtersNoPage } = filters;

  const [debouncedFilters, setDebouncedFilters] = useState(filtersNoPage);
  const debounceIdRef = useRef(null);
  const previousFiltersRef = useRef(filtersNoPage);

  const filtersKey = useMemo(() => JSON.stringify(filtersNoPage), [filtersNoPage]);

  useEffect(() => {
    if (debounceIdRef.current) {
      clearTimeout(debounceIdRef.current);
    }

    debounceIdRef.current = setTimeout(() => {
      // Parse the key back to get the object, ensuring we have the latest closure-independent values
      setDebouncedFilters(JSON.parse(filtersKey));
      setPage(1);
      debounceIdRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (debounceIdRef.current) {
        clearTimeout(debounceIdRef.current);
        debounceIdRef.current = null;
      }
    };
  }, [filtersKey, setPage]);

  const apiParams = useMemo(() => {
    const f = debouncedFilters || {};
    const normalizedSortOrder = (f.sort_order || 'desc').toString().toUpperCase();

    const serverFilters = {};
    const serverSideFields = ['panel_title', 'application', 'operator', 'has_incident'];

    serverSideFields.forEach((field) => {
      if (f[field] && f[field] !== '') {
        serverFilters[field] = f[field];
      }
    });

    // Validate and add duration filters
    const minDur = f.min_duration ? parseFloat(f.min_duration) : null;
    const maxDur = f.max_duration ? parseFloat(f.max_duration) : null;

    // Only include if valid (min <= max)
    if (minDur !== null && !isNaN(minDur)) {
      if (maxDur === null || isNaN(maxDur) || minDur <= maxDur) {
        serverFilters.min_duration = f.min_duration;
      }
    }

    if (maxDur !== null && !isNaN(maxDur)) {
      if (minDur === null || isNaN(minDur) || minDur <= maxDur) {
        serverFilters.max_duration = f.max_duration;
      }
    }

    // Map duration_category to min/max duration
    if (f.duration_category) {
      if (f.duration_category === 'short') {
        serverFilters.max_duration = config.bands?.[0]?.max || 59;
      } else if (f.duration_category === 'medium') {
        serverFilters.min_duration = config.bands?.[1]?.min || 60;
        serverFilters.max_duration = config.bands?.[1]?.max || 299;
      } else if (f.duration_category === 'long') {
        serverFilters.min_duration = config.bands?.[2]?.min || 300;
      }
    }

    if (f.search) {
      serverFilters.search = f.search;
    }

    return {
      ...serverFilters,
      sort_by: f.sort_by || 'time_fired',
      sort_order: normalizedSortOrder,
      limit: 1000,
    };
  }, [debouncedFilters, config.bands]);

  // useApiData automatically injects dateRange and getApiParams()
  const { data: alerts, loading, error, refetch } = useApiData('/alerts', apiParams);
  const filterParams = useMemo(
    () => filters.panel_title ? { panel_title: filters.panel_title } : {},
    [filters.panel_title]
  );
  const { data: filterOptions } = useApiData('/stats/filter-options', filterParams);

  const dropdownOptions = useMemo(() => {
    const panels = filterOptions?.panels || [];
    const apps = filterOptions?.applications || [];
    const operators = filterOptions?.operators || [];

    return {
      panels: [
        { value: '', label: 'All Panels' },
        ...panels.map((p) => ({ value: p, label: p })),
      ],
      applications: [
        { value: '', label: filters.panel_title ? `All Applications in Panel` : 'All Applications' },
        ...apps.map((a) => ({ value: a, label: a })),
      ],
      operators: [
        { value: '', label: filters.panel_title ? `All Operators in Panel` : 'All Operators' },
        ...operators.map((o) => ({ value: o, label: o })),
      ],
      durations: [
        { value: '', label: 'All Durations' },
        { value: 'short', label: `Short (≤${config.bands?.[0]?.max || 59}s)` },
        {
          value: 'medium',
          label: `Medium (${config.bands?.[1]?.min || 60}-${config.bands?.[1]?.max || 299}s)`,
        },
        {
          value: 'long',
          label: `Long (≥${config.bands?.[2]?.min || 300}s)`,
        },
      ],
    };
  }, [filterOptions, filters.panel_title, config.bands]);

  const processedAlerts = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return [];
    const f = debouncedFilters || {};
    let filtered = [...alerts];

    // Client-side filtering fallback
    if (f.panel_title) {
      filtered = filtered.filter(a => a.panel_title === f.panel_title);
    }
    if (f.application) {
      filtered = filtered.filter(a => a.application && String(a.application).toLowerCase().startsWith(String(f.application).toLowerCase()));
    }
    if (f.operator) {
      filtered = filtered.filter(a => a.operator && String(a.operator).toLowerCase().startsWith(String(f.operator).toLowerCase()));
    }
    if (f.has_incident) {
      const hasInc = f.has_incident === 'true';
      filtered = filtered.filter(a => hasInc ? !!a.incident_number : !a.incident_number);
    }
    if (f.search) {
      const s = f.search.toLowerCase();
      filtered = filtered.filter(a => a.message?.toLowerCase().includes(s));
    }
    
    // Sorting
    const sortKey = f.sort_by || 'time_fired';
    const dir = (f.sort_order || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      let aVal = a?.[sortKey];
      let bVal = b?.[sortKey];

      if (sortKey === 'time_fired' || sortKey === 'time_resolved' || String(sortKey).includes('time')) {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortKey === 'duration_sec') {
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
  }, [alerts, debouncedFilters]);

  const totalItems = processedAlerts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(rawPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(totalItems, startIndex + PAGE_SIZE);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const goToPrevPage = () => {
    if (hasPrev) setPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (hasNext) setPage(currentPage + 1);
  };

  const paginatedAlerts = useMemo(
    () => processedAlerts.slice(startIndex, endIndex),
    [processedAlerts, startIndex, endIndex]
  );

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('alertExplorer.visibleColumns');
        if (stored) {
          const parsed = JSON.parse(stored);
          const base = getDefaultVisibleColumns();
          return { ...base, ...parsed };
        }
      } catch {
        // ignore
      }
    }
    return getDefaultVisibleColumns();
  });

  // Separate effect for localStorage to prevent re-renders
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Debounce localStorage saves to prevent excessive writes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(
            'alertExplorer.visibleColumns',
            JSON.stringify(visibleColumns)
          );
        } catch {
          // ignore
        }
      }, 100);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [visibleColumns]);

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent hiding all columns
      if (!Object.values(next).some(Boolean)) {
        return prev;
      }
      return next;
    });
  };

  const visibleOrderedColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns[c.key]),
    [visibleColumns]
  );

  const handleSort = (key) => {
    const col = ALL_COLUMNS.find((c) => c.key === key);
    if (!col || !col.sortable) return;

    const newOrder =
      filters.sort_by === key && filters.sort_order === 'asc' ? 'desc' : 'asc';

    setFilters({ sort_by: key, sort_order: newOrder });
    setPage(1);
  };


  const renderShiftBadge = (shiftValue) => {
    if (!shiftValue) {
      return (
        <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>
          —
        </span>
      );
    }

    const normalized = String(shiftValue).toLowerCase();
    let bg = colors.bg.tertiary;
    let fg = colors.text.secondary;

    if (normalized.includes('day')) {
      bg = (colors.semantic?.success || colors.brand.primary) + '20';
      fg = colors.semantic?.success || colors.brand.primary;
    } else if (normalized.includes('night')) {
      bg = (colors.semantic?.warning || colors.brand.secondary) + '20';
      fg = colors.semantic?.warning || colors.brand.secondary;
    }

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: bg,
          color: fg,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {shiftValue}
      </span>
    );
  };

  const exportToCsv = () => {
    if (!processedAlerts.length || !visibleOrderedColumns.length) return;

    const headers = visibleOrderedColumns.map((c) => c.label);


    const rows = processedAlerts.map((alert) => {
      const cols = visibleOrderedColumns.map((col) => {
        const key = col.key;
        switch (key) {
          case 'incident_number': {
            return escapeCsv(alert.incident_number || '');
          }
          case 'panel_title':
            return escapeCsv(alert.panel_title || '');
          case 'application':
            return escapeCsv(alert.application || '');
          case 'message':
            return escapeCsv(alert.message || 'No message');
          case 'time_fired':
            return escapeCsv(formatHourAndDay(alert.time_fired) || '');
          case 'time_resolved':
            return escapeCsv(formatHourAndDay(alert.time_resolved) || '');
          case 'duration_sec':
            return escapeCsv(alert.duration_sec ?? '');
          case 'operator':
            return escapeCsv(alert.operator || 'System/Auto');
          case 'node_name':
            return escapeCsv(alert.node_name || '');
          case 'network':
            return escapeCsv(alert.network || '');
          case 'object':
            return escapeCsv(alert.object || '');
          case 'shift':
            return escapeCsv(alert.shift || '');
          default:
            return escapeCsv(alert[key] ?? '');
        }
      });
      return cols.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const dateStr = adjustedDateRange.start_date
      ? adjustedDateRange.start_date.split('T')[0]
      : 'filtered';
    const endDateStr = adjustedDateRange.end_date
      ? adjustedDateRange.end_date.split('T')[0]
      : '';

    a.download = `alerts_${dateStr}_to_${endDateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) =>
          value &&
          value !== '' &&
          value !== 'all' &&
          key !== 'sort_by' &&
          key !== 'sort_order' &&
          key !== 'page'
      ).length,
    [filters]
  );

  const clearAllFilters = () => {
    setFilters({
      search: '',
      panel_title: '',
      application: '',
      operator: '',
      duration_category: '',
      min_duration: '',
      max_duration: '',
      has_incident: '',
    });
  };

  if (error) {
    return <ErrorCallout message={error.message} details={error} />;
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                color: colors.text.primary,
              }}
            >
              Alert Explorer
            </h2>
            <p
              style={{
                fontSize: 14,
                color: colors.text.secondary,
                margin: '6px 0 0 0',
              }}
            >
              {loading
                ? 'Loading alerts…'
                : `${processedAlerts.length.toLocaleString()} ${processedAlerts.length === 1 ? 'alert' : 'alerts'
                } found`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <ColumnVisibilityPanel
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
            />

            <button
              onClick={refetch}
              disabled={loading}
              style={{
                ...S.button.secondary(loading),
                padding: '10px 16px',
              }}
            >
              <RefreshCw
                size={16}
                style={{
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span style={{ marginLeft: 8 }}>Refresh</span>
            </button>

            <button
              onClick={exportToCsv}
              disabled={!processedAlerts.length || !visibleOrderedColumns.length}
              style={{
                ...S.button.primary(!processedAlerts.length || !visibleOrderedColumns.length),
                padding: '10px 16px',
              }}
            >
              <Download size={16} />
              <span style={{ marginLeft: 8 }}>
                Export ({processedAlerts.length})
              </span>
            </button>
          </div>
        </div>

        {/* DATE RANGE */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
          />
        </div>

        {/* FILTERS CARD */}
        <div style={{ ...S.card(), marginBottom: 24, padding: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Filter size={18} style={{ color: colors.brand.primary }} />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: colors.text.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Filters
              </span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: colors.brand.primary,
                    color: '#FFFFFF',
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: `1px solid ${colors.border.primary}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: colors.text.secondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bg.tertiary;
                  e.currentTarget.style.color = colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = colors.text.secondary;
                }}
              >
                <X size={14} />
                Clear all
              </button>
            )}
          </div>

          {/* FILTER GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {/* Search in Messages */}
            <div style={{ gridColumn: 'span 1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Search Messages
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.text.tertiary,
                  }}
                />
                <input
                  type="text"
                  placeholder="Search in alert messages..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  style={{
                    ...S.input,
                    paddingLeft: 38,
                  }}
                />
              </div>
            </div>

            {/* Panel Title Dropdown */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Panel
              </label>
              <SearchableSelect
                value={filters.panel_title || ''}
                onChange={(val) => setFilters({ panel_title: val })}
                options={dropdownOptions.panels || []}
                placeholder="All Panels"
                loading={loading}
              />
            </div>

            {/* Application Dropdown */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Application
              </label>
              <SearchableSelect
                value={filters.application || ''}
                onChange={(val) => setFilters({ application: val })}
                options={dropdownOptions.applications || []}
                placeholder="All Applications"
                loading={loading}
              />
            </div>

            {/* Incident Status Dropdown */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Incident Status
              </label>
              <SearchableSelect
                value={filters.has_incident || ''}
                onChange={(val) => setFilters({ has_incident: val })}
                options={[
                  { value: '', label: 'All Alerts' },
                  { value: 'true', label: 'Linked to Incident' },
                  { value: 'false', label: 'No Incident' }
                ]}
                placeholder="All Alerts"
                loading={loading}
              />
            </div>

            {/* Operator Dropdown */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Operator
              </label>
              <SearchableSelect
                value={filters.operator || ''}
                onChange={(val) => setFilters({ operator: val })}
                options={dropdownOptions.operators || []}
                placeholder="All Operators"
                loading={loading}
              />
            </div>

            {/* Duration Category */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Duration
              </label>
              <SearchableSelect
                value={filters.duration_category || ''}
                onChange={(val) => setFilters({ duration_category: val })}
                options={dropdownOptions.durations || []}
                placeholder="All Durations"
                loading={loading}
              />
            </div>

            {/* Min/Max Duration */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.secondary,
                  marginBottom: 6,
                }}
              >
                Duration Range (seconds)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <LazyInput
                  type="number"
                  placeholder="Min"
                  value={filters.min_duration || ''}
                  min={0}
                  max={filters.max_duration ? Number(filters.max_duration) - 1 : undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    const max = Number(filters.max_duration);
                    if (val !== '' && max && Number(val) >= max) return; // min must be strictly < max
                    setFilters({ min_duration: val });
                  }}
                  style={{ ...S.input, flex: 1 }}
                />
                <span style={{ color: colors.text.tertiary }}>—</span>
                <LazyInput
                  type="number"
                  placeholder="Max"
                  value={filters.max_duration || ''}
                  min={filters.min_duration ? Number(filters.min_duration) + 1 : 1}
                  onChange={(e) => {
                    const val = e.target.value;
                    const min = Number(filters.min_duration);
                    if (val !== '' && Number(val) <= min) return; // max must be strictly > min
                    setFilters({ max_duration: val });
                  }}
                  style={{ ...S.input, flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>


        {/* RESULTS TABLE */}
        <div style={S.card()}>
          {loading ? (
            <div style={{ padding: 20 }}>
              <LoadingSkeleton width="100%" height={50} />
              {Array(10)
                .fill()
                .map((_, i) => (
                  <LoadingSkeleton
                    key={i}
                    width="100%"
                    height={70}
                    style={{ marginTop: 12 }}
                  />
                ))}
            </div>
          ) : (
            <>
              <AlertTable
                alerts={paginatedAlerts}
                visibleColumns={visibleOrderedColumns}
                sortConfig={{ sort_by: filters.sort_by, sort_order: filters.sort_order }}
                onSort={handleSort}
                colorByDuration={colorByDuration}
                colors={colors}
                renderShiftBadge={renderShiftBadge}
              />

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderTop: `1px solid ${colors.border.primary}`,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: colors.text.secondary,
                    }}
                  >
                    Showing{' '}
                    <span style={{ fontWeight: 700, color: colors.text.primary }}>
                      {startIndex + 1}
                    </span>{' '}
                    to{' '}
                    <span style={{ fontWeight: 700, color: colors.text.primary }}>
                      {endIndex}
                    </span>{' '}
                    of{' '}
                    <span style={{ fontWeight: 700, color: colors.text.primary }}>
                      {totalItems.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={goToPrevPage}
                      disabled={!hasPrev}
                      style={{
                        ...S.button.secondary(!hasPrev),
                        padding: '8px 16px',
                      }}
                    >
                      Previous
                    </button>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 16px',
                        fontSize: 14,
                        color: colors.text.secondary,
                      }}
                    >
                      Page{' '}
                      <span
                        style={{
                          fontWeight: 700,
                          marginInline: 6,
                          color: colors.text.primary,
                        }}
                      >
                        {currentPage}
                      </span>
                      of {totalPages}
                    </span>

                    <button
                      onClick={goToNextPage}
                      disabled={!hasNext}
                      style={{
                        ...S.button.secondary(!hasNext),
                        padding: '8px 16px',
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {processedAlerts.length === 0 && !loading && (
                <div
                  style={{
                    padding: 60,
                    background: colors.bg.secondary,
                    borderRadius: 12,
                    textAlign: 'center',
                    margin: 20,
                  }}
                >
                  <AlertCircle
                    size={56}
                    style={{
                      color: colors.text.tertiary,
                      marginBottom: 20,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      marginBottom: 10,
                      color: colors.text.primary,
                    }}
                  >
                    No alerts found
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: colors.text.secondary,
                      marginBottom: 20,
                    }}
                  >
                    Try adjusting your filters or date range to find more results.
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      style={{
                        ...S.button.primary(false),
                        padding: '10px 20px',
                      }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplorerPage;