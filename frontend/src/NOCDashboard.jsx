// NOCDashboard.jsx — Inline-styled, API-powered (no Tailwind, no mocks)
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  Clock, AlertTriangle, TrendingUp, TrendingDown, Moon, Sun, Eye, Settings, Search, Calendar,
  Activity, Zap, Shield, BarChart3
} from 'lucide-react';

// ===== Config =====
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';
const JERUSALEM_TZ = 'Asia/Jerusalem';

// ===== Jerusalem Timezone: display-only utilities =====
const JerusalemTime = {
  formatTime: (ts) => {
    if (!ts) return '—';
    return new Intl.DateTimeFormat('en-IL', {
      timeZone: JERUSALEM_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(ts));
  },
  formatDateTime: (ts) => {
    if (!ts) return '—';
    return new Intl.DateTimeFormat('en-IL', {
      timeZone: JERUSALEM_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(ts));
  }
};

// Helper: IL calendar formatter for YYYY-MM-DD
const fmtIL = new Intl.DateTimeFormat('en-CA', { timeZone: JERUSALEM_TZ });
const toYMD_IL = (dateOrMs) => fmtIL.format(new Date(dateOrMs));
const DateRangePicker = ({ dateRange, onChange }) => {
  const setPreset = (days) => {
    const now = Date.now();
    const endDate = toYMD_IL(now);
    const startDate = toYMD_IL(now - (days - 1) * 864e5); // inclusive today
    onChange({ start_date: startDate, end_date: endDate });
  };

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, marginBottom:16,
      padding:'12px 16px', background:'white', borderRadius:8,
      border:'1px solid #E5E7EB', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <Calendar size={16} style={{ color:'#6B7280' }} />
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input
          type="date"
          value={dateRange.start_date || ''}
          onChange={(e)=>onChange(prev=>({...prev, start_date:e.target.value||''}))}
          style={{ padding:'4px 8px', border:'1px solid #D1D5DB', borderRadius:4, fontSize:14 }}
        />
        <span style={{ color:'#6B7280' }}>to</span>
        <input
          type="date"
          value={dateRange.end_date || ''}
          onChange={(e)=>onChange(prev=>({...prev, end_date:e.target.value||''}))}
          style={{ padding:'4px 8px', border:'1px solid #D1D5DB', borderRadius:4, fontSize:14 }}
        />
      </div>
      <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
        <button onClick={()=>setPreset(1)}  style={{ padding:'4px 8px', fontSize:12, border:'1px solid #D1D5DB', borderRadius:4, background:'white', cursor:'pointer' }}>Today</button>
        <button onClick={()=>setPreset(7)}  style={{ padding:'4px 8px', fontSize:12, border:'1px solid #D1D5DB', borderRadius:4, background:'white', cursor:'pointer' }}>7 Days</button>
        <button onClick={()=>setPreset(30)} style={{ padding:'4px 8px', fontSize:12, border:'1px solid #D1D5DB', borderRadius:4, background:'white', cursor:'pointer' }}>30 Days</button>
      </div>
    </div>
  );
};

// ===== Default client config (overridable via UI) =====
const DEFAULT_CLIENT_CFG = {
  dayStart: 8,
  dayEnd: 22,
  nightStart: 22,
  nightEnd: 8,
  falseWakeupThreshold: 120,
  bands: [
    { key: 'short', label: 'Short',       min: 0,   max: 59,  color: '#10B981' },
    { key: 'medium',label: 'Medium ',      min: 60,  max: 299, color: '#F59E0B' },
    { key: 'long',  label: 'Long ',       min: 300, max: 899, color: '#EF4444' },
    { key: 'xl',    label: 'Very Long',   min: 900, max: 1e9, color: '#DC2626' },
  ],
};

// ===== Inline style helpers =====
const S = {
  page: { minHeight:'100vh', background:'#F9FAFB' },
  header: { background:'white', borderBottom:'1px solid #E5E7EB', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },
  headerInner: { maxWidth:1200, margin:'0 auto', padding:'0 20px' },
  headerRow: { display:'flex', justifyContent:'space-between', alignItems:'center', height:64 },
  navBtn: (active) => ({
    display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
    border:'none', borderRadius:6, background: active ? '#3B82F6' : 'transparent',
    color: active ? 'white' : '#6B7280', fontSize:14, fontWeight:500, cursor:'pointer'
  }),
  main: { maxWidth:1200, margin:'0 auto', padding:20 },
  card: (extra={}) => ({
    background:'white', border:'1px solid #E5E7EB', borderRadius:8, padding:20,
    boxShadow:'0 1px 3px rgba(0,0,0,0.1)', ...extra
  }),
  kpiIconWrap: (color) => ({
    width:40, height:40, borderRadius:8, background:`${color}20`,
    display:'flex', alignItems:'center', justifyContent:'center'
  }),
  pill: (color) => ({
    background:`${color}20`, color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:600
  }),
  input: { padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:14 },
  select: { padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:14 },
  tableHeadCell: { padding:12, textAlign:'left', cursor:'pointer', fontWeight:600, borderBottom:'2px solid #E5E7EB' },
  tableCell: { padding:12 },
  grid: (template) => ({ display:'grid', gridTemplateColumns:template, gap:20, marginBottom:24 }),
  footer: { background:'white', borderTop:'1px solid #E5E7EB', marginTop:40 },
  footerInner: { maxWidth:1200, margin:'0 auto', padding:'16px 20px' },
  skeleton: (w='100%', h=20) => ({ backgroundColor:'#F3F4F6', height:h, width:w, borderRadius:4, animation:'pulse 2s ease-in-out infinite' }),
};

// ===== Data hook with robust error handling =====
const useApiData = (endpoint, params = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryString = new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== '' && v != null)
      ).toString();

      const url = `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json.data || json);
    } catch (e) {
      setError({
        message: e.message || 'Unknown error',
        endpoint,
        params,
        timestamp: new Date().toISOString(),
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // re-fetch on endpoint/param changes
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [endpoint, JSON.stringify(params)]);
  return { data, loading, error, refetch: fetchData };
};

// ===== UI helpers =====
const ErrorCallout = ({ message, details }) => (
  <div style={{
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    color: '#991B1B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  }}>
    <strong>Request failed:</strong> {message}
    {details && process.env.NODE_ENV === 'development' && (
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }}>Debug Details</summary>
        <pre style={{ fontSize: 10, marginTop: 4, overflow: 'auto', maxHeight: 100 }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      </details>
    )}
  </div>
);

const LoadingSkeleton = ({ width = '100%', height = 20 }) => (
  <div style={S.skeleton(width, height)} />
);

// ===== Duration band helpers (shared across charts) =====
const useDurationBands = (cfg) => {
  const bands = cfg.bands || DEFAULT_CLIENT_CFG.bands;
  const colorByDuration = (s) => {
    for (const b of bands) if (s >= b.min && s <= b.max) return b.color;
    return '#6B7280';
  };
  const legend = () => (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, marginTop:8 }}>
      {bands.map(b => (
        <span key={b.key} style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'2px 8px', borderRadius:12, background:`${b.color}20`,
          color:b.color, fontWeight:600
        }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:b.color }} />
          {b.label}
        </span>
      ))}
    </div>
  );
  return { bands, colorByDuration, Legend: legend };
};

// ===== Config Panel (client side, inline) =====
const ConfigPanel = ({ clientCfg, setClientCfg, isOpen, onToggle }) => {
  const [local, setLocal] = useState(clientCfg);
  useEffect(() => setLocal(clientCfg), [clientCfg]);

  const save = () => {
    const toInt = (v, d) => Number.isFinite(+v) ? parseInt(v,10) : d;
    const next = {
      ...local,
      dayStart: toInt(local.dayStart, DEFAULT_CLIENT_CFG.dayStart),
      dayEnd: toInt(local.dayEnd, DEFAULT_CLIENT_CFG.dayEnd),
      nightStart: toInt(local.nightStart, DEFAULT_CLIENT_CFG.nightStart),
      nightEnd: toInt(local.nightEnd, DEFAULT_CLIENT_CFG.nightEnd),
      falseWakeupThreshold: toInt(local.falseWakeupThreshold, DEFAULT_CLIENT_CFG.falseWakeupThreshold),
      bands: local.bands.map(b => ({ ...b, min: toInt(b.min, 0), max: toInt(b.max, 1e9) }))
    };
    setClientCfg(next);
    localStorage.setItem('noc_client_cfg', JSON.stringify(next));
    onToggle(false);
  };

  const reset = () => {
    setClientCfg(DEFAULT_CLIENT_CFG);
    localStorage.removeItem('noc_client_cfg');
    onToggle(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
      <div style={{ ...S.card({ maxWidth:900, width:'100%', maxHeight:'90vh', overflowY:'auto', borderRadius:16 }) }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ padding:8, background:'#DBEAFE', borderRadius:8 }}>
              <Settings size={18} style={{ color:'#2563EB' }} />
            </div>
            <div>
              <div style={{ fontWeight:700 }}>Dashboard Configuration</div>
              <div style={{ fontSize:12, color:'#6B7280' }}>Customize thresholds and display settings</div>
            </div>
          </div>
          <button onClick={()=>onToggle(false)} style={{ padding:8, borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', marginBottom:12 }}>
          <LabeledNumber label="Day Start (0–23)" value={local.dayStart} onChange={v=>setLocal(p=>({...p,dayStart:v}))}/>
          <LabeledNumber label="Day End (0–23)" value={local.dayEnd} onChange={v=>setLocal(p=>({...p,dayEnd:v}))}/>
          <LabeledNumber label="Night Start (0–23)" value={local.nightStart} onChange={v=>setLocal(p=>({...p,nightStart:v}))}/>
          <LabeledNumber label="Night End (0–23)" value={local.nightEnd} onChange={v=>setLocal(p=>({...p,nightEnd:v}))}/>
          <LabeledNumber label="False Wakeup ≤ (sec)" value={local.falseWakeupThreshold} onChange={v=>setLocal(p=>({...p,falseWakeupThreshold:v}))}/>
        </div>

        <div style={{ marginTop:4 }}>
          <strong>Duration Bands</strong>
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', marginTop:8 }}>
            {local.bands.map((b, idx) => (
              <div key={b.key} style={{ border:'1px solid #E5E7EB', borderRadius:6, padding:8, background:'#F9FAFB' }}>
                <div style={{ fontWeight:600, marginBottom:6, color:b.color }}>{b.label}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <LabeledNumber small label="Min" value={b.min} onChange={v=>setLocal(prev=>({...prev, bands: prev.bands.map((x,i)=>i===idx?{...x,min:v}:x)}))}/>
                  <LabeledNumber small label="Max" value={b.max} onChange={v=>setLocal(prev=>({...prev, bands: prev.bands.map((x,i)=>i===idx?{...x,max:v}:x)}))}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={reset} style={{ padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, background:'white', cursor:'pointer', fontWeight:600 }}>Reset</button>
          <button onClick={save}  style={{ padding:'8px 12px', border:'1px solid #1D4ED8', borderRadius:6, background:'#3B82F6', color:'white', cursor:'pointer', fontWeight:600 }}>Apply</button>
        </div>
      </div>
    </div>
  );
};

const LabeledNumber = ({ label, value, onChange, small }) => (
  <label style={{ display:'grid', gap:4, fontSize: small?12:14 }}>
    <span style={{ color:'#374151' }}>{label}</span>
    <input type="number" value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding:'6px 8px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:small?12:14 }} />
  </label>
);

// ===== Metric / KPI card =====
const MetricCard = ({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) => {
  const colors = { blue:'#3B82F6', purple:'#8B5CF6', red:'#EF4444', green:'#10B981', orange:'#F59E0B', yellow:'#EAB308' };
  const c = colors[color] || colors.blue;
  return (
    <div style={S.card()}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div style={S.kpiIconWrap(c)}><Icon size={20} style={{ color:c }} /></div>
        {typeof trend === 'number' && (
          <div style={{ display:'flex', alignItems:'center', gap:4, color: trend > 0 ? '#10B981' : '#EF4444' }}>
            {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span style={{ fontSize:12, fontWeight:500 }}>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontSize:24, fontWeight:700, margin:'0 0 4px 0' }}>{value}</h3>
        <p style={{ fontSize:14, fontWeight:500, color:'#111827', margin:'0 0 4px 0' }}>{title}</p>
        {subtitle && <p style={{ fontSize:12, color:'#6B7280', margin:0 }}>{subtitle}</p>}
      </div>
    </div>
  );
};

// ===== Chart Card wrapper =====
const ChartCard = ({ title, icon: Icon, loading, error, children, height = 300, legend }) => {
  if (error) {
    return (
      <div style={S.card({ border:'1px solid #FCA5A5' })}>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#991B1B', marginBottom:8 }}>
          <AlertTriangle size={16} /><span style={{ fontWeight:600 }}>Error loading data</span>
        </div>
        <p style={{ color:'#B91C1C', fontSize:13 }}>{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={S.card()}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={S.skeleton(24,24)} />
          <div style={S.skeleton(120,20)} />
        </div>
        <div style={{ ...S.skeleton('100%', height), borderRadius:8 }} />
      </div>
    );
  }

  return (
    <div style={S.card()}>
      <h3 style={{ display:'flex', alignItems:'center', gap:8, fontSize:16, fontWeight:600, margin:'0 0 12px 0' }}>
        {Icon && <Icon size={16} />} {title}
      </h3>
      {legend}
      <div style={{ width:'100%', height }}>{children}</div>
    </div>
  );
};

// ===== Alert Explorer =====
const AlertExplorer = ({ alerts, loading, error, colorByDuration }) => {
  const [filters, setFilters] = useState({ search: '', panel_title: '', application: '', duration_category: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'time_fired_il', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter(alert => {
      const searchMatch = !filters.search || JSON.stringify(alert).toLowerCase().includes(filters.search.toLowerCase());
      const panelMatch = !filters.panel_title || (alert.panel_title || '').toLowerCase().includes(filters.panel_title.toLowerCase());
      const appMatch = !filters.application || (alert.application || '').toLowerCase().includes(filters.application.toLowerCase());
      const durationMatch = !filters.duration_category || alert.duration_category === filters.duration_category;
      return searchMatch && panelMatch && appMatch && durationMatch;
    });
  }, [alerts, filters]);

  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'time_fired_il' || sortConfig.key === 'time_fired_utc') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortConfig.key === 'duration_sec' || sortConfig.key === 'id') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [filteredAlerts, sortConfig]);

  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAlerts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAlerts, currentPage]);

  const totalPages = Math.ceil(sortedAlerts.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  if (error) {
    return <ErrorCallout message={error.message} details={error} />;
  }

  if (loading) {
    return (
      <div style={S.card()}>
        <div style={{ ...S.skeleton('30%', 24), marginBottom:16 }} />
        <div style={S.skeleton('100%', 300)} />
      </div>
    );
  }

  return (
    <div style={S.card()}>
      <div style={{ marginBottom:20 }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:8, fontSize:16, fontWeight:600, margin:'0 0 16px 0' }}>
          <Search size={16} /> Alert Explorer ({sortedAlerts.length} alerts)
        </h3>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
          <input
            type="text"
            placeholder="Search all fields..."
            value={filters.search}
            onChange={(e)=>{ setFilters(prev => ({...prev, search: e.target.value})); setCurrentPage(1); }}
            style={S.input}
          />
          <input
            type="text"
            placeholder="Filter by panel..."
            value={filters.panel_title}
            onChange={(e)=>{ setFilters(prev => ({...prev, panel_title: e.target.value})); setCurrentPage(1); }}
            style={S.input}
          />
          <input
            type="text"
            placeholder="Filter by application..."
            value={filters.application}
            onChange={(e)=>{ setFilters(prev => ({...prev, application: e.target.value})); setCurrentPage(1); }}
            style={S.input}
          />
          <select
            value={filters.duration_category}
            onChange={(e)=>{ setFilters(prev => ({...prev, duration_category: e.target.value})); setCurrentPage(1); }}
            style={S.select}
          >
            <option value="">All Durations</option>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
            <option value="xl">Very Long</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX:'auto', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14, minWidth:800 }}>
          <thead>
            <tr style={{ background:'#F9FAFB' }}>
              {[
                ['id','ID'], ['panel_title','Panel'], ['application','Application'],
                ['time_fired_il','Time Fired (JL)'], ['duration_sec','Duration'], ['operator','Operator']
              ].map(([key,label]) => (
                <th key={key} onClick={()=>handleSort(key)} style={S.tableHeadCell}>
                  {label} {sortConfig.key === key ? (sortConfig.direction==='asc'?'↑':'↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedAlerts.map((a, i) => (
              <tr key={a.id || i} style={{ borderBottom:'1px solid #F3F4F6' }}>
                <td style={{ ...S.tableCell, color:'#6B7280' }}>{a.id}</td>
                <td style={S.tableCell} title={a.panel_title || 'N/A'}>{a.panel_title || 'N/A'}</td>
                <td style={S.tableCell}>{a.application || 'N/A'}</td>
                <td style={{ ...S.tableCell, fontSize:13 }}>{JerusalemTime.formatDateTime(a.time_fired_il || a.time_fired_utc)}</td>
                <td style={S.tableCell}>
                  <span style={S.pill(colorByDuration(a.duration_sec))}>{a.duration_sec}s</span>
                </td>
                <td style={S.tableCell}>{a.operator || 'System/Auto'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
          <div style={{ fontSize:14, color:'#6B7280' }}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedAlerts.length)} of {sortedAlerts.length} alerts
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={()=>setCurrentPage(Math.max(1, currentPage-1))}
              disabled={currentPage===1}
              style={{
                padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6,
                background: currentPage===1?'#F3F4F6':'white',
                color: currentPage===1?'#9CA3AF':'#374151',
                cursor: currentPage===1?'not-allowed':'pointer'
              }}>
              Previous
            </button>
            <span style={{ display:'flex', alignItems:'center', padding:'0 12px', fontSize:14 }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={()=>setCurrentPage(Math.min(totalPages, currentPage+1))}
              disabled={currentPage===totalPages}
              style={{
                padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6,
                background: currentPage===totalPages?'#F3F4F6':'white',
                color: currentPage===totalPages?'#9CA3AF':'#374151',
                cursor: currentPage===totalPages?'not-allowed':'pointer'
              }}>
              Next
            </button>
          </div>
        </div>
      )}

      {sortedAlerts.length === 0 && !loading && (
        <div style={{ marginTop:16, padding:12, background:'#F9FAFB', borderRadius:6, textAlign:'center', color:'#6B7280', fontSize:14 }}>
          No alerts match the current filters
        </div>
      )}
    </div>
  );
};

// ===== Wakeup Gauge =====
const WakeupGauge = ({ shiftData, loading, error }) => {
  if (error) return <ErrorCallout message={error.message} details={error} />;

  if (loading) {
    return (
      <div style={S.card({ height:350 })}>
        <div style={{ ...S.skeleton('40%', 20), marginBottom:20 }} />
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:200 }}>
          <div style={{ ...S.skeleton(200,200), borderRadius:'50%' }} />
        </div>
      </div>
    );
  }

  const nightShift = shiftData?.find(s => s.shift === 'Night');
  const falseWakeups = nightShift?.false_wakeups || 0;
  const trueAlerts = nightShift?.true_alerts || 0;
  const total = falseWakeups + trueAlerts;
  const falsePct = total ? (falseWakeups / total) * 100 : 0;

  return (
    <div style={S.card()}>
      <h3 style={{ display:'flex', alignItems:'center', gap:8, fontSize:16, fontWeight:600, margin:'0 0 20px 0' }}>
        <Moon size={16} style={{ color:'#8B5CF6' }} /> Night Wakeup Analysis
      </h3>
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', marginBottom:16 }}>
        <div style={{ position:'relative', width:200, height:200 }}>
          <svg width="200" height="200" viewBox="0 0 100 100" style={{ transform:'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="45" stroke="#E5E7EB" strokeWidth="10" fill="none" />
            <circle cx="50" cy="50" r="45" stroke="#EF4444" strokeWidth="10" fill="none"
              strokeDasharray={`${falsePct * 2.827} 282.7`} strokeLinecap="round" />
          </svg>
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827' }}>{falseWakeups} False / {total}</div>
            <div style={{ fontSize:12, color:'#6B7280' }}>False Rate: {nightShift?.false_wakeup_rate || 0}%</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign:'center', fontSize:12, color:'#6B7280' }}>
        <span style={{ marginRight:12 }}>True: {trueAlerts}</span>
        <span>False: {falseWakeups}</span>
      </div>
    </div>
  );
};

// ===== Main Dashboard (API-powered) =====
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
    // duration bands (short/medium boundaries)
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
                    <div style={S.pill(colorByDuration(a.duration_sec))}>{a.duration_sec}s</div>
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

      {/* Config Modal */}
      <ConfigPanel clientCfg={clientCfg} setClientCfg={setClientCfg} isOpen={configOpen} onToggle={setConfigOpen} />
    </div>
  );
};

export default NOCDashboard;
