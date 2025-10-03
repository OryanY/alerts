import React, { Suspense } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Cell,Area, ComposedChart
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

import { AlertTriangle, Clock, Moon, Sun, TrendingUp, Shield, Network } from '../icons';
import { Share } from 'lucide-react';

const NocDashboard = () => {
  const { config, getApiParams } = useClientConfig();
  const { dateRange, setDateRange, setPresetRange, selectedPreset } = useDateRangeUrl();
  const { shareCurrentUrl } = useShareableUrl();
  const { colorByDuration, Legend } = useDurationBands(config);

  // Fix for "today" selection - adjust end_date to avoid validation error
  const adjustedDateRange = React.useMemo(() => {
    if (dateRange.start_date && dateRange.end_date && dateRange.start_date === dateRange.end_date) {
      return {
        start_date: dateRange.start_date,
        end_date: `${dateRange.end_date}T23:59:59`
      };
    }
    return dateRange;
  }, [dateRange]);

  // API params with false wakeup threshold from config
  const baseApiParams = {
    ...(adjustedDateRange.start_date && { start_date: adjustedDateRange.start_date }),
    ...(adjustedDateRange.end_date && { end_date: adjustedDateRange.end_date })
  };

  const configParams = getApiParams();
  const apiParams = {
    ...baseApiParams,
    // Include false wakeup threshold from settings
    false_wakeup_threshold: config.falseWakeupThreshold || 120,
    ...(configParams.day_start !== 8 && { day_start: configParams.day_start }),
    ...(configParams.day_end !== 22 && { day_end: configParams.day_end }),
    ...(configParams.dur_short_max !== 30 && { dur_short_max: configParams.dur_short_max }),
    ...(configParams.dur_medium_max !== 300 && { dur_medium_max: configParams.dur_medium_max })
  };

  // Existing API calls
  const exec = useApiData('/stats/executive-kpis', apiParams);
  const shifts = useApiData('/stats/shift-analysis', apiParams);
  const duration = useApiData('/stats/duration-histogram', apiParams);
  const heatmap = useApiData('/stats/hourly-heatmap', apiParams);
  const panelStats = useApiData('/stats/by-panel', { ...apiParams, limit: 20 });
  const timeseries = useApiData('/stats/timeseries', apiParams);
  const overview = useApiData('/stats/overview', apiParams);

  const isLoading = exec.loading || shifts.loading || duration.loading || heatmap.loading;

  return (
    <div>
      {/* Date Range Picker with selected preset indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={setDateRange}
            setPresetRange={setPresetRange}
          />
          {selectedPreset && (
            <span style={{ 
              padding: '4px 8px', 
              background: '#EBF8FF', 
              color: '#2563EB',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #BFDBFE'
            }}>
              {selectedPreset} Selected
            </span>
          )}
        </div>
        
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
        {/* Enhanced KPI Cards */}
        <div style={S.grid('repeat(auto-fit, minmax(280px, 1fr))')}>
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
            subtitle="Long vs Short duration alerts"
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="True Night Wakeups"
            value={exec.data?.true_wakeups ?? '—'}
            subtitle={`Alerts >${config.falseWakeupThreshold || 120}s at night`}
            icon={Moon}
            color="purple"
          />
          <MetricCard
            title="False Wakeup Rate"
            value={`${exec.data?.false_wakeup_rate ?? '—'}%`}
            subtitle={`Quick-resolving (≤${config.falseWakeupThreshold || 120}s) night alerts`}
            icon={Shield}
            color="red"
          />
          <MetricCard
            title="Avg Resolution Time"
            value={`${overview.data?.avg_duration ?? '—'}s`}
            subtitle="Mean time to resolve alerts"
            icon={Clock}
            color="green"
          />
        </div>

        {/* Charts Row 1 - Core Operations */}
        <div style={S.grid('1fr 1fr 1fr')}>
          <ChartCard title="Shift Distribution" icon={Sun} loading={shifts.loading} error={shifts.error}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shifts.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shift" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="alert_count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="false_wakeups" fill="#EF4444" radius={[4, 4, 0, 0]} />
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

          <WakeupGauge 
            shiftData={shifts.data} 
            loading={shifts.loading} 
            error={shifts.error}
            falseWakeupThreshold={config.falseWakeupThreshold || 120}
          />
        </div>

        {/* Charts Row 2 - Time Analysis */}
        <div style={S.grid('2fr 1fr')}>
          <ChartCard
            title="Hourly Alert Distribution"
            icon={Clock}
            loading={heatmap.loading}
            error={heatmap.error}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={heatmap.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour_display" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="count">
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
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

      
        </div>

        {/* Charts Row 3 - Trend and Pattern Analysis */}
        <div style={S.grid('2fr 1fr')}>
          <ChartCard
            title="Weekly Trends & Patterns"
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
                    new Date(d).toLocaleDateString('en-IL', { month: 'short', day: 'numeric' })
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
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_duration"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
                 <ChartCard
            title="Top Alert Sources"
            icon={Network}
            loading={panelStats.loading}
            error={panelStats.error}
          >
            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
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
                    border: `1px solid ${idx < 3 ? '#FCA5A5' : '#F3F4F6'}`
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {p.panel_title}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      {p.application}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.alert_count}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>
                      {p.avg_duration}s avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>   
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