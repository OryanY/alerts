import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, RefreshCw, X, AlertCircle, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useTopBar } from '../contexts/TopBarContext';
import { useExplorerFilters } from '../hooks/useUrlState';
import { useDurationBands } from '../hooks/useDurationBands';
import { fetchApi, buildApiUrl } from '../utils/api';
import { ALL_PANELS } from '../utils/constants';
import { LazyInput } from '../components/ui/LazyInput';
import { ErrorCallout } from '../components/ui/ErrorCallout';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import SearchableSelect from '../components/common/SearchableSelect';
import { ColumnVisibilityPanel, getDefaultVisibleColumns, getAllColumns } from '../components/layout/ColumnVisibilityPanel';
import { AlertTable } from '../components/ui/AlertTable';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;
const ALL_COLUMNS = getAllColumns();

const buildServerFilters = (filters, config) => {
  const normalizedSortOrder = (filters.sort_order || 'desc').toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const isAllPanels = filters.panel_title === ALL_PANELS;
  const serverFilters = {};
  // A specific panel filters server-side. "All panels" sends no panel_title (so
  // the query spans every panel) and forces a flat list: clustering across all
  // panels is the expensive path and isn't meaningful for a global browse.
  if (filters.panel_title && !isAllPanels) serverFilters.panel_title = filters.panel_title;
  if (isAllPanels) serverFilters.clustering_enabled = false;
  ['application', 'operator', 'object', 'has_incident', 'shift', 'node_name', 'network'].forEach((field) => {
    if (filters[field] !== undefined && filters[field] !== '') {
      serverFilters[field] = filters[field];
    }
  });
  const minDur = filters.min_duration ? parseFloat(filters.min_duration) : null;
  const maxDur = filters.max_duration ? parseFloat(filters.max_duration) : null;
  if (minDur !== null && !Number.isNaN(minDur) && (maxDur === null || Number.isNaN(maxDur) || minDur <= maxDur)) {
    serverFilters.min_duration = filters.min_duration;
  }
  if (maxDur !== null && !Number.isNaN(maxDur) && (minDur === null || Number.isNaN(minDur) || minDur <= maxDur)) {
    serverFilters.max_duration = filters.max_duration;
  }
  if (filters.duration_category) {
    if (filters.duration_category === 'short') {
      serverFilters.max_duration = config.bands?.[0]?.max || 59;
    } else if (filters.duration_category === 'medium') {
      serverFilters.min_duration = config.bands?.[1]?.min || 60;
      serverFilters.max_duration = config.bands?.[1]?.max || 299;
    } else if (filters.duration_category === 'long') {
      serverFilters.min_duration = config.bands?.[2]?.min || 300;
    }
  }
  if (filters.search) {
    serverFilters.search = filters.search;
  }
  return {
    ...serverFilters,
    sort_by: filters.sort_by || 'time_fired',
    sort_order: normalizedSortOrder,
  };
};

const ExplorerPage = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { config, dateRange, getApiParams } = useClientConfig();
  const { colors, styles: S } = useTheme();
  const { setTopBarSlots, clearTopBarSlots } = useTopBar();
  const { filters, setFilters, setPage } = useExplorerFilters();
  const { colorByDuration } = useDurationBands(config);

  const rawPage = Number(filters.page) || 1;
  const { page: _omitPage, ...filtersNoPage } = filters;
  const filtersKey = useMemo(() => JSON.stringify(filtersNoPage), [filtersNoPage]);
  const [debouncedFilters, setDebouncedFilters] = useState(filtersNoPage);
  const debounceIdRef = useRef(null);
  const didDebounceRef = useRef(false);

  useEffect(() => {
    if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
    debounceIdRef.current = setTimeout(() => {
      setDebouncedFilters(JSON.parse(filtersKey));
      if (didDebounceRef.current) {
        setPage(1);
      } else {
        didDebounceRef.current = true;
      }
      debounceIdRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceIdRef.current) {
        clearTimeout(debounceIdRef.current);
        debounceIdRef.current = null;
      }
    };
  }, [filtersKey, setPage]);

  const globalParams = useMemo(() => getApiParams(), [getApiParams]);
  const serverFilters = useMemo(
    () => buildServerFilters(debouncedFilters || {}, config),
    [debouncedFilters, config]
  );

  const baseQueryParams = useMemo(() => ({
    ...dateRange,
    ...globalParams,
    ...serverFilters,
  }), [dateRange, globalParams, serverFilters]);

  const pageParams = useMemo(() => ({
    ...baseQueryParams,
    page: rawPage,
    limit: PAGE_SIZE,
    include_count: false,
  }), [baseQueryParams, rawPage]);

  const countParams = useMemo(() => ({
    ...baseQueryParams,
    page: 1,
    limit: 1,
    include_count: true,
  }), [baseQueryParams]);

  const hasPanelSelected = Boolean(filters.panel_title);
  const isAllPanels = filters.panel_title === ALL_PANELS;

  const alertsQuery = useQuery({
    queryKey: ['alerts-page', pageParams],
    queryFn: ({ signal }) => fetchApi('/alerts', pageParams, { signal }),
    enabled: hasPanelSelected,
    placeholderData: (previous, previousQuery) => {
      const prevParams = previousQuery?.queryKey?.[1];
      if (prevParams && prevParams.panel_title === pageParams.panel_title) {
        return previous;
      }
      return undefined;
    },
  });

  const countQuery = useQuery({
    queryKey: ['alerts-count', countParams],
    queryFn: ({ signal }) => fetchApi('/alerts', countParams, { signal }),
    // Skip the exact count for "all panels": counting every row/cluster is the
    // expensive part, so the footer falls back to hasNext-based navigation.
    enabled: hasPanelSelected && !isAllPanels && Boolean(alertsQuery.data) && !alertsQuery.isFetching,
    placeholderData: (previous, previousQuery) => {
      const prevParams = previousQuery?.queryKey?.[1];
      if (prevParams && prevParams.panel_title === countParams.panel_title) {
        return previous;
      }
      return undefined;
    },
    staleTime: 15 * 1000,
  });

  const filterParams = useMemo(
    () => (filters.panel_title && filters.panel_title !== ALL_PANELS) ? { panel_title: filters.panel_title } : {},
    [filters.panel_title]
  );

  const filterOptionsQuery = useQuery({
    queryKey: ['alert-filter-options', filterParams],
    queryFn: ({ signal }) => fetchApi('/stats/filter-options', filterParams, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  });

  const panelIsLoading = filterOptionsQuery.isPending;

  const alerts = alertsQuery.data?.data || [];
  const pagination = alertsQuery.data?.meta?.pagination || {};
  const exactTotal = countQuery.isPlaceholderData ? undefined : countQuery.data?.meta?.pagination?.total;
  const hasNext = Boolean(pagination.hasNext);
  const isInitialLoading = alertsQuery.isPending && !alertsQuery.data;
  const isRefreshing = alertsQuery.isFetching && !!alertsQuery.data;
  const isAlertsFetching = alertsQuery.isFetching;
  const refetchAlerts = alertsQuery.refetch;

  const dropdownOptions = useMemo(() => {
    const data = filterOptionsQuery.data?.data || {};
    const panels = data.panels || [];
    const apps = data.applications || [];
    const operators = data.operators || [];
    const objects = data.objects || [];
    const nodes = data.nodes || [];
    const networks = data.networks || [];

    return {
      panels: [{ value: ALL_PANELS, label: 'All panels' }, ...panels.map((p) => ({ value: p, label: p }))],
      applications: [
        { value: '', label: 'All Applications' },
        ...apps.map((a) => ({ value: a, label: a })),
      ],
      operators: [
        { value: '', label: 'All Operators' },
        ...operators.map((o) => ({ value: o, label: o })),
      ],
      objects: [
        { value: '', label: 'All Objects' },
        ...objects.map((o) => ({ value: o, label: o })),
      ],
      nodes: [
        { value: '', label: 'All Nodes' },
        ...nodes.map((n) => ({ value: n, label: n })),
      ],
      networks: [
        { value: '', label: 'All Networks' },
        ...networks.map((n) => ({ value: n, label: n })),
      ],
      durations: [
        { value: '', label: 'All Durations' },
        { value: 'short', label: `Short <=${config.bands?.[0]?.max || 59}s` },
        { value: 'medium', label: `Medium ${config.bands?.[1]?.min || 60}-${config.bands?.[1]?.max || 299}s` },
        { value: 'long', label: `Long >=${config.bands?.[2]?.min || 300}s` },
      ],
    };
  }, [filterOptionsQuery.data, config.bands]);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('alertExplorer.visibleColumns');
        if (stored) return { ...getDefaultVisibleColumns(), ...JSON.parse(stored) };
      } catch {
        // ignore
      }
    }
    return getDefaultVisibleColumns();
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('alertExplorer.columnOrder');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    return ALL_COLUMNS.map((c) => c.key);
  });

  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem('alertExplorer.visibleColumns', JSON.stringify(visibleColumns));
      } catch {
        // ignore
      }
    }, 100);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [visibleColumns]);

  const saveOrderTimeoutRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (saveOrderTimeoutRef.current) clearTimeout(saveOrderTimeoutRef.current);
    saveOrderTimeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem('alertExplorer.columnOrder', JSON.stringify(columnOrder));
      } catch {
        // ignore
      }
    }, 100);
    return () => {
      if (saveOrderTimeoutRef.current) clearTimeout(saveOrderTimeoutRef.current);
    };
  }, [columnOrder]);

  const handleReorderColumn = useCallback((key, direction) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key);
      if (index === -1) return prev;
      const newOrder = [...prev];
      if (direction === 'up' && index > 0) {
        [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      } else if (direction === 'down' && index < prev.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      }
      return newOrder;
    });
  }, []);

  const visibleOrderedColumns = useMemo(() => {
    const mapped = columnOrder
      .map((key) => ALL_COLUMNS.find((c) => c.key === key))
      .filter(Boolean);
    const missing = ALL_COLUMNS.filter((c) => !columnOrder.includes(c.key));
    const fullOrder = [...mapped, ...missing];
    return fullOrder.filter((column) => visibleColumns[column.key]);
  }, [columnOrder, visibleColumns]);

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) =>
      value &&
      value !== '' &&
      value !== 'all' &&
      key !== 'sort_by' &&
      key !== 'sort_order' &&
      key !== 'page'
    ).length,
    [filters]
  );

  const activeAdvancedFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) =>
      value &&
      value !== '' &&
      value !== 'all' &&
      key !== 'sort_by' &&
      key !== 'sort_order' &&
      key !== 'page' &&
      key !== 'search' &&
      key !== 'panel_title'
    ).length,
    [filters]
  );

  const handleToggleColumn = useCallback((key) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  }, []);

  const handleSort = (key) => {
    const col = ALL_COLUMNS.find((c) => c.key === key);
    if (!col?.sortable) return;
    const newOrder = filters.sort_by === key && filters.sort_order === 'asc' ? 'desc' : 'asc';
    setFilters({ sort_by: key, sort_order: newOrder });
    setPage(1);
  };

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
      shift: '',
      node_name: '',
      network: '',
      object: '',
    });
  };

  const renderShiftBadge = (shiftValue) => {
    if (!shiftValue) return <span style={{ color: colors.text.tertiary }}>-</span>;
    const normalized = String(shiftValue).toLowerCase();
    const color = normalized.includes('night') ? colors.semantic.warning : colors.semantic.success;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 4,
        background: `${color}18`,
        color,
        fontSize: 12,
        fontWeight: 700,
      }}>
        {shiftValue}
      </span>
    );
  };

  const exportToCsv = useCallback(() => {
    window.location.assign(buildApiUrl('/alerts/export.csv', baseQueryParams));
  }, [baseQueryParams]);

  const startIndex = alerts.length ? (rawPage - 1) * PAGE_SIZE + 1 : 0;
  const endIndex = alerts.length ? startIndex + alerts.length - 1 : 0;
  const totalPages = exactTotal ? Math.max(1, Math.ceil(exactTotal / PAGE_SIZE)) : null;
  const canGoPrev = rawPage > 1;
  const canGoNext = totalPages ? rawPage < totalPages : hasNext;

  const explorerStatus = isInitialLoading
    ? 'Loading alerts'
    : exactTotal !== undefined
      ? `${exactTotal.toLocaleString()} matching alerts`
      : `Showing ${alerts.length.toLocaleString()} alerts`;

  const topBarSlots = useMemo(() => ({
    status: (
      <>
        {explorerStatus}
        {countQuery.isFetching && <span style={{ color: colors.text.tertiary }}> · counting</span>}
        {isRefreshing && <span style={{ color: colors.text.tertiary }}> · refreshing</span>}
      </>
    ),
    actions: (
      <>
        <ColumnVisibilityPanel
          visibleColumns={visibleColumns}
          onToggle={handleToggleColumn}
          columnOrder={columnOrder}
          onReorder={handleReorderColumn}
        />
        <button onClick={() => refetchAlerts()} disabled={isAlertsFetching || !hasPanelSelected} style={S.button.secondary(isAlertsFetching || !hasPanelSelected)}>
          <RefreshCw size={15} style={{ animation: isAlertsFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button onClick={exportToCsv} disabled={!alerts.length || !hasPanelSelected} style={S.button.primary(!alerts.length || !hasPanelSelected)}>
          <Download size={15} />
          Export CSV
        </button>
      </>
    ),
  }), [
    explorerStatus,
    countQuery.isFetching,
    colors.text.tertiary,
    isRefreshing,
    visibleColumns,
    handleToggleColumn,
    columnOrder,
    handleReorderColumn,
    refetchAlerts,
    isAlertsFetching,
    S.button,
    alerts.length,
    exportToCsv,
    hasPanelSelected,
  ]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);

  if (alertsQuery.error && !alertsQuery.data) {
    return <ErrorCallout message={alertsQuery.error.message} details={alertsQuery.error} />;
  }

  const renderPanelSelectPrompt = () => (
    <div style={{
      padding: 44,
      textAlign: 'center',
      color: colors.text.secondary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <LayoutGrid size={48} style={{ color: colors.text.tertiary }} />
      <div style={{ fontWeight: 700, color: colors.text.primary, fontSize: 16 }}>Select a Panel</div>
      <div style={{ fontSize: 13 }}>Choose a panel above to view alerts.</div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.container}>
        <section style={{ ...S.card({ padding: 16, borderRadius: 10 }), marginBottom: 12 }}>
          {/* Primary Filter Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            {/* Search messages input */}
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: colors.text.tertiary }} />
              <input
                type="text"
                placeholder="Search alert messages..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ search: e.target.value })}
                style={{
                  ...S.input,
                  minHeight: 44,
                  borderRadius: 8,
                  border: `1px solid ${colors.border.primary}`,
                  background: colors.bg.primary,
                  paddingLeft: 38,
                  fontSize: 14,
                }}
              />
            </div>

            {/* Primary Panel dropdown */}
            <div style={{ flex: '0 1 240px', minWidth: 200 }}>
              <SearchableSelect
                value={filters.panel_title || ''}
                onChange={(val) => setFilters({ panel_title: val })}
                options={dropdownOptions.panels}
                placeholder={panelIsLoading ? 'Loading panels...' : 'Select a panel'}
                isLoading={panelIsLoading}
              />
            </div>

            {/* Advanced Filters Trigger Button */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                ...S.button.secondary(),
                height: 44,
                borderRadius: 8,
                padding: '0 16px',
                borderColor: showAdvanced ? colors.brand.primary : colors.border.primary,
                background: showAdvanced ? colors.brand.primary + '0f' : colors.bg.secondary,
                color: showAdvanced ? colors.brand.primary : colors.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <SlidersHorizontal size={14} />
              <span>More Filters</span>
              {activeAdvancedFilterCount > 0 && (
                <span style={{
                  background: colors.brand.primary,
                  color: colors.text.inverse,
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Clear All Filters Button */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                style={{
                  ...S.button.secondary(),
                  height: 44,
                  borderRadius: 8,
                  padding: '0 14px',
                  color: colors.semantic.error,
                  borderColor: colors.border.primary,
                  background: colors.bg.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Expandable Advanced Filters Grid */}
          {showAdvanced && (
            <div style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${colors.border.primary}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
              alignItems: 'end',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Application
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.application || ''}
                    onChange={(val) => setFilters({ application: val })}
                    options={dropdownOptions.applications}
                    placeholder="All Applications"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Node
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.node_name || ''}
                    onChange={(val) => setFilters({ node_name: val })}
                    options={dropdownOptions.nodes}
                    placeholder="All Nodes"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Network
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.network || ''}
                    onChange={(val) => setFilters({ network: val })}
                    options={dropdownOptions.networks}
                    placeholder="All Networks"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Object
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.object || ''}
                    onChange={(val) => setFilters({ object: val })}
                    options={dropdownOptions.objects}
                    placeholder="All Objects"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operator
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.operator || ''}
                    onChange={(val) => setFilters({ operator: val })}
                    options={dropdownOptions.operators}
                    placeholder="All Operators"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Duration
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.duration_category || ''}
                    onChange={(val) => setFilters({ duration_category: val })}
                    options={dropdownOptions.durations}
                    placeholder="All Durations"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shift
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.shift || ''}
                    onChange={(val) => setFilters({ shift: val })}
                    options={[
                      { value: '', label: 'All Shifts' },
                      { value: 'day', label: 'Day' },
                      { value: 'night', label: 'Night' },
                    ]}
                    placeholder="All Shifts"
                  />
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Incident
                <div style={{ position: 'relative' }}>
                  <SearchableSelect
                    value={filters.has_incident || ''}
                    onChange={(val) => setFilters({ has_incident: val })}
                    options={[
                      { value: '', label: 'All Alerts' },
                      { value: 'true', label: 'Linked' },
                      { value: 'false', label: 'No Incident' },
                    ]}
                    placeholder="All Alerts"
                  />
                </div>
              </label>

              <div style={{ display: 'grid', gap: 6, fontSize: 11, color: colors.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Duration (seconds)
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <LazyInput
                    type="number"
                    placeholder="Min"
                    value={filters.min_duration || ''}
                    min={0}
                    onChange={(e) => setFilters({ min_duration: e.target.value })}
                    style={{
                      ...S.input,
                      minHeight: 44,
                      borderRadius: 8,
                      border: `1px solid ${colors.border.primary}`,
                      background: colors.bg.primary,
                      fontSize: 14,
                    }}
                  />
                  <LazyInput
                    type="number"
                    placeholder="Max"
                    value={filters.max_duration || ''}
                    min={0}
                    onChange={(e) => setFilters({ max_duration: e.target.value })}
                    style={{
                      ...S.input,
                      minHeight: 44,
                      borderRadius: 8,
                      border: `1px solid ${colors.border.primary}`,
                      background: colors.bg.primary,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {alertsQuery.error && alertsQuery.data && (
          <div style={{ ...S.error, marginBottom: 12 }}>
            {alertsQuery.error.message}
          </div>
        )}

        <section style={{ ...S.card({ padding: 0, overflow: 'hidden' }), position: 'relative' }}>
          {!hasPanelSelected ? (
            renderPanelSelectPrompt()
          ) : isInitialLoading ? (
            <div style={{ padding: 16 }}>
              <LoadingSkeleton width="100%" height={44} />
              {Array(10).fill().map((_, i) => (
                <LoadingSkeleton key={i} width="100%" height={48} style={{ marginTop: 8 }} />
              ))}
            </div>
          ) : (
            <>
              {isRefreshing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  left: 0,
                  height: 2,
                  background: colors.brand.primary,
                  zIndex: 20,
                }} />
              )}
              <AlertTable
                alerts={alerts}
                visibleColumns={visibleOrderedColumns}
                sortConfig={{ sort_by: filters.sort_by, sort_order: filters.sort_order }}
                onSort={handleSort}
                colorByDuration={colorByDuration}
                colors={colors}
                renderShiftBadge={renderShiftBadge}
              />
              {alerts.length === 0 && (
                <div style={{ padding: 44, textAlign: 'center', color: colors.text.secondary }}>
                  <AlertCircle size={32} style={{ marginBottom: 12, color: colors.text.tertiary }} />
                  <div style={{ fontWeight: 700, color: colors.text.primary, marginBottom: 4 }}>No alerts found</div>
                  <div style={{ fontSize: 13 }}>Adjust filters or date range.</div>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: `1px solid ${colors.border.primary}`,
                color: colors.text.secondary,
                fontSize: 13,
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  {alerts.length
                    ? `Showing ${startIndex.toLocaleString()}-${endIndex.toLocaleString()}${exactTotal !== undefined ? ` of ${exactTotal.toLocaleString()}` : ''}`
                    : 'No rows'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setPage(rawPage - 1)} disabled={!canGoPrev} style={S.button.secondary(!canGoPrev)}>
                    Previous
                  </button>
                  <span style={{ minWidth: 120, textAlign: 'center' }}>
                    Page <strong style={{ color: colors.text.primary }}>{rawPage}</strong>
                    {totalPages ? ` of ${totalPages}` : ''}
                  </span>
                  <button onClick={() => setPage(rawPage + 1)} disabled={!canGoNext} style={S.button.secondary(!canGoNext)}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ExplorerPage;