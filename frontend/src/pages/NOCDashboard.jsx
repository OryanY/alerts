// pages/NOCDashboard.jsx — High-level dashboard for NOC operations
import { useMemo, Suspense, useEffect } from 'react';
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
} from '../icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTopBar } from '../contexts/TopBarContext';
import SearchableSelect from '../components/common/SearchableSelect';

import { createChartConfig } from '../utils/chartConfig';
import { formatDuration } from '../utils/formatters';

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
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
  const timeseries = useApiData('/stats/timeseries', customParams);

  const { data: panelsList } = useApiData('/stats/panels', panelListParams);
  // Always fetch detailed panel stats un-filtered, so the widget stays consistent
  const panelStats = useApiData('/stats/by-panel', { limit: 20 });
  const panelOptions = asArray(panelsList);
  const panelStatsRows = asArray(panelStats.data);
  const shiftRows = asArray(shifts.data);
  const durationRows = asArray(duration.data);
  const heatmapRows = asArray(heatmap.data);
  const timeseriesRows = asArray(timeseries.data);

  // Calculate threshold in minutes for display
  const thresholdMinutes = Math.round((config.falseWakeupThreshold || 120) / 60);

  // Calculate previous period for tooltips
  const prevPeriodText = useMemo(() => {
    if (!dateRange.start_date || !dateRange.end_date) return '';
    try {
      const parseLocal = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const start = parseLocal(dateRange.start_date);
      const end = parseLocal(dateRange.end_date);
      const duration = end - start; // Time difference in ms

      const prevEnd = new Date(start.getTime() - 86400000); // Start minus 1 day
      const prevStart = new Date(prevEnd.getTime() - duration);

      const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      return `(${fmt(prevStart)} - ${fmt(prevEnd)})`;
    } catch (e) {
      return '';
    }
  }, [dateRange]);

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
            options={panelOptions.map(p => ({
              value: p.panel_title,
              label: `${p.panel_title} (${p.alert_count})`
            }))}
            value={selectedPanel || ''}
            onChange={(val) => setSelectedPanel(val || null)}
            placeholder="All Panels"
          />
        </div>
      </div>
    ),
  }), [panelOptions, selectedPanel, setSelectedPanel, config.clusteringEnabled, colors]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);

  return (
    <div>
      {/*
              נתונים לפי <strong>{selectedPanel}</strong>
      */}
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
            trend={exec.data?.total_trend_pct}
            trendTooltip={`אינדיקציה למגמת עליה או ירידה בכמות ההתראות בהשוואה ל ${prevPeriodText}.`}
            invertTrend={true}
          />
          <MetricCard
            title="יחס התראות לפי זמנים"
            tooltip="יחס בין התראות ארוכות לקצרות. אחוז גבוה מצביע על פחות התראות קצרות)."
            value={`${exec.data?.signal_ratio ?? '—'}%`}
            subtitle="יחס התראות ארוכות לקצרות"
            icon={TrendingUp}
            logoColor="blue"
            loading={exec.loading}
          />
          <MetricCard
            title="התראות אמיתיות (לילה)"
            tooltip={`התראות במשמרת לילה שנמשכו מעל ${thresholdMinutes} דקות.`}
            value={exec.data?.true_wakeups ?? '—'}
            subtitle={`התראות שזמנן ≥ ${thresholdMinutes} ד' בלילה`}
            icon={Moon}
            logoColor="purple"
            loading={exec.loading}
          />
          <MetricCard
            title="אחוז התראות שווא"
            tooltip={`אחוז ההתראות (יום + לילה) שהיו קצרות מ-${thresholdMinutes} דקות.`}
            value={`${exec.data?.false_positive_rate_247 ?? '—'}%`}
            subtitle={`התראות שזמנן ≤ ${thresholdMinutes} ד'`}
            icon={Shield}
            logoColor="red"
            loading={exec.loading}
            trend={exec.data?.noise_trend_pct}
            trendTooltip={`אינדיקציה לשינוי באחוז התראות השווא בהשוואה ל ${prevPeriodText}.`}
            invertTrend={true}
          />

          <MetricCard
            title={config.durationMetric === 'average' ? 'ממוצע זמן התראה' : 'חציון זמן התראה'}
            tooltip={
              config.durationMetric === 'average'
                ? "משך זמן ממוצע להתראה."
                : "משך זמן בחציון (כדי למנוע השפעה של התראות חריגות)."
            }
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
                            const name = isCount ? 'Count' : (config.durationMetric === 'average' ? 'Average Duration' : 'Median Duration');
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
                <Bar yAxisId="left" dataKey="count" name="Count">
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
                  dataKey={config.durationMetric === 'average' ? 'avg_duration' : 'median_duration'}
                  stroke={colors.chart.quaternary}
                  strokeWidth={2}
                  name={config.durationMetric === 'average' ? 'Average Duration' : 'Median Duration'}
                  dot={{ r: 4, fill: colors.chart.quaternary }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Alert Sources List */}
          <ChartCard
            title="Top Alert Sources"
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
                        {formatDuration(p.avg_duration)} avg | {formatDuration(p.median_duration)} med
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
                  labelFormatter={(d) => {
                    try {
                      return new Date(d).toLocaleDateString('en-IL', { weekday: 'short', month: 'short', day: 'numeric' });
                    } catch {
                      return d;
                    }
                  }}
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
                  name="Total Alerts"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="false_alerts"
                  fill={colors.semantic.error}
                  fillOpacity={0.4}
                  stroke={colors.semantic.error}
                  strokeWidth={2}
                  name="False Alerts"
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
