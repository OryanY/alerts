import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Moon,
  Download,
  Activity,
  Zap,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Search,
  Sun,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Area,
} from 'recharts';

import { useClientConfig } from '../contexts/ClientConfigContext';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorCallout } from '../components/ErrorCallout';
import { ChartCard } from '../components/ChartCard';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const PanelResearchPage = () => {
  const {
    config,
    getApiParams,
    dateRange,
    setDateRange,
    setPresetRange,
  } = useClientConfig();

  const { colorByDuration } = useDurationBands(config);
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const [selectedPanel, setSelectedPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ---- helpers (chart theming) ----
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

  // Adjust date range for "today" selection
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

  const apiParams = useMemo(
    () => ({
      ...adjustedDateRange,
      ...getApiParams(),
      false_wakeup_threshold: config.falseWakeupThreshold || 120,
    }),
    [adjustedDateRange, getApiParams, config.falseWakeupThreshold]
  );

  // Fetch panel list
  const {
    data: panelsList,
    loading: panelsLoading,
    error: panelsError,
  } = useApiData('/stats/panels', apiParams);

  // Fetch selected panel analysis
  const panelApiParams = useMemo(() => {
    if (!selectedPanel) return null;
    return { ...apiParams, panel_title: selectedPanel };
  }, [apiParams, selectedPanel]);

  const {
    data: panelAnalysis,
    loading: analysisLoading,
    error: analysisError,
  } = useApiData('/stats/panel-analysis', panelApiParams, { skip: !selectedPanel });

  // Fetch alerts for selected panel
  const alertsParams = useMemo(() => {
    if (!selectedPanel) return null;
    return {
      ...adjustedDateRange,
      ...getApiParams(),
      panel_title: selectedPanel,
      limit: 100,
      sort_by: 'time_fired',
      sort_order: 'DESC', // Must be uppercase
    };
  }, [adjustedDateRange, getApiParams, selectedPanel]);

  const {
    data: recentAlerts,
    loading: alertsLoading,
  } = useApiData('/alerts', alertsParams, { skip: !selectedPanel });

  // Filter panels by search
  const filteredPanels = useMemo(() => {
    if (!panelsList) return [];
    let filtered = panelsList;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.panel_title.toLowerCase().includes(query) ||
          p.application.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [panelsList, searchQuery]);

  // Format time for IL
  const formatTime = (iso) => {
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

  // Export report (text file)
  const exportReport = () => {
    if (!panelAnalysis || !selectedPanel) return;

    const { summary, recommendations, top_noisy_alerts } = panelAnalysis;

    const reportLines = [
      `Panel Health Report: ${selectedPanel}`,
      `Generated: ${new Date().toLocaleString('en-IL', {
        timeZone: 'Asia/Jerusalem',
      })}`,
      `Date Range: ${adjustedDateRange.start_date} to ${adjustedDateRange.end_date}`,
      '',
      '=== EXECUTIVE SUMMARY ===',
      `Total Alerts: ${summary.total_alerts}`,
      `Average Duration: ${summary.avg_duration}s`,
      `False Positive Rate: ${summary.false_positive_rate}%`,
      `Night Wakeups: ${summary.night_wakeups} (False: ${summary.night_false_wakeups})`,
      `Alert Velocity: ${summary.alerts_per_day} alerts/day`,
      `Trend: ${summary.trend_direction.toUpperCase()}`,
      '',
      '=== RECOMMENDATIONS ===',
      ...recommendations.map(
        (rec, i) =>
          `\n${i + 1}. [${rec.severity.toUpperCase()}] ${rec.category}\n   ${rec.message}\n   Action: ${rec.action}\n   Impact: ${rec.impact}`
      ),
      '',
      '=== TOP NOISY ALERTS ===',
      ...top_noisy_alerts.slice(0, 5).map(
        (alert, i) =>
          `${i + 1}. ${alert.message}\n   Count: ${alert.count} | Avg Duration: ${
            alert.avg_duration
          }s | False Positive Rate: ${alert.false_positive_rate}%`
      ),
    ];

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panel_report_${selectedPanel.replace(
      /[^a-z0-9]/gi,
      '_'
    )}_${adjustedDateRange.start_date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Severity color + icon, mapped to theme
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return colors.semantic.error;
      case 'medium':
        return colors.semantic.warning;
      case 'low':
        return colors.semantic.success;
      default:
        return colors.text.secondary;
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return XCircle;
      case 'medium':
        return AlertCircle;
      case 'low':
        return CheckCircle;
      default:
        return AlertTriangle;
    }
  };

  if (panelsError) {
    return <ErrorCallout message={panelsError.message} details={panelsError} />;
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: colors.text.primary,
            }}
          >
            Panel Research & Analysis
          </h2>
        </div>
      </div>

      {/* Date Range Picker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          position: 'relative',
        }}
      >
        <DateRangePicker
          dateRange={dateRange}
          onChange={setDateRange}
          setPresetRange={setPresetRange}
        />
      </div>

      {/* Panel Selection Grid (no panel selected) */}
      {!selectedPanel && (
        <div>
          <div style={S.card()}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  color: colors.text.primary,
                }}
              >
                Select a Panel to Analyze
              </h3>
              <div style={{ position: 'relative', width: 300 }}>
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
                  placeholder="Search panels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    ...S.input,
                    paddingLeft: 36,
                  }}
                />
              </div>
            </div>

            {panelsLoading ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12,
                }}
              >
                {Array(6)
                  .fill()
                  .map((_, i) => (
                    <LoadingSkeleton key={i} width="100%" height={120} />
                  ))}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12,
                }}
              >
                {filteredPanels.map((panel) => (
                  <div
                    key={panel.panel_title}
                    onClick={() => setSelectedPanel(panel.panel_title)}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: colors.bg.secondary,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: colors.border.primary,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.brand.primary;
                      e.currentTarget.style.boxShadow = colors.shadow.md;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border.primary;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            margin: '0 0 4px 0',
                            color: colors.text.primary,
                          }}
                        >
                          {panel.panel_title}
                        </h4>
                        <div
                          style={{
                            fontSize: 12,
                            color: colors.text.secondary,
                          }}
                        >
                          {panel.application_count}{' '}
                          {panel.application_count === 1
                            ? 'application'
                            : 'applications'}
                        </div>
                      </div>
                      <ChevronRight
                        size={20}
                        style={{ color: colors.text.tertiary }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: colors.chart.primary,
                          }}
                        >
                          {panel.alert_count}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.text.secondary,
                          }}
                        >
                          Total Alerts
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: colors.semantic.error,
                          }}
                        >
                          {panel.false_positive_count}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.text.secondary,
                          }}
                        >
                          False Positives
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: colors.text.secondary,
                          }}
                        >
                          {panel.avg_duration}s
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.text.secondary,
                          }}
                        >
                          Avg Duration
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel Analysis View */}
      {selectedPanel && (
        <div>
          {/* Back button and actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <button
              onClick={() => setSelectedPanel(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',

                background: colors.bg.secondary,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.border.primary,
                color: colors.text.primary,
              }}
            >
              ← Back to Panel List
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={exportReport}
                disabled={!panelAnalysis}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: panelAnalysis ? 'pointer' : 'not-allowed',

                  border: 'none',
                  background: panelAnalysis
                    ? colors.brand.primary
                    : colors.bg.tertiary,
                  color: panelAnalysis
                    ? colors.text.inverse
                    : colors.text.tertiary,
                  opacity: panelAnalysis ? 1 : 0.7,
                }}
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>

          {analysisError && (
            <ErrorCallout
              message={analysisError.message}
              details={analysisError}
            />
          )}

          {analysisLoading ? (
            <div>
              <LoadingSkeleton
                width="100%"
                height={200}
                style={{ marginBottom: 16 }}
              />
              <LoadingSkeleton width="100%" height={300} />
            </div>
          ) : panelAnalysis ? (
            <>
              {/* Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                {/* Total Alerts */}
                <div style={S.card()}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <AlertTriangle
                      size={20}
                      style={{ color: colors.semantic.warning }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.text.secondary,
                      }}
                    >
                      Total Alerts
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: colors.text.primary,
                    }}
                  >
                    {panelAnalysis.summary.total_alerts}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.text.secondary,
                      marginTop: 4,
                    }}
                  >
                    {panelAnalysis.summary.alerts_per_day} per day
                  </div>
                </div>

                {/* Avg Duration */}
                <div style={S.card()}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Clock
                      size={20}
                      style={{ color: colors.chart.primary }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.text.secondary,
                      }}
                    >
                      Avg Duration
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: colors.text.primary,
                    }}
                  >
                    {panelAnalysis.summary.avg_duration}s
                  </div>
                </div>

                {/* False Positive Rate */}
                <div style={S.card()}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <XCircle
                      size={20}
                      style={{ color: colors.semantic.error }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.text.secondary,
                      }}
                    >
                      False Positive Rate
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: colors.semantic.error,
                    }}
                  >
                    {panelAnalysis.summary.false_positive_rate}%
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.text.secondary,
                      marginTop: 4,
                    }}
                  >
                    {panelAnalysis.summary.false_positive_count} alerts
                  </div>
                </div>

                {/* Night Wakeups */}
                <div style={S.card()}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Moon
                      size={20}
                      style={{ color: colors.brand.secondary }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.text.secondary,
                      }}
                    >
                      Night Wakeups
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: colors.brand.secondary,
                    }}
                  >
                    {panelAnalysis.summary.night_wakeups}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.semantic.error,
                      marginTop: 4,
                    }}
                  >
                    {panelAnalysis.summary.night_false_wakeups} false wakeups
                  </div>
                </div>

                {/* Trend */}
                <div style={S.card()}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <TrendingUp
                      size={20}
                      style={{
                        color:
                          panelAnalysis.summary.trend_direction === 'increasing'
                            ? colors.semantic.error
                            : panelAnalysis.summary.trend_direction ===
                              'decreasing'
                            ? colors.semantic.success
                            : colors.text.secondary,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.text.secondary,
                      }}
                    >
                      Trend
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color:
                        panelAnalysis.summary.trend_direction === 'increasing'
                          ? colors.semantic.error
                          : panelAnalysis.summary.trend_direction ===
                            'decreasing'
                          ? colors.semantic.success
                          : colors.text.secondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {panelAnalysis.summary.trend_direction}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {panelAnalysis.recommendations &&
                panelAnalysis.recommendations.length > 0 && (
                  <div
                    style={{
                      ...S.card(),
                      marginBottom: 20,
                      background: colors.semantic.errorBg,
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: colors.semantic.error,
                    }}
                  >
                    <h3
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 18,
                        fontWeight: 700,
                        margin: '0 0 16px 0',
                        color: colors.semantic.errorText,
                      }}
                    >
                      <Target
                        size={20}
                        style={{ color: colors.semantic.error }}
                      />
                      Action Items & Recommendations
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {panelAnalysis.recommendations.map((rec, idx) => {
                        const Icon = getSeverityIcon(rec.severity);
                        const sevColor = getSeverityColor(rec.severity);
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: 16,
                              background: colors.bg.secondary,
                              borderRadius: 8,
                              borderLeftWidth: 4,
                              borderLeftStyle: 'solid',
                              borderLeftColor: sevColor,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 12,
                              }}
                            >
                              <Icon
                                size={20}
                                style={{
                                  color: sevColor,
                                  flexShrink: 0,
                                  marginTop: 2,
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform: 'uppercase',

                                      background: `${sevColor}20`,
                                      color: sevColor,
                                    }}
                                  >
                                    {rec.severity}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: colors.text.secondary,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {rec.category
                                      .replace(/-/g, ' ')
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    color: colors.text.primary,
                                  }}
                                >
                                  {rec.message}
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    color: colors.text.primary,
                                    marginBottom: 6,
                                  }}
                                >
                                  <strong>Action:</strong> {rec.action}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: colors.text.secondary,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  Impact: {rec.impact}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Charts Row 1 */}
              <div style={S.grid('1fr 1fr')}>
                {/* Alert Frequency Trend */}
                <ChartCard
                  title="Alert Frequency Trend"
                  icon={Activity}
                  loading={analysisLoading}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={panelAnalysis.daily_trend || []}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis
                        dataKey="date"
                        {...xAxisProps}
                        tickFormatter={(date) =>
                          new Date(date).toLocaleDateString('en-IL', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                      />
                      <YAxis {...yAxisProps} />
                      <Tooltip
                        {...tooltipStyle}
                        labelFormatter={(date) =>
                          new Date(date).toLocaleDateString('en-IL')
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        fill={colors.chart.primary}
                        fillOpacity={0.25}
                        stroke={colors.chart.primary}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={colors.chart.secondary}
                        strokeWidth={2}
                        dot={{ r: 4, fill: colors.chart.primary }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Duration Distribution */}
                <ChartCard
                  title="Duration Distribution"
                  icon={Clock}
                  loading={analysisLoading}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={panelAnalysis.duration_distribution || []}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="category" {...xAxisProps} />
                      <YAxis {...yAxisProps} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {(panelAnalysis.duration_distribution || []).map(
                          (entry, index) => {
                            let fillColor = colors.semantic.error;
                            if (index === 1) fillColor = colors.semantic.warning;
                            if (index >= 2) fillColor = colors.semantic.success;
                            return (
                              <Cell key={`cell-${index}`} fill={fillColor} />
                            );
                          }
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Charts Row 2 */}
              <div style={S.grid('2fr 1fr')}>
                {/* Hourly Alert Pattern */}
                <ChartCard
                  title="Hourly Alert Pattern"
                  icon={Clock}
                  loading={analysisLoading}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={panelAnalysis.hourly_heatmap || []}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis
                        dataKey="hour"
                        {...xAxisProps}
                        tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                      />
                      <YAxis {...yAxisProps} />
                      <Tooltip
                        {...tooltipStyle}
                        labelFormatter={(h) =>
                          `${String(h).padStart(2, '0')}:00`
                        }
                        formatter={(value, name) => [
                          value,
                          name === 'count' ? 'Alerts' : 'Avg Duration',
                        ]}
                      />
                      <Bar dataKey="count">
                        {(panelAnalysis.hourly_heatmap || []).map(
                          (entry, idx) => (
                            <Cell
                              key={idx}
                              fill={
                                entry.is_night
                                  ? colors.brand.secondary
                                  : colors.chart.primary
                              }
                            />
                          )
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Top Noisy Alerts */}
                <ChartCard
                  title="Top Noisy Alerts"
                  icon={Zap}
                  loading={analysisLoading}
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
                    {(panelAnalysis.top_noisy_alerts || [])
                      .slice(0, 10)
                      .map((alert, idx) => {
                        const isTop = idx < 3;
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: 10,
                              borderRadius: 6,

                              background: isTop
                                ? colors.semantic.errorBg
                                : colors.bg.tertiary,
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: isTop
                                ? colors.semantic.error
                                : colors.border.primary,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: colors.text.primary,
                              }}
                              title={alert.message}
                            >
                              {alert.message || 'N/A'}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11,
                                color: colors.text.secondary,
                              }}
                            >
                              <span>{alert.count} occurrences</span>
                              <span>{alert.avg_duration}s avg</span>
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: colors.semantic.error,
                                marginTop: 2,
                              }}
                            >
                              {alert.false_positive_rate}% false positive
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ChartCard>
              </div>

              {/* Recent Alerts Table */}
              <div style={{ ...S.card(), marginTop: 20 }}>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 16,
                    color: colors.text.primary,
                  }}
                >
                  Recent Alerts (Last 100)
                </h3>

                {alertsLoading ? (
                  <LoadingSkeleton width="100%" height={400} />
                ) : recentAlerts && recentAlerts.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: colors.bg.tertiary,
                            borderBottom: `2px solid ${colors.border.primary}`,
                          }}
                        >
                          <th
                            style={{
                              ...S.tableHeadCell,
                              textAlign: 'left',
                            }}
                          >
                            Time Fired (IL)
                          </th>
                          <th
                            style={{
                              ...S.tableHeadCell,
                              textAlign: 'left',
                            }}
                          >
                            Message
                          </th>
                          <th
                            style={{
                              ...S.tableHeadCell,
                              textAlign: 'center',
                            }}
                          >
                            Duration
                          </th>
                          <th
                            style={{
                              ...S.tableHeadCell,
                              textAlign: 'center',
                            }}
                          >
                            Shift
                          </th>
                          <th
                            style={{
                              ...S.tableHeadCell,
                              textAlign: 'left',
                            }}
                          >
                            Operator
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAlerts.map((alert, idx) => (
                          <tr
                            key={alert.id || idx}
                            style={{
                              borderBottom: `1px solid ${colors.border.primary}`,
                            }}
                          >
                            <td
                              style={{
                                ...S.tableCell,
                                fontFamily: 'monospace',
                                fontSize: 12,
                              }}
                            >
                              {formatTime(alert.time_fired)}
                            </td>
                            <td
                              style={{
                                ...S.tableCell,
                                maxWidth: 300,
                              }}
                            >
                              <div
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: colors.text.primary,
                                }}
                                title={alert.message}
                              >
                                {alert.message || 'N/A'}
                              </div>
                            </td>
                            <td
                              style={{
                                ...S.tableCell,
                                textAlign: 'center',
                              }}
                            >
                              <span
                                style={{
                                  background: `${colorByDuration(
                                    alert.duration_sec
                                  )}20`,
                                  color: colorByDuration(alert.duration_sec),
                                  padding: '4px 8px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {alert.duration_sec}s
                              </span>
                            </td>
                            <td
                              style={{
                                ...S.tableCell,
                                textAlign: 'center',
                              }}
                            >
                              {alert.shift === 'Night' ? (
                                <Moon
                                  size={14}
                                  style={{ color: colors.brand.secondary }}
                                />
                              ) : (
                                <Sun
                                  size={14}
                                  style={{ color: colors.semantic.warning }}
                                />
                              )}
                            </td>
                            <td style={S.tableCell}>
                              {alert.operator || 'System/Auto'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 40,
                      textAlign: 'center',
                      color: colors.text.secondary,
                    }}
                  >
                    No recent alerts found for this panel
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PanelResearchPage;
