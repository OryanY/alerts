// pages/SettingsPage.jsx — Settings page with client config management
import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { S } from '../utils/styles';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useClientConfig } from '../contexts/ClientConfigContext';

const SettingsPage = () => {
  const { config, updateConfig, resetConfig } = useClientConfig();
  const [localConfig, setLocalConfig] = useState(config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    setHasUnsavedChanges(false);
  }, [config]);

  useEffect(() => {
    const isDifferent = JSON.stringify(localConfig) !== JSON.stringify(config);
    setHasUnsavedChanges(isDifferent);
  }, [localConfig, config]);

  const handleSave = () => {
    updateConfig(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_CLIENT_CFG);
    resetConfig();
  };

  const updateLocalConfig = (path, value) => {
    setLocalConfig(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const LabeledInput = ({ label, value, onChange, type = 'number', min, max, placeholder, description }) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
        {label}
        {description && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
            {description}
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value)}
        min={min}
        max={max}
        placeholder={placeholder}
        style={S.input}
      />
    </div>
  );

  const ColorInput = ({ label, value, onChange }) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 40, height: 40, border: 'none', borderRadius: 6, cursor: 'pointer' }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...S.input, flex: 1 }}
          placeholder="#000000"
        />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>
          Dashboard Settings
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
          Configure thresholds, shifts, and display preferences for the dashboard.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {/* Shift Configuration */}
        <div style={S.card()}>
          <h3 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 16px 0' 
          }}>
            <Settings size={18} />
            Shift Configuration
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            <LabeledInput
              label="Day Shift Start"
              value={localConfig.dayStart}
              onChange={(value) => updateLocalConfig('dayStart', value)}
              min={0}
              max={23}
              description="Hour when day shift begins (0-23)"
            />
            <LabeledInput
              label="Day Shift End"
              value={localConfig.dayEnd}
              onChange={(value) => updateLocalConfig('dayEnd', value)}
              min={0}
              max={23}
              description="Hour when day shift ends (0-23)"
            />
            <LabeledInput
              label="Night Shift Start"
              value={localConfig.nightStart}
              onChange={(value) => updateLocalConfig('nightStart', value)}
              min={0}
              max={23}
              description="Hour when night shift begins (0-23)"
            />
            <LabeledInput
              label="Night Shift End"
              value={localConfig.nightEnd}
              onChange={(value) => updateLocalConfig('nightEnd', value)}
              min={0}
              max={23}
              description="Hour when night shift ends (0-23)"
            />
          </div>

          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#EBF8FF', 
            borderRadius: 6, 
            border: '1px solid #BFDBFE' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Info size={16} style={{ color: '#2563EB' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>
                Current Schedule
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#1E40AF' }}>
              Day: {String(localConfig.dayStart).padStart(2, '0')}:00 - {String(localConfig.dayEnd).padStart(2, '0')}:00 • 
              Night: {String(localConfig.nightStart).padStart(2, '0')}:00 - {String(localConfig.nightEnd).padStart(2, '0')}:00
            </div>
          </div>
        </div>

        {/* Alert Thresholds */}
        <div style={S.card()}>
          <h3 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 16px 0' 
          }}>
            Alert Thresholds
          </h3>
          
          <div style={{ marginBottom: 16 }}>
            <LabeledInput
              label="False Wakeup Threshold"
              value={localConfig.falseWakeupThreshold}
              onChange={(value) => updateLocalConfig('falseWakeupThreshold', value)}
              min={0}
              description="Night alerts ≤ this duration (seconds) are considered false wakeups"
            />
          </div>
        </div>

        {/* Duration Bands */}
        <div style={S.card()}>
          <h3 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 16px 0' 
          }}>
            Duration Categories
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gap: 16, 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' 
          }}>
            {localConfig.bands.map((band, idx) => (
              <div key={band.key} style={{ 
                border: '1px solid #E5E7EB', 
                borderRadius: 8, 
                padding: 16, 
                background: '#F9FAFB' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  marginBottom: 12 
                }}>
                  <div style={{ 
                    width: 16, 
                    height: 16, 
                    borderRadius: '50%', 
                    background: band.color 
                  }} />
                  <span style={{ fontWeight: 600, color: band.color }}>
                    {band.label}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gap: 12 }}>
                  <LabeledInput
                    label="Label"
                    type="text"
                    value={band.label}
                    onChange={(value) => updateLocalConfig(`bands.${idx}.label`, value)}
                  />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <LabeledInput
                      label="Min (seconds)"
                      value={band.min}
                      onChange={(value) => updateLocalConfig(`bands.${idx}.min`, value)}
                      min={0}
                    />
                    <LabeledInput
                      label="Max (seconds)"
                      value={band.max}
                      onChange={(value) => updateLocalConfig(`bands.${idx}.max`, value)}
                      min={0}
                    />
                  </div>
                  
                  <ColorInput
                    label="Color"
                    value={band.color}
                    onChange={(value) => updateLocalConfig(`bands.${idx}.color`, value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#FEF3C7', 
            borderRadius: 6, 
            border: '1px solid #FDE68A' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Info size={16} style={{ color: '#D97706' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
                Duration Band Preview
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {localConfig.bands.map(band => (
                <span key={band.key} style={{
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6,
                  padding: '4px 8px', 
                  borderRadius: 12, 
                  background: `${band.color}20`,
                  color: band.color, 
                  fontWeight: 600,
                  fontSize: 12
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.color }} />
                  {band.label} ({band.min}-{band.max === 1e9 ? '∞' : band.max}s)
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={S.card()}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>
                Actions
              </h3>
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
                Save your changes or reset to default configuration
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  border: '1px solid #DC2626',
                  borderRadius: 6,
                  background: 'white',
                  color: '#DC2626',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                <RotateCcw size={16} />
                Reset to Defaults
              </button>
              
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  border: '1px solid #1D4ED8',
                  borderRadius: 6,
                  background: hasUnsavedChanges ? '#3B82F6' : '#F3F4F6',
                  color: hasUnsavedChanges ? 'white' : '#9CA3AF',
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                <Save size={16} />
                {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
              </button>
            </div>
          </div>

          {hasUnsavedChanges && (
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: '#FEF2F2', 
              borderRadius: 6, 
              border: '1px solid #FCA5A5' 
            }}>
              <div style={{ fontSize: 14, color: '#991B1B' }}>
                You have unsaved changes. Click "Save Changes" to apply them to the dashboard.
              </div>
            </div>
          )}
        </div>

        {/* Current Configuration Summary */}
        <div style={S.card()}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px 0' }}>
            Current Configuration Summary
          </h3>
          
          <div style={{ 
            background: '#F8FAFC', 
            border: '1px solid #E2E8F0', 
            borderRadius: 6, 
            padding: 16 
          }}>
            <pre style={{ 
              fontSize: 12, 
              fontFamily: 'monospace', 
              margin: 0, 
              whiteSpace: 'pre-wrap',
              color: '#475569'
            }}>
              {JSON.stringify(localConfig, null, 2)}
            </pre>
          </div>
          
          <div style={{ 
            marginTop: 12, 
            fontSize: 12, 
            color: '#6B7280' 
          }}>
            This configuration is stored in your browser's local storage and persists between sessions.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;