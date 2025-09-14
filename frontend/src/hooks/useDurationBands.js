import React from 'react';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';

export const useDurationBands = (cfg) => {
  const bands = cfg.bands || DEFAULT_CLIENT_CFG.bands;

  const colorByDuration = (s) => {
    for (const b of bands) if (s >= b.min && s <= b.max) return b.color;
    return '#6B7280';
  };

  const Legend = () => (
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

  return { bands, colorByDuration, Legend };
};
