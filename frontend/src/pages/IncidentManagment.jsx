import React, { useState } from 'react';
import { Settings, Target, CheckCircle } from 'lucide-react';

import IncidentMappings from './IncidentMappings/IncidentMappings.jsx';
import IncidentRules from './IncidentRules.jsx';

import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' | 'rules'

  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const isMappings = activeTab === 'mappings';
  const isRules = activeTab === 'rules';

  return (
    <div style={{
      minHeight: '100vh',
      background: S.page.background || colors.bg.primary,
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* Tabs Wrapper */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 32
      }}>
        <div style={{
          background: colors.bg.secondary,
          borderRadius: 16,
          padding: 8,
          display: 'flex',
          gap: 8,
          boxShadow: colors.shadow.md,
          border: `1px solid ${colors.border.primary}`
        }}>

          {/* --- MAPPINGS TAB BUTTON --- */}
          <button
            onClick={() => setActiveTab('mappings')}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',

              background: isMappings
                ? colors.brand.primary
                : 'transparent',

              color: isMappings
                ? colors.text.inverse
                : colors.text.secondary,

              boxShadow: isMappings
                ? colors.shadow.md
                : 'none'
            }}
          >
            <Settings size={20} />
            System Mappings
          </button>

          {/* --- RULES TAB BUTTON --- */}
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',

              background: isRules
                ? colors.semantic.info
                : 'transparent',

              color: isRules
                ? colors.text.inverse
                : colors.text.secondary,

              boxShadow: isRules
                ? colors.shadow.md
                : 'none'
            }}
          >
            <Target size={20} />
            Smart Rules
          </button>
        </div>
      </div>

      {/* Content Box */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        background: colors.bg.secondary,
        borderRadius: 24,
        padding: 32,
        boxShadow: colors.shadow.xl,
        border: `1px solid ${colors.border.primary}`,
        minHeight: 'calc(100vh - 300px)'
      }}>
        {isMappings ? (
          <IncidentMappings />
        ) : (
          <IncidentRules />
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: 48,
        padding: 24,
        color: colors.text.secondary,
        fontSize: 14
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8
        }}>
          <CheckCircle size={16} style={{ color: colors.brand.primary }} />
          <span>Incident Management System</span>
        </div>
        <p style={{ margin: 0 }}>
          Streamlining alert-to-incident workflows with intelligent automation
        </p>
      </div>

    </div>
  );
};

export default IncidentManagement;
