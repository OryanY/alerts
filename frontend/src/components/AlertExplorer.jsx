import React, { useMemo, useState } from 'react';
import { S } from '../utils/styles';
import { JerusalemTime } from '../utils/time';
import { Search } from '../icons';

const ErrorCallout = ({ message, details }) => (
  <div style={{
    background: '#FEF2F2', border: '1px solid #FCA5A5',
    color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 16
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

export const AlertExplorer = ({ alerts, loading, error, colorByDuration }) => {
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

  if (error) return <ErrorCallout message={error.message} details={error} />;

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
            type="text" placeholder="Search all fields..." value={filters.search}
            onChange={(e)=>{ setFilters(prev => ({...prev, search: e.target.value})); setCurrentPage(1); }}
            style={S.input}
          />
          <input
            type="text" placeholder="Filter by panel..." value={filters.panel_title}
            onChange={(e)=>{ setFilters(prev => ({...prev, panel_title: e.target.value})); setCurrentPage(1); }}
            style={S.input}
          />
          <input
            type="text" placeholder="Filter by application..." value={filters.application}
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
                  <span style={{ 
                    background:`${'#000'}10`, 
                    color: '#111', 
                    padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:600
                  }}>
                    {/* הצבע מגיע מבחוץ כדי לא לתלות כאן את S.pill */}
                    <span style={{
                      background: colorByDuration(a.duration_sec),
                      borderRadius: 6,
                      color: 'white',
                      padding: '2px 6px'
                    }}>
                      {a.duration_sec}s
                    </span>
                  </span>
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
