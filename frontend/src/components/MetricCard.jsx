import React from 'react';
import { S } from '../utils/styles';
import { TrendingUp, TrendingDown } from '../icons';

export const MetricCard = ({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) => {
  const colors = { blue:'#3B82F6', purple:'#8B5CF6', red:'#EF4444', green:'#10B981', orange:'#F59E0B', yellow:'#EAB308' };
  const c = colors[color] || colors.blue;
  return (
    <div style={S.card()}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div style={S.kpiIconWrap(c)}>{Icon && <Icon size={20} style={{ color:c }} />}</div>
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
