import React from 'react';
import { S } from '../utils/styles';
import { AlertTriangle } from '../icons';

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

export const ChartCard = ({ title, icon: Icon, loading, error, children, height = 300, legend }) => {
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
