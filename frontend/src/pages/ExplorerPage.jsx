import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, RefreshCw, X, AlertCircle } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useTopBar } from '../contexts/TopBarContext';
import { useExplorerFilters } from '../hooks/useUrlState';
import { useDurationBands } from '../hooks/useDurationBands';
import { fetchApi, buildApiUrl } from '../utils/api';

import { LazyInput } from '../components/ui/LazyInput';
import { ErrorCallout } from '../components/ui/ErrorCallout';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import SearchableSelect from '../components/common/SearchableSelect';
import { ColumnVisibilityPanel, getDefaultVisibleColumns, getAllColumns } from '../components/layout/ColumnVisibilityPanel';
import { AlertTable } from '../components/dashboard/AlertTable';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 50;
const ALL_COLUMNS = getAllColumns();

const buildServerFilters = (filters, config) => {
  const normalizedSortOrder = (filters.sort_order || 'desc').toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const serverFilters = {};

  ['panel_title', 'application', 'operator', 'object', 'has_incident'].forEach((field) => {
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

  const alertsQuery = useQuery({
    queryKey: ['alerts-page', pageParams],
    queryFn: ({ signal }) => fetchApi('/alerts', pageParams, { signal }),
    placeholderData: (previous) => previous,
  });

  const countQuery = useQuery({
    queryKey: ['alerts-count', countParams],
    queryFn: ({ signal }) => fetchApi('/alerts', countParams, { signal }),
    enabled: Boolean(alertsQuery.data) && !alertsQuery.isFetching,
    placeholderData: (previous) => previous,
    staleTime: 15 * 1000,
  });

  const filterParams = useMemo(
    () => filters.panel_title ? { panel_title: filters.panel_title } : {},
    [filters.panel_title]
  );
  const filterOptionsQuery = useQuery({
    queryKey: ['alert-filter-options', filterParams],
    queryFn: ({ signal }) => fetchApi('/stats/filter-options', filterParams, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  });

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

    return {
      panels: [{ value: '', label: 'All Panels' }, ...panels.map((p) => ({ value: p, label: p }))],
      applications: [
        { value: '', label: filters.panel_title ? 'All Applications in Panel' : 'All Applications' },
        ...apps.map((a) => ({ value: a, label: a })),
      ],
      operators: [
        { value: '', label: filters.panel_title ? 'All Operators in Panel' : 'All Operators' },
        ...operators.map((o) => ({ value: o, label: o })),
      ],
      objects: [
        { value: '', label: filters.panel_title ? 'All Objects in Panel' : 'All Objects' },
        ...objects.map((o) => ({ value: o, label: o })),
      ],
      durations: [
        { value: '', label: 'All Durations' },
        { value: 'short', label: `Short <=${config.bands?.[0]?.max || 59}s` },
        { value: 'medium', label: `Medium ${config.bands?.[1]?.min || 60}-${config.bands?.[1]?.max || 299}s` },
        { value: 'long', label: `Long >=${config.bands?.[2]?.min || 300}s` },
      ],
    };
  }, [filterOptionsQuery.data, filters.panel_title, config.bands]);

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

  const visibleOrderedColumns = useMemo(
    () => ALL_COLUMNS.filter((column) => visibleColumns[column.key]),
    [visibleColumns]
  );

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
        <ColumnVisibilityPanel visibleColumns={visibleColumns} onToggle={handleToggleColumn} />
        <button onClick={() => refetchAlerts()} disabled={isAlertsFetching} style={S.button.secondary(isAlertsFetching)}>
          <RefreshCw size={15} style={{ animation: isAlertsFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button onClick={exportToCsv} disabled={!alerts.length} style={S.button.primary(!alerts.length)}>
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
    refetchAlerts,
    isAlertsFetching,
    S.button,
    alerts.length,
    exportToCsv,
  ]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);

  if (alertsQuery.error && !alertsQuery.data) {
    return <ErrorCallout message={alertsQuery.error.message} details={alertsQuery.error} />;
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/*
              {countQuery.isFetching && <span style={{ color: colors.text.tertiary }}> · counting</span>}
              {isRefreshing && <span style={{ color: colors.text.tertiary }}> · refreshing</span>}
        */}
        <section style={{ ...S.card({ padding: 12 }), marginBottom: 12 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Search Messages
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.text.tertiary }} />
                <input
                  type="text"
                  placeholder="Message text"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  style={{ ...S.input, paddingLeft: 32 }}
                />
              </div>
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Panel
              <SearchableSelect value={filters.panel_title || ''} onChange={(val) => setFilters({ panel_title: val })} options={dropdownOptions.panels} placeholder="All Panels" />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Application
              <SearchableSelect value={filters.application || ''} onChange={(val) => setFilters({ application: val })} options={dropdownOptions.applications} placeholder="All Applications" />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Incident
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
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Operator
              <SearchableSelect value={filters.operator || ''} onChange={(val) => setFilters({ operator: val })} options={dropdownOptions.operators} placeholder="All Operators" />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Object
              <SearchableSelect value={filters.object || ''} onChange={(val) => setFilters({ object: val })} options={dropdownOptions.objects} placeholder="All Objects" />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Duration
              <SearchableSelect value={filters.duration_category || ''} onChange={(val) => setFilters({ duration_category: val })} options={dropdownOptions.durations} placeholder="All Durations" />
            </label>

            <div style={{ display: 'grid', gap: 6, fontSize: 12, color: colors.text.secondary, fontWeight: 700 }}>
              Duration Seconds
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                <LazyInput
                  type="number"
                  placeholder="Min"
                  value={filters.min_duration || ''}
                  min={0}
                  onChange={(e) => setFilters({ min_duration: e.target.value })}
                  style={S.input}
                />
                <LazyInput
                  type="number"
                  placeholder="Max"
                  value={filters.max_duration || ''}
                  min={0}
                  onChange={(e) => setFilters({ max_duration: e.target.value })}
                  style={S.input}
                />
                <button
                  onClick={clearAllFilters}
                  disabled={!activeFilterCount}
                  title="Clear filters"
                  style={{ ...S.button.secondary(!activeFilterCount), padding: '0 10px', height: 36 }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {alertsQuery.error && alertsQuery.data && (
          <div style={{ ...S.error, marginBottom: 12 }}>
            {alertsQuery.error.message}
          </div>
        )}

        <section style={{ ...S.card({ padding: 0, overflow: 'hidden' }), position: 'relative' }}>
          {isInitialLoading ? (
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
