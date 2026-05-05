import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Target } from 'lucide-react'; // Added History icon

import IncidentMappings from './IncidentMappings/IncidentMappings.jsx';
import IncidentRules from './IncidentRules.jsx';

import { useTheme } from '../contexts/ThemeContext';
import { useTopBar } from '../contexts/TopBarContext';
import { createThemedStyles } from '../utils/themedStyles';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' | 'rules' 

  const { colors } = useTheme();
  const { setTopBarSlots, clearTopBarSlots } = useTopBar();
  const S = useMemo(() => createThemedStyles(colors), [colors]);

  const isMappings = activeTab === 'mappings';
  const isRules = activeTab === 'rules';
  const topBarSlots = useMemo(() => ({
    controls: (
      <div
        className="ops-topbar-segmented"
        style={{
          background: colors.bg.tertiary,
          border: `1px solid ${colors.border.primary}`,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('mappings')}
          className="ops-topbar-segment"
          style={{
            background: isMappings ? colors.brand.primary : 'transparent',
            color: isMappings ? colors.text.inverse : colors.text.secondary,
          }}
        >
          <Settings size={14} />
          System Mappings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className="ops-topbar-segment"
          style={{
            background: isRules ? colors.semantic.info : 'transparent',
            color: isRules ? colors.text.inverse : colors.text.secondary,
          }}
        >
          <Target size={14} />
          Smart Rules
        </button>
      </div>
    ),
  }), [colors, isMappings, isRules]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);

  return (
    <div style={{
      minHeight: '100vh',
      background: S.page.background || colors.bg.primary,
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
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
        {isMappings && <IncidentMappings />}
        {isRules && <IncidentRules />}
      </div>

    </div>
  );
};

export default IncidentManagement;

