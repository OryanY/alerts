import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

import { S } from '../utils/styles';
import { JerusalemTime, toYMD_IL } from '../utils/time';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useApiData } from '../hooks/useApiData';
import { useDurationBands } from '../hooks/useDurationBands';

import { DateRangePicker } from '../components/DateRangePicker';
import { MetricCard } from '../components/MetricCard';
import { ChartCard } from '../components/ChartCard';
import { AlertExplorer } from '../components/AlertExplorer';
import { WakeupGauge } from '../components/WakeupGauge';
import { ConfigPanel } from '../components/ConfigPanel';

import { AlertTriangle, BarChart3, Calendar, Clock, Eye, Moon, Settings, Sun, TrendingUp, Zap, Shield } from '../icons';

const NOCDashboard = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [configOpen, setConfigOpen] = useState(false);

  // Client config (persisted)
  const [clientCfg, setClientCfg] = useState(() => {
    const saved = localStorage.getItem('noc_client_cfg');
    return saved ? JSON.parse(saved) : DEFAULT_CLIENT_CFG;
  });

  // Initial date range: last 7 days incl. today in IL
  const [dateRange, setDateRange] = useState(() => {
    const now = Date.now();
    const endDate = toYMD_IL(now);
    const startDate = toYMD_IL(now - 6 * 864e5);
    return { start_date: startDate, end_date: endDate };
  });

  const { bands, colorByDuration, Legend } = useDurationBands(clientCfg);

  // Build query params (server will default if not provided)
  const cfgParams = {
    day_start: clientCfg.dayStart,
    day_end: clientCfg.dayEnd,
    night_start: clientCfg.nightStart,
    night_end: clientCfg.nightEnd,
    false_wakeup_threshold: clientCfg.falseWakeupThreshold,
    dur_short_max: bands.find(b=>b.key==='short')?.max ?? 59,
    dur_medium_max: bands.find(b=>b.key==='medium')?.max ?? 299
  };

  const validDateRange = dateRange?.start_date && dateRange?.end_date ? dateRange : {};

  // API calls — pass config + date range
  const exec       = useApiData('/stats/executive-kpis', { ...validDateRange, ...cfgParams });
  const shifts     = useApiData('/stats/shift-analysis', { ...validDateRange, ...cfgParams });
  const duration   = useApiData('/stats/duration-histogram', { ...validDateRange, ...cfgParams });
  const heatmap    = useApiData('/stats/hourly-heatmap', { ...validDateRange, ...cfgParams });
  const weekend    = useApiData('/stats/weekend-weekday', { ...validDateRange, ...cfgParams });
  const recent     = useApiData('/stats/recent-alerts', { hours:24, limit:15, ...cfgParams });
  const panelStats = useApiData('/stats/by-panel', { ...validDateRange, limit:20, ...cfgParams });
  const timeseries = useApiData('/stats/timeseries', { ...validDateRange, ...cfgParams });
  const alerts     = useApiData('/alerts', { ...validDateRange, limit:1000 });

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'explorer',  label: 'Explorer',  icon: Eye },
  ];

  const isLoading = exec.loading || shifts.loading || duration.loading || heatmap.loading;

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.headerRow}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(90deg,#EF4444,#F59E0B)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                <AlertTriangle size={18} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>Alert Stats</h1>
              </div>
            </div>

            <nav style={{ display:'flex', gap:8 }}>
              {navigation.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={()=>setCurrentPage(id)} style={S.navBtn(currentPage===id)}>
                  <Icon size={16} /> {label}
                </button>
              ))}
              <button onClick={()=>setConfigOpen(true)} style={S.navBtn(false)} title="Dashboard Config">
                <Settings size={16} /> Settings
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />

        {currentPage === 'dashboard' && (
          <div>
            {/* KPI Cards */}
            <div style={S.grid('repeat(auto-fit, minmax(300px, 1fr))')}>
              <MetricCard title="Total Alerts" value={exec.data?.total_alerts ?? 0} subtitle="All alerts in period" icon={AlertTriangle} color="orange" />
              <MetricCard title="Signal-to-Noise Ratio" value={`${exec.data?.signal_to_noise_ratio ?? 0}%`} subtitle="Meaningful vs noise alerts" icon={TrendingUp} color="blue" />
              <MetricCard title="True Night Wakeups" value={exec.data?.true_wakeups ?? 0} subtitle="Significant night alerts" icon={Moon} color="purple" />
              <MetricCard title="False Wakeup Rate" value={`${exec.data?.false_wakeup_rate ?? 0}%`} subtitle="Quick-resolving night alerts" icon={Shield} color="red" />
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
                    <Bar dataKey="alert_count" fill="#3B82F6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Duration Distribution" icon={Clock} legend={<Legend />} loading={duration.loading} error={duration.error}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={duration.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Charts Row 2 */}
            <div style={S.grid('2fr 1fr 1fr')}>
              <ChartCard title="Hourly Alert Distribution" icon={Clock} loading={heatmap.loading} error={heatmap.error}>
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

              <ChartCard title="Top Noisy Services" icon={Zap} loading={panelStats.loading} error={panelStats.error}>
                <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
                  {(panelStats.data||[]).slice(0,10).map((p,idx)=>(
                    <div key={`${p.panel_title}-${idx}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:12, background:'#F9FAFB', borderRadius:6, border:'1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{p.panel_title}</div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>{p.application}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:600 }}>{p.alert_count} alerts</div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>Avg: {p.avg_duration}s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard title="Weekend vs Weekday" icon={Calendar} loading={weekend.loading} error={weekend.error}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weekend.data || []}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={120}
                      paddingAngle={5}
                      dataKey="alert_count"
                    >
                      {(weekend.data || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#8B5CF6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Charts Row 3 */}
            <div style={S.grid('1fr 400px')}>
              <ChartCard title="Weekly Trends" icon={TrendingUp} loading={timeseries.loading} error={timeseries.error}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date_il" tickFormatter={(d)=>new Date(d).toLocaleDateString('en-IL', { month:'short', day:'numeric' })} />
                    <YAxis />
                    <Tooltip labelFormatter={(d)=>new Date(d).toLocaleDateString('en-IL')} />
                    <Line type="monotone" dataKey="alert_count" stroke="#3B82F6" strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="avg_duration" stroke="#10B981" strokeWidth={2} dot={{ r:3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <WakeupGauge shiftData={shifts.data} loading={shifts.loading} error={shifts.error} />
            </div>

            {/* Recent */}
            <ChartCard title="Recent Alerts (24h)" icon={Clock} loading={recent.loading} error={recent.error}>
              <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
                {(recent.data||[]).map((a,i)=>(
                  <div key={a.id||i} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center', padding:12,
                    background:'#F9FAFB', borderRadius:6, borderLeft:`4px solid ${colorByDuration(a.duration_sec)}`
                  }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }} title={a.panel_title || 'Unknown Panel'}>
                        {(a.panel_title || 'Unknown Panel').slice(0,40)}{(a.panel_title||'').length>40?'…':''}
                      </div>
                      <div style={{ fontSize:11, color:'#6B7280' }}>
                        {a.application || 'N/A'} • {JerusalemTime.formatTime(a.time_fired_il || a.time_fired_utc)}
                      </div>
                    </div>
                    <div style={{ 
                      background:`${colorByDuration(a.duration_sec)}20`,
                      color: colorByDuration(a.duration_sec),
                      padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:600
                    }}>
                      {a.duration_sec}s
                    </div>
                  </div>
                ))}
                {(!recent.data || !recent.data.length) && !recent.loading && (
                  <div style={{ textAlign:'center', color:'#6B7280' }}>No alerts in last 24h</div>
                )}
              </div>
            </ChartCard>
          </div>
        )}

        {currentPage === 'explorer' && (
          <AlertExplorer alerts={alerts.data} loading={alerts.loading} error={alerts.error} colorByDuration={colorByDuration} />
        )}
      </main>

      {/* Footer */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:14, color:'#6B7280' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span>Alert Stats</span>
              <span>•</span>
              <span>Asia/Jerusalem (display only)</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Clock size={16} />
              <span>Last updated: {JerusalemTime.formatTime(new Date().toISOString())}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Loading Overlay */}
      {isLoading && currentPage === 'dashboard' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'white', padding:24, borderRadius:8, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:20, height:20, border:'2px solid #E5E7EB', borderTop:'2px solid #3B82F6', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
            <span>Loading dashboard data…</span>
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        button:hover { opacity: 0.9; } button:active { transform: translateY(1px); }
      `}</style>

      <ConfigPanel clientCfg={clientCfg} setClientCfg={setClientCfg} isOpen={configOpen} onToggle={setConfigOpen} />
    </div>
  );
};

export default NOCDashboard;
