import { Suspense, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Cell,
  Area,
  ComposedChart,
} from 'recharts';

import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DateRangePicker } from '../components/DateRangePicker';
import { MetricCard } from '../components/MetricCard';
import { ChartCard } from '../components/ChartCard';
import { WakeupGauge } from '../components/WakeupGauge';
import {
  AlertTriangle,
  Clock,
  Moon,
  Sun,
  TrendingUp,
  Shield,
  Network,
  Filter,
  X,
} from '../icons';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const NocDashboard = () => {
  const {
    config,
    getApiParams,
    dateRange,
    setDateRange,
    setPresetRange,
    selectedPanel,
    setSelectedPanel,
  } = useClientConfig();

  const { Legend } = useDurationBands(config);
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  // ---- helpers ----

  const formatDateIso = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const chartGridProps = {
    stroke: colors.border.secondary,
    strokeDasharray: '3 3',
  };

  const xAxisProps = {
    tick: { fill: colors.text.secondary, fontSize: 12 },
    axisLine: { stroke: colors.border.primary },
    tickLine: { stroke: colors.border.primary },
  };

  const yAxisProps = {
    tick: { fill: colors.text.secondary, fontSize: 12 },
    axisLine: { stroke: colors.border.primary },
    tickLine: { stroke: colors.border.primary },
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: colors.bg.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 6,
      color: colors.text.primary,
      fontSize: 12,
    },
    labelStyle: {
      color: colors.text.secondary,
    },
    itemStyle: {
      fontSize: 12,
    },
  };

  const adjustedDateRange = useMemo(() => {
    if (
      dateRange.start_date &&
      dateRange.end_date &&
      dateRange.start_date === dateRange.end_date
    ) {
      const start = formatDateIso(dateRange.start_date);
      const end = formatDateIso(`${dateRange.end_date}T23:59:59`);
      return {
        start_date: start,
        end_date: end,
      };
    }

    return {
      start_date: formatDateIso(dateRange.start_date),
      end_date: formatDateIso(dateRange.end_date),
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

  // Fetch data
  const exec = useApiData('/stats/executive-kpis', apiParams);
  const shifts = useApiData('/stats/shift-analysis', apiParams);
  const duration = useApiData('/stats/duration-histogram', apiParams);
  const heatmap = useApiData('/stats/hourly-heatmap', apiParams);
  const panelStats = useApiData(
    '/stats/by-panel',
    selectedPanel ? null : { ...apiParams, limit: 20 }
  );
  const timeseries = useApiData('/stats/timeseries', apiParams);
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
        {/* Date Range + Panel Filter */}
        <div style={{ flex: '1 1 auto', minWidth: 300 }}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
            rightSlot={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Panel Filter Select */}
                <div style={{ position: 'relative' }}>
                  <Filter
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.text.secondary,
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
                      background: selectedPanel
                        ? colors.semantic.infoBg
                        : colors.bg.secondary,
                      borderColor: selectedPanel
                        ? colors.semantic.info
                        : colors.border.secondary,
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

                {/* Clear panel filter */}
                {selectedPanel && (
                  <button
                    onClick={() => setSelectedPanel(null)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',

                      background: colors.bg.secondary,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: colors.semantic.error,
                      color: colors.semantic.error,
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
            background: colors.semantic.infoBg,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: colors.semantic.info,
            borderRadius: 8,
          }}
        >
          <div
            dir="rtl"
            style={{ display: 'flex', gap: 8, alignItems: 'center', color: colors.semantic.infoText }}
          >
            <Filter size={16} style={{ color: colors.semantic.info }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              נתונים לפי <strong>{selectedPanel}</strong>
            </span>
            <button
              onClick={() => setSelectedPanel(null)}
              style={{
                marginInlineStart: 12,
                padding: '4px 12px',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,

                background: colors.semantic.info,
                color: colors.text.inverse,
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
            value={`${exec.data?.avg_duration ?? '—'} ש'`}
            icon={Clock}
            color="green"
          />
        </div>

        {/* Charts Row 1 */}
        <div style={S.grid('1fr 1fr 1fr')}>
          {/* Shifts bar chart */}
          <ChartCard
            title="התראות בוקר לעומת לילה"
            icon={Sun}
            loading={shifts.loading}
            error={shifts.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shifts.data || []}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="shift" {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="alert_count"
                  fill={colors.chart.primary}
                  radius={[4, 4, 0, 0]}
                  name="Alert Count"
                />
                <Bar
                  dataKey="false_wakeups"
                  fill={colors.chart.quinary}
                  radius={[4, 4, 0, 0]}
                  name="False Wakeups"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Duration histogram */}
          <ChartCard
            title="התפלגות משכי התראות"
            icon={Clock}
            legend={<Legend />}
            loading={duration.loading}
            error={duration.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={duration.data || []}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="range" {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="count"
                  fill={colors.chart.tertiary}
                  radius={[4, 4, 0, 0]}
                  name="Count"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Wakeup gauge */}
          <WakeupGauge
            shiftData={shifts.data}
            loading={shifts.loading}
            error={shifts.error}
            falseWakeupThreshold={config.falseWakeupThreshold || 120}
          />
        </div>

        {/* Charts Row 2 */}
        <div style={S.grid('2fr 1fr')}>
          {/* Hourly heatmap / composed */}
          <ChartCard
            title="פילוח התראות לפי שעות"
            icon={Clock}
            loading={heatmap.loading}
            error={heatmap.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={heatmap.data || []}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="hour_display" {...xAxisProps} />
                <YAxis yAxisId="left" {...yAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...yAxisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar yAxisId="left" dataKey="count" name="Count">
                  {(heatmap.data || []).map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry?.is_night
                          ? colors.brand.secondary
                          : colors.chart.primary
                      }
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke={colors.chart.quaternary}
                  strokeWidth={2}
                  dot={{ fill: colors.chart.quaternary, r: 3 }}
                  name="Avg Duration"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Alert Sources – hidden when filtered */}
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
                {(panelStats.data || []).slice(0, 12).map((p, idx) => {
                  const isTop = idx < 3;
                  return (
                    <div
                      key={`${p.panel_title}-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: 6,
                        cursor: 'pointer',

                        background: isTop
                          ? colors.semantic.errorBg
                          : colors.bg.tertiary,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: isTop
                          ? colors.semantic.error
                          : colors.border.primary,
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
                            color: colors.text.primary,
                          }}
                        >
                          {p.panel_title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.text.secondary,
                          }}
                        >
                          {p.application}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: 8 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: colors.text.primary,
                          }}
                        >
                          {p.alert_count}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: colors.text.secondary,
                          }}
                        >
                          {p.avg_duration}s avg
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="date_il"
                  {...xAxisProps}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString('en-IL', {
                      timeZone: 'Asia/Jerusalem',
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <YAxis yAxisId="left" {...yAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...yAxisProps} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(d) =>
                    new Date(d).toLocaleDateString('en-IL', {
                      timeZone: 'Asia/Jerusalem',
                    })
                  }
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="alert_count"
                  fill={colors.chart.primary}
                  fillOpacity={0.3}
                  stroke={colors.chart.primary}
                  strokeWidth={2}
                  name="Alert Count"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke={colors.chart.tertiary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors.chart.tertiary }}
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
            background: colors.bg.overlay,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              ...S.card(),
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              maxWidth: 320,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: colors.border.secondary,
                borderTopColor: colors.brand.primary,
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ color: colors.text.primary, fontSize: 14 }}>
              Loading dashboard data…
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NocDashboard;
