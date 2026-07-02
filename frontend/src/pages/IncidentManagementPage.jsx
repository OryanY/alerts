import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Target, FileSliders } from 'lucide-react';

import IncidentMappings from './IncidentMappings/IncidentMappings.jsx';
import IncidentRules from './IncidentRules.jsx';
import IncidentDefaultsTab from '../components/IncidentDefaults/IncidentDefaultsTab.jsx';

import { useTheme } from '../contexts/ThemeContext';
import { useTopBar } from '../contexts/TopBarContext';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' | 'rules' | 'defaults'

  const { colors } = useTheme();
  const { setTopBarSlots, clearTopBarSlots } = useTopBar();

  const isMappings = activeTab === 'mappings';
  const isRules = activeTab === 'rules';
  const isDefaults = activeTab === 'defaults';
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
        <button
          type="button"
          onClick={() => setActiveTab('defaults')}
          className="ops-topbar-segment"
          style={{
            background: isDefaults ? colors.semantic.warning : 'transparent',
            color: isDefaults ? colors.text.inverse : colors.text.secondary,
          }}
        >
          <FileSliders size={14} />
          Incident Defaults
        </button>
      </div>
    ),
  }), [colors, isMappings, isRules, isDefaults]);

  useEffect(() => {
    setTopBarSlots(topBarSlots);
    return clearTopBarSlots;
  }, [setTopBarSlots, clearTopBarSlots, topBarSlots]);

  return (
    // Layout already provides the page shell (background + outer padding via
    // .ops-main) — this only needs its own card, not a second full-viewport wrapper.
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      background: colors.bg.secondary,
      borderRadius: 24,
      padding: 32,
      boxShadow: colors.shadow.xl,
      border: `1px solid ${colors.border.primary}`,
    }}>
      {isMappings && <IncidentMappings />}
      {isRules && <IncidentRules />}
      {isDefaults && <IncidentDefaultsTab />}
    </div>
  );
};

export default IncidentManagement;

