import  { useMemo, useEffect, useState, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  Columns,
} from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

import { useClientConfig } from '../contexts/ClientConfigContext';
import { useExplorerFilters } from '../hooks/useUrlState';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';

import { DateRangePicker } from '../components/DateRangePicker';
import { ErrorCallout } from '../components/ErrorCallout';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;

// Define all available columns
const ALL_COLUMNS = [
  { key: 'history_id', label: 'INC #', width: '100px', sortable: true, defaultVisible: true },
  { key: 'panel_title', label: 'Panel', width: '180px', sortable: true, defaultVisible: true },
  { key: 'application', label: 'Application', width: '140px', sortable: true, defaultVisible: true },
  { key: 'message', label: 'Message', width: '250px', sortable: false, defaultVisible: true },
  { key: 'time_fired', label: 'Time Fired', width: '140px', sortable: true, defaultVisible: true },
  { key: 'duration_sec', label: 'Duration', width: '110px', sortable: true, defaultVisible: true },
  { key: 'operator', label: 'Operator', width: '120px', sortable: true, defaultVisible: true },
  { key: 'node_name', label: 'Node', width: '120px', sortable: true, defaultVisible: false },
  { key: 'network', label: 'Network', width: '120px', sortable: true, defaultVisible: false },
  { key: 'object', label: 'Object', width: '120px', sortable: true, defaultVisible: false },
  { key: 'shift', label: 'Shift', width: '100px', sortable: true, defaultVisible: false },
  { key: 'time_resolved', label: 'Time Resolved', width: '140px', sortable: true, defaultVisible: false },
];

// Helpers
const getDefaultVisibleColumns = () => {
  const initial = {};
  ALL_COLUMNS.forEach((col) => {
    initial[col.key] = col.defaultVisible;
  });
  return initial;
};

const formatIncidentId = (historyId) => {
  if (historyId === null || historyId === undefined) return null;
  return String(historyId).trim() || null;
};

// Custom Select Component
const CustomSelect = ({ value, onChange, options, placeholder, disabled, colors }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: colors.bg.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 8,
          fontSize: 14,
          color: value ? colors.text.primary : colors.text.tertiary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) =>
          !disabled && (e.currentTarget.style.borderColor = colors.border.secondary)
        }
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border.primary)}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          style={{
            marginLeft: 8,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: colors.bg.elevated,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: 8,
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: colors.shadow.lg,
          }}
        >
          {options.length > 8 && (
            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.border.primary}` }}>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: colors.bg.secondary,
                  border: `1px solid ${colors.border.primary}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: colors.text.primary,
                  outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ padding: '4px' }}>
            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: value === opt.value ? colors.brand.primary + '15' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  color: value === opt.value ? colors.brand.primary : colors.text.primary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: value === opt.value ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = colors.bg.tertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: colors.text.tertiary,
                  fontSize: 13,
                }}
              >
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Column Visibility Panel
const ColumnVisibilityPanel = ({ visibleColumns, onToggle, colors }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px',
          background: colors.bg.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 8,
          fontSize: 14,
          color: colors.text.primary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = colors.border.secondary;
          e.currentTarget.style.background = colors.bg.tertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border.primary;
          e.currentTarget.style.background = colors.bg.secondary;
        }}
      >
        <Columns size={16} />
        <span>Columns ({visibleCount})</span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: colors.bg.elevated,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: 8,
            minWidth: 250,
            maxHeight: 400,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: colors.shadow.lg,
            padding: 8,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.border.primary}`,
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 13,
              color: colors.text.secondary,
            }}
          >
            Select Columns to Display
          </div>
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bg.tertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <input
                type="checkbox"
                checked={visibleColumns[col.key]}
                onChange={() => onToggle(col.key)}
                style={{
                  width: 18,
                  height: 18,
                  cursor: 'pointer',
                  accentColor: colors.brand.primary,
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  color: colors.text.primary,
                  flex: 1,
                }}
              >
                {col.label}
              </span>
              {visibleColumns[col.key] ? (
                <Eye size={14} style={{ color: colors.brand.primary }} />
              ) : (
                <EyeOff size={14} style={{ color: colors.text.tertiary }} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const ExplorerPage = () => {
  const { config, getApiParams, dateRange, setDateRange, setPresetRange } = useClientConfig();
  const { colors } = useTheme();
  const S = useMemo(() => createThemedStyles(colors), [colors]);
  const { filters, setFilters, setPage } = useExplorerFilters();
  const { colorByDuration } = useDurationBands(config);

  // -------- DATE RANGE NORMALIZATION --------
  const adjustedDateRange = useMemo(() => {
    if (
      dateRange.start_date &&
      dateRange.end_date &&
      dateRange.start_date === dateRange.end_date
    ) {
      return {
        start_date: dateRange.start_date,
        end_date: `${dateRange.end_date}T23:59:59`,
      };
    }
    return dateRange;
  }, [dateRange]);

  // -------- FILTERS + DEBOUNCE --------
  const rawPage = Number(filters.page) || 1;
  const { page: _omitPage, ...filtersNoPage } = filters;

  const [debouncedFilters, setDebouncedFilters] = useState(filtersNoPage);
  const debounceIdRef = useRef(null);

  const filtersKey = useMemo(() => JSON.stringify(filtersNoPage), [filtersNoPage]);

  useEffect(() => {
    if (debounceIdRef.current) {
      clearTimeout(debounceIdRef.current);
    }

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
  }, [filtersKey, setPage]);

  // -------- API PARAMS --------
  const apiParams = useMemo(() => {
    const f = debouncedFilters || {};
    const normalizedSortOrder = (f.sort_order || 'desc').toString().toUpperCase();

    const serverFilters = {};
    const serverSideFields = ['panel_title', 'application', 'operator', 'min_duration', 'max_duration'];

    serverSideFields.forEach((field) => {
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
      limit: 1000,
    };
  }, [debouncedFilters, adjustedDateRange, getApiParams]);

  // -------- DATA FETCH --------
  const { data: alerts, loading, error, refetch } = useApiData('/alerts', apiParams);

  // -------- DROPDOWN OPTIONS --------
  const dropdownOptions = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return {};

    const uniquePanels = [...new Set(alerts.map((a) => a.panel_title).filter(Boolean))].sort();
    const uniqueApps = [...new Set(alerts.map((a) => a.application).filter(Boolean))].sort();
    const uniqueOperators = [...new Set(alerts.map((a) => a.operator).filter(Boolean))].sort();

    return {
      panels: [
        { value: '', label: 'All Panels' },
        ...uniquePanels.map((p) => ({ value: p, label: p })),
      ],
      applications: [
        { value: '', label: 'All Applications' },
        ...uniqueApps.map((a) => ({ value: a, label: a })),
      ],
      operators: [
        { value: '', label: 'All Operators' },
        ...uniqueOperators.map((o) => ({ value: o, label: o })),
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
  }, [alerts, config.bands]);

  // -------- CLIENT-SIDE FILTERING + SORTING --------
  const processedAlerts = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return [];
    const f = debouncedFilters || {};
    let filtered = [...alerts];

    // Search in messages
    if (f.search) {
      const q = String(f.search).toLowerCase();
      filtered = filtered.filter((a) => (a.message || '').toLowerCase().includes(q));
    }

    // Duration category filter
    if (f.duration_category) {
      const cat = String(f.duration_category);
      filtered = filtered.filter((a) => {
        const d = Number(a.duration_sec) || 0;
        if (cat === 'short') return d <= (config.bands?.[0]?.max || 59);
        if (cat === 'medium')
          return d >= (config.bands?.[1]?.min || 60) && d <= (config.bands?.[1]?.max || 299);
        if (cat === 'long') return d >= (config.bands?.[2]?.min || 300);
        return true;
      });
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
  }, [alerts, debouncedFilters, config.bands]);

  // -------- PAGINATION --------
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

  // -------- COLUMN VISIBILITY (WITH PERSISTENCE) --------
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          'alertExplorer.visibleColumns',
          JSON.stringify(visibleColumns)
        );
      } catch {
        // ignore
      }
    }
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

  // -------- SORT HANDLER --------
  const handleSort = (key) => {
    const col = ALL_COLUMNS.find((c) => c.key === key);
    if (!col || !col.sortable) return;

    const newOrder =
      filters.sort_by === key && filters.sort_order === 'asc' ? 'desc' : 'asc';

    setFilters({ sort_by: key, sort_order: newOrder });
    setPage(1);
  };

  // -------- FORMATTERS --------
  const formatHourAndDay = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
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

  // -------- CSV EXPORT (RESPECTS VISIBLE COLUMNS) --------
  const exportToCsv = () => {
    if (!processedAlerts.length || !visibleOrderedColumns.length) return;

    const headers = visibleOrderedColumns.map((c) => c.label);

    const escapeCsv = (val) => {
      const s = String(val ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = processedAlerts.map((alert) => {
      const cols = visibleOrderedColumns.map((col) => {
        const key = col.key;
        switch (key) {
          case 'history_id': {
            const formatted = formatIncidentId(alert.history_id);
            return escapeCsv(formatted || '');
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

  // -------- ACTIVE FILTER COUNT --------
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
    });
  };

  if (error) {
    return <ErrorCallout message={error.message} details={error} />;
  }

  // -------- RENDER --------
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* HEADER */}
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
                : `${processedAlerts.length.toLocaleString()} ${
                    processedAlerts.length === 1 ? 'alert' : 'alerts'
                  } found`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <ColumnVisibilityPanel
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
              colors={colors}
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
              <CustomSelect
                value={filters.panel_title || ''}
                onChange={(val) => setFilters({ panel_title: val })}
                options={dropdownOptions.panels || []}
                placeholder="All Panels"
                disabled={loading}
                colors={colors}
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
              <CustomSelect
                value={filters.application || ''}
                onChange={(val) => setFilters({ application: val })}
                options={dropdownOptions.applications || []}
                placeholder="All Applications"
                disabled={loading}
                colors={colors}
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
              <CustomSelect
                value={filters.operator || ''}
                onChange={(val) => setFilters({ operator: val })}
                options={dropdownOptions.operators || []}
                placeholder="All Operators"
                disabled={loading}
                colors={colors}
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
              <CustomSelect
                value={filters.duration_category || ''}
                onChange={(val) => setFilters({ duration_category: val })}
                options={dropdownOptions.durations || []}
                placeholder="All Durations"
                disabled={loading}
                colors={colors}
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
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.min_duration || ''}
                  onChange={(e) => setFilters({ min_duration: e.target.value })}
                  style={{ ...S.input, flex: 1 }}
                />
                <span style={{ color: colors.text.tertiary }}>—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.max_duration || ''}
                  onChange={(e) => setFilters({ max_duration: e.target.value })}
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
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                    minWidth: 1100,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: colors.bg.tertiary,
                        borderBottom: `2px solid ${colors.border.secondary}`,
                      }}
                    >
                      {visibleOrderedColumns.map(({ key, label, width }) => {
                        const isSorted = filters.sort_by === key;
                        const colDef = ALL_COLUMNS.find((c) => c.key === key);
                        const sortable = colDef?.sortable;

                        return (
                          <th
                            key={key}
                            onClick={() => sortable && handleSort(key)}
                            style={{
                              padding: '14px 16px',
                              textAlign: 'left',
                              fontWeight: 700,
                              fontSize: 12,
                              color: isSorted ? colors.brand.primary : colors.text.secondary,
                              cursor: sortable ? 'pointer' : 'default',
                              background: isSorted
                                ? colors.brand.primary + '10'
                                : colors.bg.tertiary,
                              width,
                              position: 'sticky',
                              top: 0,
                              zIndex: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {label}
                              {isSorted && sortable && (
                                <span style={{ fontSize: 11 }}>
                                  {filters.sort_order === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAlerts.map((alert, i) => (
                      <tr
                        key={alert.history_id || i}
                        style={{
                          borderBottom: `1px solid ${colors.border.primary}`,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = colors.bg.tertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {visibleOrderedColumns.map((col) => {
                          const key = col.key;

                          if (key === 'history_id') {
                            const formatted = formatIncidentId(alert.history_id);
                            return (
                              <td
                                key={key}
                                style={{
                                  padding: '16px',
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: colors.text.primary,
                                }}
                              >
                                {formatted ? (
                                  formatted
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (key === 'panel_title') {
                            const value = alert.panel_title;
                            return (
                              <td
                                key={key}
                                style={{
                                  padding: '16px',
                                  color: colors.text.primary,
                                }}
                                title={value || ''}
                              >
                                {value ? (
                                  <div
                                    style={{
                                      maxWidth: 180,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {value}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    No panel
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (key === 'application') {
                            const value = alert.application;
                            return (
                              <td
                                key={key}
                                style={{ padding: '16px', color: colors.text.secondary }}
                              >
                                {value ? (
                                  value
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    No application
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (key === 'message') {
                            const message = alert.message;
                            const hasMessage = !!message;
                            return (
                              <td
                                key={key}
                                style={{
                                  padding: '16px',
                                  color: hasMessage
                                    ? colors.text.secondary
                                    : colors.text.tertiary,
                                  fontSize: 13,
                                }}
                                title={hasMessage ? message : 'No message'}
                              >
                                {hasMessage ? (
                                  <div
                                    style={{
                                      maxWidth: 350,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {message}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    No message
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (key === 'time_fired' || key === 'time_resolved') {
                            const value = key === 'time_fired' ? alert.time_fired : alert.time_resolved;
                            const formatted = formatHourAndDay(value);
                            return (
                              <td
                                key={key}
                                style={{
                                  padding: '16px',
                                  fontSize: 13,
                                  fontFamily: 'monospace',
                                  color: colors.text.primary,
                                }}
                              >
                                {formatted || (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          }

                          if (key === 'duration_sec') {
                            const d = alert.duration_sec;
                            if (d === null || d === undefined || d === '') {
                              return (
                                <td key={key} style={{ padding: '16px' }}>
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    —
                                  </span>
                                </td>
                              );
                            }
                            const color = colorByDuration(d);
                            return (
                              <td key={key} style={{ padding: '16px' }}>
                                <span
                                  style={{
                                    background: color + '20',
                                    color,
                                    padding: '6px 12px',
                                    borderRadius: 16,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'inline-block',
                                  }}
                                >
                                  {d}s
                                </span>
                              </td>
                            );
                          }

                          if (key === 'operator') {
                            const value = alert.operator || 'System';
                            return (
                              <td
                                key={key}
                                style={{ padding: '16px', color: colors.text.secondary }}
                              >
                                {value}
                              </td>
                            );
                          }

                          if (key === 'shift') {
                            return (
                              <td key={key} style={{ padding: '16px' }}>
                                {renderShiftBadge(alert.shift)}
                              </td>
                            );
                          }

                          if (key === 'node_name' || key === 'network' || key === 'object') {
                            const value = alert[key];
                            return (
                              <td
                                key={key}
                                style={{ padding: '16px', color: colors.text.secondary }}
                                title={value || ''}
                              >
                                {value ? (
                                  <div
                                    style={{
                                      maxWidth: 180,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {value}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: colors.text.tertiary,
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          }

                          // Fallback for any other columns
                          const generic = alert[key];
                          return (
                            <td
                              key={key}
                              style={{ padding: '16px', color: colors.text.secondary }}
                            >
                              {generic ?? (
                                <span
                                  style={{
                                    fontStyle: 'italic',
                                    color: colors.text.tertiary,
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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


