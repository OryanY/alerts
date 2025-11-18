import { Suspense, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Cell, Area, ComposedChart
} from 'recharts';

import { S } from '../utils/styles';

import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DateRangePicker } from '../components/DateRangePicker';
import { MetricCard } from '../components/MetricCard';
import { ChartCard } from '../components/ChartCard';
import { WakeupGauge } from '../components/WakeupGauge';
import { AlertTriangle, Clock, Moon, Sun, TrendingUp, Shield, Network, Filter, X } from '../icons';

const NocDashboard = () => {
  const {
    config,
    getApiParams,
    dateRange,
    setDateRange,
    setPresetRange,
    selectedPanel,
    setSelectedPanel
  } = useClientConfig();

  const { Legend } = useDurationBands(config);

const adjustedDateRange = useMemo(() => {
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Convert to ISO string in UTC
    return date.toISOString();
  };

  if (
    dateRange.start_date &&
    dateRange.end_date &&
    dateRange.start_date === dateRange.end_date
  ) {
    const start = formatDate(dateRange.start_date);
    const end = formatDate(`${dateRange.end_date}T23:59:59`);
    return {
      start_date: start,
      end_date: end,
    };
  }

  return {
    start_date: formatDate(dateRange.start_date),
    end_date: formatDate(dateRange.end_date),
  };
}, [dateRange]);

  // Build API params with optional panel filter
  const apiParams = useMemo(() => {
    const params = {
      
      ...(adjustedDateRange.start_date && { start_date: adjustedDateRange.start_date }),
      ...(adjustedDateRange.end_date && { end_date: adjustedDateRange.end_date }),
      false_wakeup_threshold: config.falseWakeupThreshold || 120,
      ...getApiParams(),
    };

    if (selectedPanel) {
      params.panel_title = selectedPanel;
    }

    return params;
  }, [adjustedDateRange, config.falseWakeupThreshold, getApiParams, selectedPanel]);
  
  // Fetch panel list for dropdown (without panel filter)
  const panelListParams = useMemo(
    () => ({
      ...(adjustedDateRange.start_date && { start_date: adjustedDateRange.start_date }),
      ...(adjustedDateRange.end_date && { end_date: adjustedDateRange.end_date }),
      ...getApiParams(),
    }),
    [adjustedDateRange, getApiParams]
  );
  
  // Fetch data with panel filter applied
  const exec = useApiData('/stats/executive-kpis', apiParams);
  const shifts = useApiData('/stats/shift-analysis', apiParams);
  const duration = useApiData('/stats/duration-histogram', apiParams);
  const heatmap = useApiData('/stats/hourly-heatmap', apiParams);
  const panelStats = useApiData(
    '/stats/by-panel',
    selectedPanel ? null : { ...apiParams, limit: 20 }
  );

  const timeseries = useApiData('/stats/timeseries', apiParams);
  const overview = useApiData('/stats/overview', apiParams);

  const { data: panelsList } = useApiData('/stats/panels', panelListParams);

  const isLoading = exec.loading || shifts.loading || duration.loading || heatmap.loading;

  return (
    <div>
      {/* Header Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Date Range Picker */}
        <div style={{ flex: '1 1 auto', minWidth: 300 }}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
            /* Panel Filter DropDown */
            rightSlot={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Filter
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#6B7280',
                      pointerEvents: 'none',
                    }}
                  />
                  <select
                    value={selectedPanel || ''}
                    onChange={(e) => setSelectedPanel(e.target.value || null)}
                    style={{
                      ...S.select,
                      paddingLeft: 36,
                      minWidth: 200,
                      background: selectedPanel ? '#EBF8FF' : 'white',
                      borderColor: selectedPanel ? '#3B82F6' : '#D1D5DB',
                      fontWeight: selectedPanel ? 600 : 400,
                    }}
                  >
                    <option value="">All Panels</option>
                    {(panelsList || []).map((panel) => (
                      <option key={panel.panel_title} value={panel.panel_title}>
                        {panel.panel_title} ({panel.alert_count})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPanel && (
                  <button
                    onClick={() => setSelectedPanel(null)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #DC2626',
                      borderRadius: 6,
                      background: 'white',
                      color: '#DC2626',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Clear panel filter"
                  >
                    <X size={16} />
                    Clear
                  </button>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* Active Filter Indicator */}
      {selectedPanel && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            background: '#EBF8FF',
            border: '2px solid #3B82F6',
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <div dir="rtl" style={{ display: 'flex', gap: 8}}>
            <Filter size={16} style={{ color: '#1E40AF' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>
              נתונים לפי <strong>{selectedPanel}</strong>
            </span>
            <button
              onClick={() => setSelectedPanel(null)}
              style={{
                marginInlineStart: 12,
                padding: '4px 12px',
                border: 'none',
                borderRadius: 4,
                background: '#1E40AF',
                color: 'white',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              View All Panels
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={<LoadingSpinner />}>
        {/* KPI Cards */}
        <div style={{ ...S.grid('repeat(auto-fit, minmax(200px, 1fr))'), direction: 'rtl' }}>
          <MetricCard
            title="סך כל ההתראות"
            value={exec.data?.total_alerts ?? '—'}
            icon={AlertTriangle}
            color="orange"
          />
          <MetricCard
            title="יחס התראות לפי זמנים"
            value={`${exec.data?.signal_ratio ?? '—'}%`}
            subtitle="יחס התראות ארוכות לקצרות"
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="התראות אמיתיות"
            value={exec.data?.true_wakeups ?? '—'}
            subtitle={`התראות שזמנן ≤ ${config.falseWakeupThreshold || 120} ש' בלילה`}
            icon={Moon}
            color="purple"
          />
          <MetricCard
            title="אחוז התראות שווא"
            value={`${exec.data?.false_wakeup_rate ?? '—'}%`}
            subtitle={`התראות שזמנן ≤ ${config.falseWakeupThreshold || 120} ש' בלילה`}
            icon={Shield}
            color="red"
          />
          <MetricCard
            title="ממוצע זמן התראה"
            value={`${overview.data?.avg_duration ?? '—'} ש'`}
            icon={Clock}
            color="green"
          />
        </div>

        {/* Charts Row 1 */}
        <div style={S.grid('1fr 1fr 1fr')}>
          <ChartCard title="התראות בוקר לעומת לילה" icon={Sun} loading={shifts.loading} error={shifts.error}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shifts.data || []} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shift" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="alert_count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Alert Count" />
                <Bar dataKey="false_wakeups" fill="#EF4444" radius={[4, 4, 0, 0]} name="False Wakeups" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="התפלגות משכי התראות"
            icon={Clock}
            legend={<Legend />}
            loading={duration.loading}
            error={duration.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={duration.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <WakeupGauge
            shiftData={shifts.data}
            loading={shifts.loading}
            error={shifts.error}
            falseWakeupThreshold={config.falseWakeupThreshold || 120}
          />
        </div>

        {/* Charts Row 2 */}
        <div style={S.grid('2fr 1fr')}>
          <ChartCard title="פילוח התראות לפי שעות" icon={Clock} loading={heatmap.loading} error={heatmap.error}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={heatmap.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour_display" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="count" name="Count">
                  {(heatmap.data || []).map((entry, idx) => (
                    <Cell key={idx} fill={entry?.is_night ? '#8B5CF6' : '#3B82F6'} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', r: 3 }}
                  name="Avg Duration"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Hidden when selectedPanel is truthy */}
          {!selectedPanel && (
            <ChartCard
              title="Top Alert Sources"
              icon={Network}
              loading={panelStats.loading}
              error={panelStats.error}
            >
              <div
                style={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {(panelStats.data || []).slice(0, 12).map((p, idx) => (
                  <div
                    key={`${p.panel_title}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 10,
                      background: idx < 3 ? '#FEF2F2' : '#F9FAFB',
                      borderRadius: 6,
                      border: `1px solid ${idx < 3 ? '#FCA5A5' : '#F3F4F6'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedPanel(p.panel_title)}
                    title="Click to filter dashboard by this panel"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.panel_title}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{p.application}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.alert_count}</div>
                      <div style={{ fontSize: 10, color: '#6B7280' }}>{p.avg_duration}s avg</div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>

        {/* Charts Row 3 */}
        <div style={S.grid('2fr 1fr')}>
          <ChartCard
            title="כמות התראות לאורך זמן + ממוצע זמן התראה"
            icon={TrendingUp}
            loading={timeseries.loading}
            error={timeseries.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeseries.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date_il"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString('en-IL', {
                      timeZone: 'Asia/Jerusalem',
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString('en-IL')} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="alert_count"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Alert Count"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Avg Duration"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Suspense>

      {/* Global Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: '2px solid #E5E7EB',
                borderTop: '2px solid #3B82F6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>Loading dashboard data…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NocDashboard;
