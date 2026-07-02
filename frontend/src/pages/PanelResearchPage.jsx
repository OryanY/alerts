import { useState, useMemo } from 'react';
import {
  Download,
  Search,
  ChevronRight,
} from 'lucide-react';


import { useClientConfig } from '../contexts/ClientConfigContext';
import { useApiData } from '../hooks/useApiData';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorCallout } from '../components/ui/ErrorCallout';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';
import { formatDuration } from '../utils/formatters';


// New Components
import ResearchSummaryCards from '../components/PanelResearch/ResearchSummaryCards';
import ResearchTrendCharts from '../components/PanelResearch/ResearchTrendCharts';
import ResearchHourlyHeatmap from '../components/PanelResearch/ResearchHourlyHeatmap';
import TopNoisyAlertsList from '../components/PanelResearch/TopNoisyAlertsList';
import TopApplicationsChart from '../components/PanelResearch/TopApplicationsChart';
import ConsecutiveDaysTable from '../components/PanelResearch/ConsecutiveDaysTable';
import TopNoisyNodesTable from '../components/PanelResearch/TopNoisyNodesTable';
import TopObjectsTable from '../components/PanelResearch/TopObjectsTable';
import ResearchAlertTimeline from '../components/PanelResearch/ResearchAlertTimeline';
import { useDurationBands } from '../hooks/useDurationBands';
import { Table } from 'lucide-react';

const PanelResearchPage = () => {
  const {
    config,
    dateRange,
  } = useClientConfig();

  const { colors } = useTheme();
  const S = useMemo(() => createThemedStyles(colors), [colors]);

  // Destructure colorByDuration correctly
  const { colorByDuration, bands } = useDurationBands(config);

  const [selectedPanel, setSelectedPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  // Fetch panel list. useApiData automatically injects date range and global params.
  const {
    data: panelsList,
    loading: panelsLoading,
    error: panelsError,
  } = useApiData('/stats/panels');

  // Fetch selected panel analysis
  const panelApiParams = useMemo(() => {
    if (!selectedPanel) return null;
    return { panel_title: selectedPanel };
  }, [selectedPanel]);

  const {
    data: panelAnalysis,
    loading: analysisLoading,
    error: analysisError,
  } = useApiData('/stats/panel-analysis', panelApiParams, { skip: !selectedPanel });

  // Fetch alerts for selected panel. Fixed newest-first ordering — the stream
  // groups by day, so chronological order is what the grouping relies on.
  const alertsParams = useMemo(() => {
    if (!selectedPanel) return null;
    return {
      panel_title: selectedPanel,
      limit: 100,
      sort_by: 'time_fired',
      sort_order: 'DESC',
      ...(selectedNode ? { node_name: selectedNode } : {}),
    };
  }, [selectedPanel, selectedNode]);

  const {
    data: recentAlerts,
    loading: alertsLoading,
    error: alertsError
  } = useApiData('/alerts', alertsParams, { skip: !selectedPanel });



  // --- NEW STATISTICS ---

  const {
    data: topApps,
    loading: topAppsLoading
  } = useApiData('/stats/top-applications', panelApiParams, { skip: !selectedPanel });

  const {
    data: topNodes,
    loading: topNodesLoading
  } = useApiData('/stats/top-nodes-by-app', panelApiParams, { skip: !selectedPanel });

  const {
    data: topObjects,
    loading: topObjectsLoading
  } = useApiData('/stats/top-objects-by-app', panelApiParams, { skip: !selectedPanel });

  const {
    data: consecutiveNodes,
    loading: consecutiveNodesLoading
  } = useApiData('/stats/consecutive-days', panelApiParams, { skip: !selectedPanel });

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

  // Export
  const exportReport = () => {
    if (!panelAnalysis || !selectedPanel) return;

    const { summary, top_noisy_alerts } = panelAnalysis;

    const reportLines = [
      `Panel Health Report: ${selectedPanel}`,
      `Generated: ${new Date().toLocaleString('en-IL', {
        timeZone: 'Asia/Jerusalem',
      })}`,
      `Date Range: ${dateRange.start_date} to ${dateRange.end_date}`,
      '',
      '=== EXECUTIVE SUMMARY ===',
      `Total Alerts: ${summary.total_alerts}`,
      `Average Duration: ${summary.avg_duration}s`,
      `False Positive Rate: ${summary.false_positive_rate}%`,
      `Night Wakeups: ${summary.night_wakeups} (False: ${summary.night_false_wakeups})`,
      `Alert Velocity: ${summary.alerts_per_day} alerts/day`,
      `Trend: ${summary.trend_direction.toUpperCase()}`,
      '',

      '=== TOP NOISY ALERTS ===',
      ...top_noisy_alerts.slice(0, 5).map(
        (alert, i) =>
          `${i + 1}. ${alert.message}\n   Count: ${alert.count} | Avg Duration: ${alert.avg_duration
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
    )}_${dateRange.start_date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 40,
                }}
              >
                <div className="spinner" />
              </div>
            ) : panelsError ? (
              <ErrorCallout
                message="Failed to load panels list"
                details={panelsError}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 12,
                  maxHeight: 500,
                  overflowY: 'auto',
                }}
              >
                {filteredPanels.map((p) => (
                  <div
                    key={p.panel_title}
                    onClick={() => {
                      setSelectedPanel(p.panel_title);
                      setSelectedNode(null);
                    }}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: `1px solid ${colors.border.primary}`,
                      background: colors.bg.secondary,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.brand.primary;
                      e.currentTarget.style.background =
                        colors.bg.tertiary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        colors.border.primary;
                      e.currentTarget.style.background =
                        colors.bg.secondary;
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
                        <div
                          style={{
                            fontWeight: 600,
                            color: colors.text.primary,
                            marginBottom: 4,
                            fontSize: 16,
                          }}
                        >
                          {p.panel_title}
                        </div>
                        {(p.application && p.application !== 'N/A' && p.application !== 'Unknown App') && (
                          <div
                            style={{
                              fontSize: 12,
                              color: colors.text.secondary,
                            }}
                          >
                            {p.application}
                          </div>
                        )}
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
                            fontSize: 20,
                            fontWeight: 700,
                            color: colors.chart.primary,
                          }}
                        >
                          {p.alert_count}
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
                            fontSize: 20,
                            fontWeight: 700,
                            color: colors.semantic.error,
                          }}
                        >
                          {p.false_positive_count}
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
                            marginTop: 4
                          }}
                        >
                          {formatDuration(p.avg_duration)}
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
                {filteredPanels.length === 0 && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: 20,
                      textAlign: 'center',
                      color: colors.text.secondary,
                    }}
                  >
                    No panels found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Panel Analysis */}
      {selectedPanel && (
        <div className="fade-in">
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text.primary, marginBottom: 4 }}>
                {selectedPanel}
              </h2>
              {panelAnalysis && panelAnalysis.application && panelAnalysis.application !== 'N/A' && (
                <div style={{ fontSize: 13, color: colors.text.secondary }}>
                  Application: {panelAnalysis.application}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSelectedPanel(null)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${colors.border.primary}`,
                  background: colors.bg.secondary,
                  color: colors.text.primary,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Change Panel
              </button>
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
              <ResearchSummaryCards summary={panelAnalysis.summary} dailyTrend={panelAnalysis.daily_trend} />

              {/* Trend Charts */}
              <ResearchTrendCharts
                daily_trend={panelAnalysis.daily_trend}
                duration_distribution={panelAnalysis.duration_distribution}
                loading={analysisLoading}
              />

              <div style={S.grid('2fr 1fr')}>
                {/* Hourly Alert Pattern */}
                <ResearchHourlyHeatmap
                  hourly_heatmap={panelAnalysis.hourly_heatmap}
                  loading={analysisLoading}
                />

                {/* Top Noisy Alerts */}
                <TopNoisyAlertsList
                  alerts={panelAnalysis.top_noisy_alerts}
                  loading={analysisLoading}
                />
              </div>

              {/* === NEW SECTIONS === */}

              <div style={S.grid('1fr 1fr')}>
                {/* Top Applications */}
                <TopApplicationsChart data={topApps} loading={topAppsLoading} />

                {/* Consecutive Days Patterns */}
                <ConsecutiveDaysTable
                  nodes={consecutiveNodes}
                  loading={consecutiveNodesLoading}
                  onSelectNode={setSelectedNode}
                  selectedNode={selectedNode}
                />
              </div>

              {/* Top Nodes & Objects Tables */}
              <div style={S.grid('1fr 1fr')}>
                <TopNoisyNodesTable
                  nodes={topNodes}
                  loading={topNodesLoading}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                />
                <TopObjectsTable
                  objects={topObjects}
                  loading={topObjectsLoading}
                  selectedObject={null}
                  onSelectObject={() => { }}
                />
              </div>

              {/* Recent Alerts - Reused AlertTable for Clustering Support */}
              <div style={{ marginTop: 32 }}>
                <div
                  dir="rtl"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 16,
                    width: '100%'
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.text.primary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      margin: 0
                    }}
                  >
                    <Table size={16} style={{ color: colors.brand.primary }} />

                    <span>ציר זמן התראות</span>

                    <span
                      style={{
                        fontSize: 13,
                        color: colors.text.tertiary,
                        fontWeight: 400
                      }}
                    >
                      (100 אחרונות)
                    </span>

                    {selectedNode && (
                      <span
                        dir="ltr"
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          color: colors.semantic.infoText,
                          background: colors.semantic.infoBg,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}
                      >
                        Filtered by: {selectedNode}
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {alertsLoading ? (
                <LoadingSkeleton width="100%" height={400} />
              ) : alertsError ? (
                <ErrorCallout message="Failed to load recent alerts" details={alertsError} />
              ) : recentAlerts?.length > 0 ? (
                <ResearchAlertTimeline
                  alerts={recentAlerts}
                  colorByDuration={colorByDuration}
                  bands={bands}
                  colors={colors}
                />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: colors.text.secondary }}>
                  No alerts found for this panel
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PanelResearchPage;
