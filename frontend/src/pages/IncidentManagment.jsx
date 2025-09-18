import React, { useState } from 'react';
import { S } from '../utils/styles.jsx';
import IncidentMappings from './IncidentMappings.jsx';
import IncidentRules from './IncidentRules.jsx';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' | 'rules'

  return (
    <div style={S.container}>
     

      <div style={S.tabs}>
        <button
          style={{ ...S.tab, ...(activeTab === 'mappings' ? S.activeTab : S.inactiveTab) }}
          onClick={() => setActiveTab('mappings')}
>
          System Mappings
        </button>
        <button
          style={{ ...S.tab, ...(activeTab === 'rules' ? S.activeTab : S.inactiveTab) }}
          onClick={() => setActiveTab('rules')}
        >
          Incident Rules
        </button>
      </div>

      {activeTab === 'mappings' ? <IncidentMappings /> : <IncidentRules />}
    </div>
  );
};

export default IncidentManagement;