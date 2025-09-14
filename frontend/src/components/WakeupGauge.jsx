import React from 'react';
import { S } from '../utils/styles';
import { Moon } from '../icons';

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

export const WakeupGauge = ({ shiftData, loading, error }) => {
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
