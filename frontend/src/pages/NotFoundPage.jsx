// pages/NotFoundPage.jsx — 404 Error Page
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const NotFoundPage = () => {
  const navigate = useNavigate();

  const { colors } = useTheme();
  const S = createThemedStyles(colors);
  return (
    <div style={S.card({ textAlign: 'center', maxWidth: 600, margin: '80px auto' })}>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: '#E5E7EB',
          marginBottom: 16
        }}>
          404
        </div>
        
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#1F2937',
          margin: '0 0 8px 0'
        }}>
          Page Not Found
        </h1>
        
        <p style={{
          fontSize: 16,
          color: '#6B7280',
          margin: 0,
          lineHeight: 1.5
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center'
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            border: 'none',
            borderRadius: 8,
            background: '#3B82F6',
            color: 'white',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Home size={18} />
          Go to Dashboard
        </button>
        
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            background: 'white',
            color: '#6B7280',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>

      <div style={{
        marginTop: 32,
        padding: 16,
        background: '#F9FAFB',
        borderRadius: 8,
        border: '1px solid #E5E7EB'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12
        }}>
          <Search size={20} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>
            Available Pages
          </span>
        </div>
        
        <div style={{
          display: 'grid',
          gap: 8,
          fontSize: 14
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: '#3B82F6',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📊 /dashboard - Main dashboard with charts and KPIs
          </button>
          
          <button
            onClick={() => navigate('/explorer')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: '#3B82F6',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🔍 /explorer - Search and filter alerts
          </button>
          
          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: '#3B82F6',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            ⚙️ /settings - Configure dashboard settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;