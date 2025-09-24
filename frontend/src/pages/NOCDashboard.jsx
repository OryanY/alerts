import React, { Suspense } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

import { S } from '../utils/styles';

import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';
import { useClientConfig } from '../contexts/ClientConfigContext'; 
import { useDateRangeUrl, useShareableUrl } from '../hooks/useUrlState';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {DateRangePicker} from '../components/DateRangePicker';
import {MetricCard} from '../components/MetricCard';
import {ChartCard} from '../components/ChartCard';
import {WakeupGauge} from '../components/WakeupGauge';

import { AlertTriangle, Calendar, Clock, Moon, Sun, TrendingUp, Zap, Shield } from '../icons';
import { Share } from 'lucide-react';

const NocDashboard = () => {
  const { config, getApiParams } = useClientConfig();
  const { dateRange, setDateRange, setPresetRange } = useDateRangeUrl();
  const { shareCurrentUrl } = useShareableUrl();
  const { colorByDuration, Legend } = useDurationBands(config);

  // Fix for "today" selection - adjust end_date to avoid validation error
  const adjustedDateRange = React.useMemo(() => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date === dateRange.end_date) {
      // When start and end are the same (clicking "today"), add time to end date
      return {
        start_date: dateRange.start_date,
        end_date: `${dateRange.end_date}T23:59:59`
      };
    }
    return dateRange;
  }, [dateRange]);

  // Simplified API params - start with minimal parameters to debug
  const baseApiParams = {
    // Only include date range if available
    ...(adjustedDateRange.start_date && { start_date: adjustedDateRange.start_date }),
    ...(adjustedDateRange.end_date && { end_date: adjustedDateRange.end_date })
  };

  // Add config parameters only if they differ from defaults
  const configParams = getApiParams();
  const apiParams = {
    ...baseApiParams,
    // Only add non-default config values
    ...(configParams.day_start !== 8 && { day_start: configParams.day_start }),
    ...(configParams.day_end !== 22 && { day_end: configParams.day_end }),
    ...(configParams.dur_short_max !== 30 && { dur_short_max: configParams.dur_short_max }),
    ...(configParams.dur_medium_max !== 300 && { dur_medium_max: configParams.dur_medium_max })
  };

  // Debug: Log the parameters being sent
  console.log('API Parameters being sent:', apiParams);

  // Updated API calls with error logging
  const exec = useApiData('/stats/executive-kpis', apiParams);
  const shifts = useApiData('/stats/shift-analysis', apiParams);
  const duration = useApiData('/stats/duration-histogram', apiParams);
  const heatmap = useApiData('/stats/hourly-heatmap', apiParams);
  const weekend = useApiData('/stats/weekend-weekday', apiParams);
  
  // Recent alerts with simpler params
  const recent = useApiData('/stats/recent-alerts', { hours: 24, limit: 15 });
  const panelStats = useApiData('/stats/by-panel', { ...apiParams, limit: 20 });
  const timeseries = useApiData('/stats/timeseries', apiParams);

  // Log any errors for debugging
  React.useEffect(() => {
    [exec, shifts, duration, heatmap, weekend, recent, panelStats, timeseries].forEach((apiCall, index) => {
      if (apiCall.error) {
        const endpoints = ['executive-kpis', 'shift-analysis', 'duration-histogram', 'hourly-heatmap', 'weekend-weekday', 'recent-alerts', 'by-panel', 'timeseries'];
        console.error(`Error in ${endpoints[index]}:`, apiCall.error);
      }
    });
  }, [exec.error, shifts.error, duration.error, heatmap.error, weekend.error, recent.error, panelStats.error, timeseries.error]);

  const isLoading = exec.loading || shifts.loading || duration.loading || heatmap.loading;

  return (
    <div>
      {/* Date Range Picker with URL state */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <DateRangePicker
          dateRange={dateRange}
          onChange={setDateRange}
          setPresetRange={setPresetRange}
        />
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={shareCurrentUrl}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontSize: 14
            }}
            title="Share current view"
          >
            <Share size={14} />
            Share
          </button>
        </div>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        {/* KPI Cards - Updated field names for new API */}
        <div style={S.grid('repeat(auto-fit, minmax(300px, 1fr))')}>
          <MetricCard
            title="Total Alerts"
            value={exec.data?.total_alerts ?? '—'}
            subtitle="All alerts in selected period"
            icon={AlertTriangle}
            color="orange"
          />
          <MetricCard
            title="Signal Ratio"
            value={`${exec.data?.signal_ratio ?? '—'}%`}
            subtitle="Meaningful vs noise alerts"
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="True Night Wakeups"
            value={exec.data?.true_wakeups ?? '—'}
            subtitle="Significant night alerts"
            icon={Moon}
            color="purple"
          />
          <MetricCard
            title="False Wakeup Rate"
            value={`${exec.data?.false_wakeup_rate ?? '—'}%`}
            subtitle="Quick-resolving night alerts"
            icon={Shield}
            color="red"
          />
        </div>

        {/* Charts Row 1 */}
        <div style={S.grid('1fr 1fr')}>
          <ChartCard title="Shift Distribution" icon={Sun} loading={shifts.loading} error={shifts.error}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shifts.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shift" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="alert_count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Duration Distribution"
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
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div style={S.grid('2fr 1fr 1fr')}>
          <ChartCard
            title="Hourly Alert Distribution"
            icon={Clock}
            loading={heatmap.loading}
            error={heatmap.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmap.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour_display" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {(heatmap.data || []).map((entry, idx) => (
                    <Cell key={idx} fill={entry?.is_night ? '#8B5CF6' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Top Noisy Services"
            icon={Zap}
            loading={panelStats.loading}
            error={panelStats.error}
          >
            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {(panelStats.data || []).slice(0, 10).map((p, idx) => (
                <div
                  key={`${p.panel_title}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: '#F9FAFB',
                    borderRadius: 6,
                    border: '1px solid #F3F4F6'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.panel_title}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{p.application}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{p.alert_count} alerts</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Avg: {p.avg_duration}s</div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Weekend vs Weekday"
            icon={Calendar}
            loading={weekend.loading}
            error={weekend.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weekend.data || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="alert_count"
                >
                  {(weekend.data || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#8B5CF6'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [value, props.payload.period]} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 3 */}
        <div style={S.grid('1fr 400px')}>
          <ChartCard
            title="Weekly Trends"
            icon={TrendingUp}
            loading={timeseries.loading}
            error={timeseries.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date_il"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString('en-IL', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis />
                <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString('en-IL')} />
                <Line
                  type="monotone"
                  dataKey="alert_count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_duration"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <WakeupGauge shiftData={shifts.data} loading={shifts.loading} error={shifts.error} />
        </div>

        {/* Recent Alerts - Updated to handle new response structure */}
        <ChartCard
          title="Recent Alerts (24h)"
          icon={Clock}
          loading={recent.loading}
          error={recent.error}
        >
          <div style={{
            maxHeight: 300,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            {(recent.data || []).map((a, i) => (
              <div
                key={a.id || a.incident_id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  background: '#F9FAFB',
                  borderRadius: 6,
                  borderLeft: `4px solid ${colorByDuration(a.duration_sec)}`
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 600, fontSize: 13 }}
                    title={a.panel_title || 'Unknown Panel'}
                  >
                    {(a.panel_title || 'Unknown Panel').slice(0, 40)}
                    {(a.panel_title || '').length > 40 ? '…' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    {a.application || 'N/A'} • {a.time_fired || a.time_fired_il}
                  </div>
                </div>
                <div style={{
                  background: `${colorByDuration(a.duration_sec)}20`,
                  color: colorByDuration(a.duration_sec),
                  padding: '4px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600
                }}>
                  {a.duration_sec}s
                </div>
              </div>
            ))}
            {(!recent.data || !recent.data.length) && !recent.loading && (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>
                No alerts in last 24 hours
              </div>
            )}
          </div>
        </ChartCard>
      </Suspense>

      {/* Global Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 24,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: 20,
              height: 20,
              border: '2px solid #E5E7EB',
              borderTop: '2px solid #3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span>Loading dashboard data…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NocDashboard;