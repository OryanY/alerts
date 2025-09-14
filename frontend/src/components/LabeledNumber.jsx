import React from 'react';

export const LabeledNumber = ({ label, value, onChange, small }) => (
  <label style={{ display:'grid', gap:4, fontSize: small?12:14 }}>
    <span style={{ color:'#374151' }}>{label}</span>
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding:'6px 8px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:small?12:14 }}
    />
  </label>
);
