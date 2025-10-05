import React from 'react';
import { S } from '../utils/styles';
import { TrendingUp, TrendingDown } from '../icons';

export const MetricCard = ({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) => {
  const colors = {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    red: '#EF4444',
    green: '#10B981',
    orange: '#F59E0B',
    yellow: '#EAB308'
  };
  const c = colors[color] || colors.blue;

  return (
    <div style={S.card()}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12
      }}>
        {/* Icon centered at top */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: `${c}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={24} style={{ color: c }} />
        </div>

        {/* Trend indicator (if present) */}
        {typeof trend === 'number' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: trend > 0 ? '#10B981' : '#EF4444'
          }}>
            {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {Math.abs(trend)}%
            </span>
          </div>
        )}

        {/* Value (large number) */}
        <h3 style={{ 
          fontSize: 28, 
          fontWeight: 700, 
          margin: 0,
          color: '#111827'
        }}>
          {value}
        </h3>

        {/* Title */}
        <p style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: '#111827', 
          margin: 0,
          lineHeight: 1.3
        }}>
          {title}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p style={{ 
            fontSize: 12, 
            color: '#6B7280', 
            margin: 0,
            lineHeight: 1.4,
            maxWidth: '90%'
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};