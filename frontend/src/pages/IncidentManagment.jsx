import React, { useState } from 'react';
import { Settings, Target, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

// Import the updated components
import IncidentMappings from './IncidentMappings.jsx';
import IncidentRules from './IncidentRules.jsx';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' | 'rules'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
     

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 32
      }}>
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 8,
          display: 'flex',
          gap: 8,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid #f1f5f9'
        }}>
          <button
            style={{
              background: activeTab === 'mappings' 
                ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
                : 'transparent',
              color: activeTab === 'mappings' ? 'white' : '#64748b',
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
              boxShadow: activeTab === 'mappings' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
            }}
            onClick={() => setActiveTab('mappings')}
            onMouseOver={(e) => {
              if (activeTab !== 'mappings') {
                e.target.style.background = '#f8fafc';
                e.target.style.color = '#3b82f6';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'mappings') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#64748b';
              }
            }}
          >
            <Settings size={20} />
            System Mappings
          </button>
          
          <button
            style={{
              background: activeTab === 'rules' 
                ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' 
                : 'transparent',
              color: activeTab === 'rules' ? 'white' : '#64748b',
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
              boxShadow: activeTab === 'rules' ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
            }}
            onClick={() => setActiveTab('rules')}
            onMouseOver={(e) => {
              if (activeTab !== 'rules') {
                e.target.style.background = '#faf5ff';
                e.target.style.color = '#7c3aed';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'rules') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#64748b';
              }
            }}
          >
            <Target size={20} />
            Smart Rules
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'white',
        borderRadius: 24,
        padding: 32,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f1f5f9',
        minHeight: 'calc(100vh - 300px)'
      }}>
        {activeTab === 'mappings' ? (
          <div>
            <IncidentMappings />
          </div>
        ) : (
          <div>
          
            <IncidentRules />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: 48,
        padding: 24,
        color: '#94a3b8',
        fontSize: 14
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8
        }}>
          <CheckCircle size={16} />
          <span>Incident Management System</span>
        </div>
        <p style={{margin: 0}}>
          Streamlining alert-to-incident workflows with intelligent automation
        </p>
      </div>
    </div>
  );
};

export default IncidentManagement;