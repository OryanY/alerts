import React from 'react';
import { Calendar } from '../icons';
import { S } from '../utils/styles';
import { toYMD_IL } from '../utils/time';
import { JERUSALEM_TZ } from '../utils/constants';

const fmtIL = new Intl.DateTimeFormat('en-CA', { timeZone: JERUSALEM_TZ });

export const DateRangePicker = ({ dateRange, onChange }) => {
  const setPreset = (days) => {
    const now = Date.now();
    const endDate = toYMD_IL(now);
    const startDate = fmtIL.format(new Date(now - (days - 1) * 864e5)); // inclusive today
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
