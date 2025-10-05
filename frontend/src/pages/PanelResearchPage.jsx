import { useState, useMemo } from 'react';
import { 
  AlertTriangle, TrendingUp, Clock, Moon, Download, 
 Activity, Zap, Target, AlertCircle, CheckCircle,
  XCircle, ChevronRight, Search, Sun
} from 'lucide-react';
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, ComposedChart, Area
} from 'recharts';

import { S } from '../utils/styles';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useDateRangeUrl } from '../hooks/useUrlState';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorCallout } from '../components/ErrorCallout';
import { ChartCard } from '../components/ChartCard';

const PanelResearchPage = () => {
  const { config, getApiParams } = useClientConfig();
  const { dateRange, setDateRange, setPresetRange } = useDateRangeUrl();
  const { colorByDuration } = useDurationBands(config);
  
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Adjust date range for "today" selection
  const adjustedDateRange = useMemo(() => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date === dateRange.end_date) {
      return {
        start_date: dateRange.start_date,
        end_date: `${dateRange.end_date}T23:59:59`
      };
    }
    return dateRange;
  }, [dateRange]);

  const apiParams = useMemo(() => ({
    ...adjustedDateRange,
    ...getApiParams(),
    false_wakeup_threshold: config.falseWakeupThreshold || 120
  }), [adjustedDateRange, getApiParams, config.falseWakeupThreshold]);

  // Fetch panel list
  const { data: panelsList, loading: panelsLoading, error: panelsError } = useApiData('/stats/panels', apiParams);

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
      sort_order: 'DESC'  // Must be uppercase
    };
  }, [adjustedDateRange, getApiParams, selectedPanel]);

  const { data: recentAlerts, loading: alertsLoading } = useApiData('/alerts', alertsParams, { skip: !selectedPanel });

  // Filter panels by search
  const filteredPanels = useMemo(() => {
    if (!panelsList) return [];
    let filtered = panelsList;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
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
      hour12: false
    }).format(d);
  };

  // Export report
  const exportReport = () => {
    if (!panelAnalysis || !selectedPanel) return;
    
    const { summary, recommendations, top_noisy_alerts } = panelAnalysis;
    
    const reportLines = [
      `Panel Health Report: ${selectedPanel}`,
      `Generated: ${new Date().toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem' })}`,
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
      ...recommendations.map((rec, i) => 
        `\n${i + 1}. [${rec.severity.toUpperCase()}] ${rec.category}\n   ${rec.message}\n   Action: ${rec.action}\n   Impact: ${rec.impact}`
      ),
      '',
      '=== TOP NOISY ALERTS ===',
      ...top_noisy_alerts.slice(0, 5).map((alert, i) =>
        `${i + 1}. ${alert.message}\n   Count: ${alert.count} | Avg Duration: ${alert.avg_duration}s | False Positive Rate: ${alert.false_positive_rate}%`
      )
    ];
    
    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panel_report_${selectedPanel.replace(/[^a-z0-9]/gi, '_')}_${adjustedDateRange.start_date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#DC2626';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return XCircle;
      case 'medium': return AlertCircle;
      case 'low': return CheckCircle;
      default: return AlertTriangle;
    }
  };

  if (panelsError) {
    return <ErrorCallout message={panelsError.message} details={panelsError} />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Panel Research & Analysis
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0 0' }}>
            Deep-dive analysis for ops team performance and alert health
          </p>
        </div>
      </div>

      {/* Date Range Picker */}
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        position: 'relative'
    }}>
      <DateRangePicker
        dateRange={dateRange}
        onChange={setDateRange}
        setPresetRange={setPresetRange}
        />

    </div>
      {/* Panel Selection Grid */}
      {!selectedPanel && (
        <div>
          <div style={S.card()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                Select a Panel to Analyze
              </h3>
              <div style={{ position: 'relative', width: 300 }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9CA3AF'
                }} />
                <input
                  type="text"
                  placeholder="Search panels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    ...S.input,
                    paddingLeft: 36
                  }}
                />
              </div>
            </div>

            {panelsLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {Array(6).fill().map((_, i) => (
                  <LoadingSkeleton key={i} width="100%" height={120} />
                ))}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12
              }}>
                {filteredPanels.map((panel) => (
                  <div
                    key={panel.panel_title}
                    onClick={() => setSelectedPanel(panel.panel_title)}
                    style={{
                      padding: 16,
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      ':hover': { borderColor: '#3B82F6', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3B82F6';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>
                          {panel.panel_title}
                        </h4>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                          {panel.application_count} {panel.application_count === 1 ? 'application' : 'applications'}
                        </div>
                      </div>
                      <ChevronRight size={20} style={{ color: '#9CA3AF' }} />
                    </div>
                    
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#3B82F6' }}>
                          {panel.alert_count}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>Total Alerts</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>
                          {panel.false_positive_count}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>False Positives</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280' }}>
                          {panel.avg_duration}s
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>Avg Duration</div>
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
          {/* Back button and header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            <button
              onClick={() => setSelectedPanel(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: 'white',
                cursor: 'pointer',
                fontSize: 14
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
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                  background: panelAnalysis ? '#3B82F6' : '#E5E7EB',
                  color: panelAnalysis ? 'white' : '#9CA3AF',
                  cursor: panelAnalysis ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>

          {analysisError && <ErrorCallout message={analysisError.message} details={analysisError} />}

          {analysisLoading ? (
            <div>
              <LoadingSkeleton width="100%" height={200} style={{ marginBottom: 16 }} />
              <LoadingSkeleton width="100%" height={300} />
            </div>
          ) : panelAnalysis ? (
            <>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20
              }}>
                <div style={S.card()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Total Alerts</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#111827' }}>
                    {panelAnalysis.summary.total_alerts}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    {panelAnalysis.summary.alerts_per_day} per day
                  </div>
                </div>

                <div style={S.card()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Clock size={20} style={{ color: '#3B82F6' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Avg Duration</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#111827' }}>
                    {panelAnalysis.summary.avg_duration}s
                  </div>
                </div>

                <div style={S.card()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <XCircle size={20} style={{ color: '#EF4444' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>False Positive Rate</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#EF4444' }}>
                    {panelAnalysis.summary.false_positive_rate}%
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    {panelAnalysis.summary.false_positive_count} alerts
                  </div>
                </div>

                <div style={S.card()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Moon size={20} style={{ color: '#8B5CF6' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Night Wakeups</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#8B5CF6' }}>
                    {panelAnalysis.summary.night_wakeups}
                  </div>
                  <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
                    {panelAnalysis.summary.night_false_wakeups} false wakeups
                  </div>
                </div>

                <div style={S.card()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TrendingUp size={20} style={{ color: panelAnalysis.summary.trend_direction === 'increasing' ? '#EF4444' : '#10B981' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Trend</span>
                  </div>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700, 
                    color: panelAnalysis.summary.trend_direction === 'increasing' ? '#EF4444' : 
                           panelAnalysis.summary.trend_direction === 'decreasing' ? '#10B981' : '#6B7280',
                    textTransform: 'capitalize'
                  }}>
                    {panelAnalysis.summary.trend_direction}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {panelAnalysis.recommendations && panelAnalysis.recommendations.length > 0 && (
                <div style={{ ...S.card(), marginBottom: 20, background: '#FEF2F2', border: '2px solid #FCA5A5' }}>
                  <h3 style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    margin: '0 0 16px 0'
                  }}>
                    <Target size={20} style={{ color: '#DC2626' }} />
                    Action Items & Recommendations
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {panelAnalysis.recommendations.map((rec, idx) => {
                      const Icon = getSeverityIcon(rec.severity);
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: 16,
                            background: 'white',
                            borderRadius: 8,
                            borderLeft: `4px solid ${getSeverityColor(rec.severity)}`
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                            <Icon size={20} style={{ color: getSeverityColor(rec.severity), flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{
                                  padding: '2px 8px',
                                  background: `${getSeverityColor(rec.severity)}20`,
                                  color: getSeverityColor(rec.severity),
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}>
                                  {rec.severity}
                                </span>
                                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                                  {rec.category.replace(/-/g, ' ').toUpperCase()}
                                </span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                                {rec.message}
                              </div>
                              <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>
                                <strong>Action:</strong> {rec.action}
                              </div>
                              <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
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
                <ChartCard title="Alert Frequency Trend" icon={Activity} loading={analysisLoading}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={panelAnalysis.daily_trend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-IL', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip labelFormatter={(date) => new Date(date).toLocaleDateString('en-IL')} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        fill="#3B82F6"
                        fillOpacity={0.3}
                        stroke="#3B82F6"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#1E40AF"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#3B82F6' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Duration Distribution" icon={Clock} loading={analysisLoading}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={panelAnalysis.duration_distribution || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {(panelAnalysis.duration_distribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#EF4444' : index === 1 ? '#F59E0B' : '#10B981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Charts Row 2 */}
              <div style={S.grid('2fr 1fr')}>
                <ChartCard title="Hourly Alert Pattern" icon={Clock} loading={analysisLoading}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={panelAnalysis.hourly_heatmap || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`} />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                        formatter={(value, name) => [value, name === 'count' ? 'Alerts' : 'Avg Duration']}
                      />
                      <Bar dataKey="count">
                        {(panelAnalysis.hourly_heatmap || []).map((entry, idx) => (
                          <Cell key={idx} fill={entry.is_night ? '#8B5CF6' : '#3B82F6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top Noisy Alerts" icon={Zap} loading={analysisLoading}>
                  <div style={{
                    maxHeight: 300,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {(panelAnalysis.top_noisy_alerts || []).slice(0, 10).map((alert, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          background: idx < 3 ? '#FEF2F2' : '#F9FAFB',
                          borderRadius: 6,
                          border: `1px solid ${idx < 3 ? '#FCA5A5' : '#F3F4F6'}`
                        }}
                      >
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={alert.message}>
                          {alert.message || 'N/A'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280' }}>
                          <span>{alert.count} occurrences</span>
                          <span>{alert.avg_duration}s avg</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>
                          {alert.false_positive_rate}% false positive
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>

              {/* Recent Alerts Table */}
              <div style={{ ...S.card(), marginTop: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                  Recent Alerts (Last 100)
                </h3>

                {alertsLoading ? (
                  <LoadingSkeleton width="100%" height={400} />
                ) : recentAlerts && recentAlerts.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13
                    }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                          <th style={{ ...S.tableHeadCell, textAlign: 'left' }}>Time Fired (IL)</th>
                          <th style={{ ...S.tableHeadCell, textAlign: 'left' }}>Message</th>
                          <th style={{ ...S.tableHeadCell, textAlign: 'center' }}>Duration</th>
                          <th style={{ ...S.tableHeadCell, textAlign: 'center' }}>Shift</th>
                          <th style={{ ...S.tableHeadCell, textAlign: 'left' }}>Operator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAlerts.map((alert, idx) => (
                          <tr
                            key={alert.id || idx}
                            style={{
                              borderBottom: '1px solid #F3F4F6'
                            }}
                          >
                            <td style={{ ...S.tableCell, fontFamily: 'monospace', fontSize: 12 }}>
                              {formatTime(alert.time_fired)}
                            </td>
                            <td style={{ ...S.tableCell, maxWidth: 300 }}>
                              <div style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }} title={alert.message}>
                                {alert.message || 'N/A'}
                              </div>
                            </td>
                            <td style={{ ...S.tableCell, textAlign: 'center' }}>
                              <span style={{
                                background: `${colorByDuration(alert.duration_sec)}20`,
                                color: colorByDuration(alert.duration_sec),
                                padding: '4px 8px',
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 600
                              }}>
                                {alert.duration_sec}s
                              </span>
                            </td>
                            <td style={{ ...S.tableCell, textAlign: 'center' }}>
                              {alert.shift === 'Night' ? (
                                <Moon size={14} style={{ color: '#8B5CF6' }} />
                              ) : (
                                <Sun size={14} style={{ color: '#F59E0B' }} />
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
                  <div style={{
                    padding: 40,
                    textAlign: 'center',
                    color: '#6B7280'
                  }}>
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