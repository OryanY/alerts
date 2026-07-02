// pages/NOCDashboard.jsx — High-level dashboard for NOC operations
import { useMemo, useState, Suspense, useEffect } from 'react';
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
import { MetricCard } from '../components/ui/MetricCard';
import { Sparkline, RadialGauge, CompareBars } from '../components/ui/kpiViz';
import { ChartCard } from '../components/ui/ChartCard';
import { WakeupGauge } from '../components/ui/WakeupGauge';
import {
  AlertTriangle,
  Clock,
  Moon,
  Sun,
  TrendingUp,
  Shield,
  Network,
} from '../icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTopBar } from '../contexts/TopBarContext';
import SearchableSelect from '../components/common/SearchableSelect';

import { createChartConfig } from '../utils/chartConfig';
import { formatDuration } from '../utils/formatters';
import { asArray, getPrevPeriodText } from '../utils/dateUtils';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';

// Render a trend bucket's covered span as "X - Y" for the tooltip.
// date_il is the bucket START (day = that day, week = its Monday, month = the 1st).
const formatBucketRange = (d, granularity) => {
  const start = new Date(d);
  if (isNaN(start.getTime())) return d;
  const fmt = (dt) => dt.toLocaleDateString('en-IL', { month: 'short', day: 'numeric' });
  if (granularity === 'week') {
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Monday + 6 = Sunday
    return `${fmt(start)} - ${fmt(end)}`;
  }
  if (granularity === 'month') {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // last day of month
    return `${fmt(start)} - ${fmt(end)}`;
  }
  return start.toLocaleDateString('en-IL', { weekday: 'short', month: 'short', day: 'numeric' });
};

const NocDashboard = () => {

  const {
    config,
    dateRange,
    selectedPanel,
    setSelectedPanel,
  } = useClientConfig();

  const { Legend, getDurationColorFromBands } = useDurationBands(config);
  const { colors, styles: S } = useTheme(); // ✅ Get pre-computed styles

  // Calendar granularity for the "alerts over time" trend chart.
  const [trendGranularity, setTrendGranularity] = useState('day');
  const { setTopBarSlots, clearTopBarSlots } = useTopBar();
  const chartConfig = useMemo(() => createChartConfig(colors), [colors]);

  const panelListParams = useMemo(
    () => ({
      limit: 1000
    }),
    []
  );

  // ---- Data Fetching ----
  // useApiData automatically injects dateRange and getApiParams()
  const customParams = selectedPanel ? { panel_title: selectedPanel } : {};

  const exec = useApiData('/stats/executive-kpis', customParams);
  const shifts = useApiData('/stats/shift-analysis', customParams);
  const duration = useApiData('/stats/duration-histogram', customParams);
  const heatmap = useApiData('/stats/hourly-heatmap', customParams);
  const timeseries = useApiData('/stats/timeseries', { ...customParams, granularity: trendGranularity });

  const { data: panelsList } = useApiData('/stats/panels', panelListParams);
  // Always fetch detailed panel stats un-filtered, so the widget stays consistent
  const panelStats = useApiData('/stats/by-panel', { limit: 20 });
  // Memoize so asArray doesn't return a new reference on every render
  const panelOptions = useMemo(() => asArray(panelsList), [panelsList]);
  const panelSelectOptions = useMemo(
    () => panelOptions.map(p => ({
      value: p.panel_title,
      label: `${p.panel_title} (${p.alert_count}${p.pct_of_total != null ? ` · ${p.pct_of_total}%` : ''})`,
    })),
    [panelOptions]
  );
  const panelStatsRows = asArray(panelStats.data);
  const shiftRows = asArray(shifts.data);
  const durationRows = asArray(duration.data);
  const heatmapRows = asArray(heatmap.data);
  const timeseriesRows = asArray(timeseries.data);

  // Per-KPI viz inputs: alert-volume series (zero-filled) + day/night true splits.
  const alertCountSeries = useMemo(() => timeseriesRows.map((r) => r.alert_count || 0), [timeseriesRows]);
  const dayTrue = shiftRows.find((s) => s.shift === 'Day')?.true_alerts || 0;
  const nightTrue = shiftRows.find((s) => s.shift === 'Night')?.true_alerts || 0;

  // Calculate threshold in minutes for display
  const thresholdMinutes = Math.round((config.falseWakeupThreshold ?? DEFAULT_CLIENT_CFG.falseWakeupThreshold) / 60);

  const prevPeriodText = useMemo(() => getPrevPeriodText(dateRange), [dateRange]);

  const topBarSlots = useMemo(() => ({
    controls: (
      <div className="ops-topbar-control-group">
        <a
          href="/settings"
          className="ops-topbar-pill"
          style={{
            textDecoration: 'none',
            background: config.clusteringEnabled ? colors.semantic.successBg : colors.bg.tertiary,
            color: config.clusteringEnabled ? colors.semantic.successText : colors.text.secondary,
            border: `1px solid ${config.clusteringEnabled ? colors.semantic.success : colors.border.secondary}`,
          }}
          title={config.clusteringEnabled
            ? "Alerts are grouped by source and time - Click to change in Settings"
            : "Showing all individual alerts - Click to enable grouping in Settings"}
        >
          {config.clusteringEnabled ? 'Grouped' : 'All Alerts'}
        </a>
        <div style={{ width: 220 }}>
          <SearchableSelect
            options={panelSelectOptions}
            value={selectedPanel || ''}
            onChange={(val) => setSelectedPanel(val || null)}
            placeholder="All Panels"
          />
        </div>
      </div>
    ),
  }), [panelSelectOptions, selectedPanel, setSelectedPanel, config.clusteringEnabled, colors]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);
  return (
    <div>
      {/* Main Dashboard Grid */}
      <Suspense fallback={<div style={styles.suspenseFallback}><LoadingSpinner /></div>}>

        {/* KPI Cards */}
        <div style={{ ...S.grid('repeat(auto-fit, minmax(200px, 1fr))'), direction: 'rtl' }}>
          <MetricCard
            title="סך כל ההתראות"
            tooltip="סה״כ ההתראות שקפצו בטווח הזמן שנבחר."
            value={exec.data?.total_alerts ?? '—'}
            icon={AlertTriangle}
            logoColor="orange"
            loading={exec.loading}
            error={exec.error}
            trend={exec.data?.total_trend_pct}
            trendTooltip={`אינדיקציה למגמת עליה או ירידה בכמות ההתראות בהשוואה ל ${prevPeriodText}.`}
            invertTrend={true}
            viz={<Sparkline data={alertCountSeries} color={colors.chart.primary} />}
          />
          <MetricCard
            title="יחס התראות לפי זמנים"
            tooltip="יחס בין התראות ארוכות לקצרות. אחוז גבוה מצביע על פחות התראות קצרות)."
            value={`${exec.data?.signal_ratio ?? '—'}%`}
            subtitle="יחס התראות ארוכות לקצרות"
            icon={TrendingUp}
            logoColor="blue"
            loading={exec.loading}
            error={exec.error}
            viz={<RadialGauge value={exec.data?.signal_ratio || 0} color={colors.semantic.success} />}
          />
          <MetricCard
            title="התראות אמיתיות (לילה)"
            tooltip={`התראות במשמרת לילה שנמשכו מעל ${thresholdMinutes} דקות.`}
            value={exec.data?.true_wakeups ?? '—'}
            subtitle={`התראות שזמנן ≥ ${thresholdMinutes} ד' בלילה`}
            icon={Moon}
            logoColor="purple"
            loading={exec.loading}
            error={exec.error}
            viz={<CompareBars items={[
              { label: 'יום', value: dayTrue, color: colors.chart.primary },
              { label: 'לילה', value: nightTrue, color: colors.brand.purple },
            ]} />}
          />
          <MetricCard
            title="אחוז התראות שווא"
            tooltip={`אחוז ההתראות (יום + לילה) שהיו קצרות מ-${thresholdMinutes} דקות.`}
            value={`${exec.data?.false_positive_rate_247 ?? '—'}%`}
            subtitle={`התראות שזמנן ≤ ${thresholdMinutes} ד'`}
            icon={Shield}
            logoColor="red"
            loading={exec.loading}
            error={exec.error}
            trend={exec.data?.noise_trend_pct}
            trendTooltip={`אינדיקציה לשינוי באחוז התראות השווא בהשוואה ל ${prevPeriodText}.`}
            invertTrend={true}
            viz={<RadialGauge value={exec.data?.false_positive_rate_247 || 0} color={colors.semantic.warning} />}
          />

          <MetricCard
            title="משך זמן התראה (ממוצע | חציון)"
            tooltip="משך זמן התראה ממוצע לעומת חציון (טיפוסי)."
            value={`${formatDuration(exec.data?.avg_duration)} | ${formatDuration(exec.data?.median_duration)}`}
            icon={Clock}
            logoColor="green"
            loading={exec.loading}
            error={exec.error}
            viz={<CompareBars items={[
              { label: 'ממוצע', value: exec.data?.avg_duration || 0, color: colors.chart.primary },
              { label: 'חציון', value: exec.data?.median_duration || 0, color: colors.chart.secondary },
            ]} />}
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
              <BarChart data={shiftRows}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="shift" {...chartConfig.axis} />
                <YAxis {...chartConfig.axis} />
                <Tooltip {...chartConfig.tooltip} />
                <Bar
                  dataKey="true_alerts"
                  fill={colors.brand.primary}
                  radius={[4, 4, 0, 0]}
                  name="התראות אמת"
                />

                <Bar
                  dataKey="false_wakeups"
                  fill={colors.semantic.error}
                  radius={[4, 4, 0, 0]}
                  name="התראות שווא"
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
              <BarChart data={durationRows}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="range" {...chartConfig.axis} />
                <YAxis {...chartConfig.axis} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const entry = payload[0];
                      // get the bar color from getDurationColorFromBands
                      const barColor = getDurationColorFromBands(entry.payload, config.bands);
                      return (
                        <div style={{ ...chartConfig.tooltip.contentStyle }}>
                          <p style={{ margin: 0, color: colors.text.secondary, marginBottom: 4 }}>{label}</p>
                          <p style={{ margin: 0, color: barColor, fontWeight: 'bold' }}>
                            Count: {entry.value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  name="Count"
                >
                  {durationRows.map((entry, index) => (
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
            shiftData={shiftRows}
            loading={shifts.loading}
            error={shifts.error}
            falseWakeupThreshold={config.falseWakeupThreshold ?? DEFAULT_CLIENT_CFG.falseWakeupThreshold}
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
              <ComposedChart data={heatmapRows}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="hour_display" {...chartConfig.axis} />
                <YAxis yAxisId="left" {...chartConfig.axis} />
                <YAxis yAxisId="right" orientation="right" {...chartConfig.axis} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ ...chartConfig.tooltip.contentStyle }}>
                          <p style={{ margin: 0, color: colors.text.secondary, marginBottom: 4 }}>{label}</p>
                          {payload.map((entry, index) => {
                            const isCount = entry.dataKey === 'count';
                            const barColor = entry.payload?.is_night ? colors.brand.purple : colors.chart.primary;
                            const color = isCount ? barColor : entry.color;
                            const value = isCount ? entry.value : formatDuration(entry.value);
                            const name = isCount ? 'כמות' : (entry.dataKey === 'avg_duration' ? 'ממוצע' : 'חציון');
                            return (
                              <p key={index} style={{ margin: 0, color: color, fontWeight: 'bold' }}>
                                {name}: {value}
                              </p>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="count" name="כמות">
                  {heatmapRows.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry?.is_night ? colors.brand.purple : colors.chart.primary}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke={colors.chart.quaternary}
                  strokeWidth={2}
                  name="ממוצע"
                  dot={{ r: 4, fill: colors.chart.quaternary }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="median_duration"
                  stroke={colors.chart.secondary}
                  strokeWidth={2}
                  name="חציון"
                  dot={{ r: 4, fill: colors.chart.secondary }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Alert Sources List */}
          <ChartCard
            title="מקורות ההתראות המובילים"
            icon={Network}
            loading={panelStats.loading}
            error={panelStats.error}
          >
            <div style={styles.listContainer}>
              {panelStatsRows.slice(0, 12).map((p, idx) => {
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
                        {formatDuration(p.avg_duration)} ממוצע | {formatDuration(p.median_duration)} חציון
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>

        {/* Charts Row 3 */}
        <div style={S.grid('2fr 1fr')}>
          <ChartCard
            title="כמות התראות לאורך זמן + ממוצע זמן התראה"
            icon={TrendingUp}
            loading={timeseries.loading}
            error={timeseries.error}
            legend={
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'day', label: 'יום' },
                  { key: 'week', label: 'שבוע' },
                  { key: 'month', label: 'חודש' },
                ].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setTrendGranularity(o.key)}
                    style={{
                      padding: '2px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 6,
                      border: `1px solid ${colors.border.primary}`,
                      background: trendGranularity === o.key ? colors.chart.primary : colors.bg.tertiary,
                      color: trendGranularity === o.key ? '#fff' : colors.text.secondary,
                      fontWeight: trendGranularity === o.key ? 600 : 400,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeseriesRows}>
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
                  labelFormatter={(d) => formatBucketRange(d, trendGranularity)}
                  formatter={(value, name) => [
                    name.includes('Duration') ? formatDuration(value) : value,
                    name
                  ]}
                  itemSorter={(item) => {
                    if (item.dataKey === 'alert_count') return 1;
                    if (item.dataKey === 'false_alerts') return 2;
                    return 3;
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="alert_count"
                  fill={colors.chart.primary}
                  fillOpacity={0.2}
                  stroke={colors.chart.primary}
                  strokeWidth={2}
                  name="סה״כ התראות"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="false_alerts"
                  fill={colors.semantic.error}
                  fillOpacity={0.4}
                  stroke={colors.semantic.error}
                  strokeWidth={2}
                  name="התראות שווא"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke={colors.chart.tertiary}
                  strokeWidth={2}
                  name="ממוצע"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="median_duration"
                  stroke={colors.chart.secondary}
                  strokeWidth={2}
                  name="חציון"
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
