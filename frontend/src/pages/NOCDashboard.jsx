import { Suspense, useMemo, useCallback } from 'react';
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
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { MetricCard } from '../components/ui/MetricCard';
import { ChartCard } from '../components/ui/ChartCard';
import { WakeupGauge } from '../components/dashboard/WakeupGauge';
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

import { createChartConfig } from '../utils/chartConfig';
import { formatDuration } from '../utils/helpers';

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

  const { Legend, getDurationColorFromBands } = useDurationBands(config);
  const { colors, styles: S } = useTheme(); // ✅ Get pre-computed styles
  const chartConfig = useMemo(() => createChartConfig(colors), [colors]);


  // No need to format dates - backend handles Israeli timezone conversion
  const adjustedDateRange = dateRange;

  const apiParams = useMemo(() => {
    const params = {
      ...adjustedDateRange,
      false_wakeup_threshold: config.falseWakeupThreshold || 120,
      ...getApiParams(),
    };

    if (selectedPanel) {
      params.panel_title = selectedPanel;
    }

    return params;
  }, [adjustedDateRange, config.falseWakeupThreshold, getApiParams, selectedPanel]);

  const panelListParams = useMemo(
    () => ({
      ...adjustedDateRange,
      ...getApiParams(),
      limit: 1000
    }),
    [adjustedDateRange, getApiParams]
  );

  // ---- Data Fetching ----
  const exec = useApiData('/stats/executive-kpis', apiParams);
  const shifts = useApiData('/stats/shift-analysis', apiParams);
  const duration = useApiData('/stats/duration-histogram', apiParams);
  const heatmap = useApiData('/stats/hourly-heatmap', apiParams);
  const timeseries = useApiData('/stats/timeseries', apiParams);

  const { data: panelsList } = useApiData('/stats/panels', panelListParams);
  // Only fetch detailed panel stats if we are not filtered by a specific panel
  const panelStats = useApiData('/stats/by-panel', selectedPanel ? null : { ...apiParams, limit: 20 });

  // Handlers
  const handleClearPanel = useCallback(() => setSelectedPanel(null), [setSelectedPanel]);
  const handlePanelChange = useCallback((e) => setSelectedPanel(e.target.value || null), [setSelectedPanel]);


  return (
    <div>
      <div style={styles.headerContainer}>
        <div style={styles.controlsWrapper}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
            rightSlot={
              <div style={styles.filterGroup}>
                {/* Panel Filter Select */}
                <div style={styles.selectWrapper}>
                  <Filter
                    size={16}
                    style={{ ...styles.filterIcon, color: colors.text.secondary }}
                  />
                  <select
                    value={selectedPanel || ''}
                    onChange={handlePanelChange}
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

                {/* Clear panel filter button */}
                {selectedPanel && (
                  <button
                    onClick={handleClearPanel}
                    style={{
                      ...styles.clearButton,
                      background: colors.bg.secondary,
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
            border: `2px solid ${colors.semantic.info}`,
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
              onClick={handleClearPanel}
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

      {/* Main Dashboard Grid */}
      <Suspense fallback={<div style={styles.suspenseFallback}><LoadingSpinner /></div>}>

        {/* KPI Cards */}
        <div style={{ ...S.grid('repeat(auto-fit, minmax(200px, 1fr))'), direction: 'rtl' }}>
          <MetricCard
            title="סך כל ההתראות"
            value={exec.data?.total_alerts ?? '—'}
            icon={AlertTriangle}
            logoColor="orange"
            loading={exec.loading}
            trend={exec.data?.total_trend_pct}
            invertTrend={true}
          />
          <MetricCard
            title="יחס התראות לפי זמנים"
            value={`${exec.data?.signal_ratio ?? '—'}%`}
            subtitle="יחס התראות ארוכות לקצרות"
            icon={TrendingUp}
            logoColor="blue"
            loading={exec.loading}
          />
          <MetricCard
            title="התראות אמיתיות"
            value={exec.data?.true_wakeups ?? '—'}
            subtitle={`התראות שזמנן ≥ ${config.falseWakeupThreshold || 120} ש' בלילה`}
            icon={Moon}
            logoColor="purple"
            loading={exec.loading}
          />
          <MetricCard
            title="אחוז התראות שווא"
            value={`${exec.data?.false_wakeup_rate ?? '—'}%`}
            subtitle={`התראות שזמנן ≤ ${config.falseWakeupThreshold || 120} ש' בלילה`}
            icon={Shield}
            logoColor="red"
            loading={exec.loading}
            trend={exec.data?.noise_trend_pct}
            invertTrend={true}
          />

          <MetricCard
            title={config.durationMetric === 'average' ? 'ממוצע זמן התראה' : 'חציון זמן התראה'}
            value={formatDuration(config.durationMetric === 'average' ? exec.data?.avg_duration : exec.data?.median_duration)}
            icon={Clock}
            logoColor="green"
            loading={exec.loading}
          />
        </div>

        {/* Charts Row 1 */}
        <div style={S.grid('1fr 1fr 1fr')}>
          <ChartCard
            title="התראות בוקר לעומת לילה"
            icon={Sun}
            loading={shifts.loading}
            error={shifts.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shifts.data || []}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="shift" {...chartConfig.axis} />
                <YAxis {...chartConfig.axis} />
                <Tooltip {...chartConfig.tooltip} />
                <Bar
                  dataKey="alert_count"
                  fill={colors.brand.primary}
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

          <ChartCard
            title="התפלגות משכי התראות"
            icon={Clock}
            legend={<Legend />}
            loading={duration.loading}
            error={duration.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={duration.data || []}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="range" {...chartConfig.axis} />
                <YAxis {...chartConfig.axis} />
                <Tooltip {...chartConfig.tooltip} />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  name="Count"
                >
                  {(duration.data || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getDurationColorFromBands(entry, config.bands)}
                    />
                  ))}
                </Bar>
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
          <ChartCard
            title="פילוח התראות לפי שעות"
            icon={Clock}
            loading={heatmap.loading}
            error={heatmap.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={heatmap.data || []}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="hour_display" {...chartConfig.axis} />
                <YAxis yAxisId="left" {...chartConfig.axis} />
                <YAxis yAxisId="right" orientation="right" {...chartConfig.axis} />
                <Tooltip {...chartConfig.tooltip} />
                <Bar yAxisId="left" dataKey="count" name="Count">
                  {(heatmap.data || []).map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry?.is_night ? colors.brand.purple : colors.chart.primary}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  stroke={colors.chart.quaternary}
                  strokeWidth={2}
                  name={config.durationMetric === 'average' ? 'Average Duration' : 'Median Duration'}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Alert Sources List */}
          {!selectedPanel && (
            <ChartCard
              title="Top Alert Sources"
              icon={Network}
              loading={panelStats.loading}
              error={panelStats.error}
            >
              <div style={styles.listContainer}>
                {(panelStats.data || []).slice(0, 12).map((p, idx) => {
                  const isTop = idx < 3;
                  return (
                    <div
                      key={`${p.panel_title}-${idx}`}
                      style={{
                        ...styles.listItem,
                        background: isTop ? colors.semantic.errorBg : colors.bg.tertiary,
                        borderColor: isTop ? colors.semantic.error : colors.border.primary,
                      }}
                      onClick={() => setSelectedPanel(p.panel_title)}
                      title="Click to filter dashboard by this panel"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...styles.listItemTitle, color: colors.text.primary }}>
                          {p.panel_title}
                        </div>
                        <div style={{ fontSize: 11, color: colors.text.secondary }}>
                          {p.application}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: colors.text.primary }}>
                          {p.alert_count}
                        </div>
                        <div style={{ fontSize: 10, color: colors.text.secondary }}>
                          {formatDuration(p.avg_duration)} avg
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
                <CartesianGrid {...chartConfig.grid} />
                <XAxis
                  dataKey="date_il"
                  {...chartConfig.axis}
                  tickFormatter={(d) => {
                    try {
                      return new Date(d).toLocaleDateString('en-IL', { month: 'short', day: 'numeric' });
                    } catch {
                      return d;
                    }
                  }}
                />
                <YAxis yAxisId="left" {...chartConfig.axis} />
                <YAxis yAxisId="right" orientation="right" {...chartConfig.axis} />
                <Tooltip
                  {...chartConfig.tooltip}
                  labelFormatter={(d) => {
                    try {
                      return new Date(d).toLocaleDateString('en-IL', { weekday: 'short', month: 'short', day: 'numeric' });
                    } catch {
                      return d;
                    }
                  }}
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
                  name={config.durationMetric === 'average' ? 'Average Duration' : 'Median Duration'}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Suspense>
    </div>
  );
};

// Static styles
const styles = {
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  controlsWrapper: {
    flex: '1 1 auto',
    minWidth: 300
  },
  filterGroup: {
    display: 'flex',
    gap: 8,
    alignItems: 'center'
  },
  selectWrapper: {
    position: 'relative'
  },
  filterIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  clearButton: {
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  suspenseFallback: {
    width: '100%',
    height: 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContainer: {
    maxHeight: 300,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    cursor: 'pointer',
    borderWidth: 1,
    borderStyle: 'solid',
    transition: 'background-color 0.2s'
  },
  listItemTitle: {
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
};

export default NocDashboard;