import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';
import { navigationItems } from '../components/layout/Layout';

const PAGE_DESCRIPTIONS = {
  '/dashboard': '📊 Main dashboard with charts and KPIs',
  '/explorer': '🔍 Search and filter alerts',
  '/research': '🧪 Deep-dive research per panel',
  '/incident': '🎫 Incident rules and system mappings',
  '/incident-stats': '📈 Incident BI (clustered/raw stats)',
  '/how-to-use': '📖 How to use this dashboard',
};

const NotFoundPage = () => {
  const navigate = useNavigate();

  const { colors } = useTheme();
  const S = useMemo(() => createThemedStyles(colors), [colors]);
  return (
    <div style={S.card({ textAlign: 'center', maxWidth: 600, margin: '80px auto' })}>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: colors.text.tertiary,
          marginBottom: 16
        }}>
          404
        </div>

        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: colors.text.primary,
          margin: '0 0 8px 0'
        }}>
          Page Not Found
        </h1>

        <p style={{
          fontSize: 16,
          color: colors.text.secondary,
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
            background: colors.brand.primary,
            color: colors.text.inverse,
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
            border: `1px solid ${colors.border.secondary}`,
            borderRadius: 6,
            background: colors.bg.secondary,
            color: colors.text.secondary,
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
        background: colors.bg.tertiary,
        borderRadius: 8,
        border: `1px solid ${colors.border.primary}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12
        }}>
          <Search size={20} style={{ color: colors.text.secondary }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.text.primary }}>
            Available Pages
          </span>
        </div>

        <div style={{
          display: 'grid',
          gap: 8,
          fontSize: 14
        }}>
          {navigationItems.map(({ path, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: colors.brand.primary,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {PAGE_DESCRIPTIONS[path] || `${path} - ${label}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
