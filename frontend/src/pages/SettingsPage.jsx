// pages/SettingsPage.jsx — Hebrew text with RTL direction
import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { S } from '../utils/styles';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useClientConfig } from '../contexts/ClientConfigContext';
import LabeledInput from '../components/LabeledInput';

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
      const keys = path.split('.');
      const updated = JSON.parse(JSON.stringify(prev));
      let cursor = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!cursor[key]) {
          const nextKey = keys[i + 1];
          const isArrayIndex = /^\d+$/.test(nextKey);
          cursor[key] = isArrayIndex ? [] : {};
        }
        cursor = cursor[key];
      }

      const lastKey = keys[keys.length - 1];
      cursor[lastKey] = value;
      return updated;
    });
  };


  const ColorInput = ({ label, value, onChange }) => (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
          style={{ ...S.input, flex: 1, minWidth: 0 }}
          placeholder="#000000"
        />
      </div>
    </div>
  );

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>
          הגדרות לוח בקרה
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
          הגדר ספים, משמרות והעדפות תצוגה עבור לוח הבקרה.
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
            הגדרות משמרות
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            <LabeledInput
              label="תחילת משמרת יום"
              value={localConfig.dayStart}
              onChange={(value) => updateLocalConfig('dayStart', value)}
              type="number"
              min={0}
              max={23}
            />
            <LabeledInput
              label="סיום משמרת יום"
              value={localConfig.dayEnd}
              onChange={(value) => updateLocalConfig('dayEnd', value)}
              type="number"
              min={0}
              max={23}
            />
            <LabeledInput
              label="תחילת משמרת לילה"
              value={localConfig.nightStart}
              onChange={(value) => updateLocalConfig('nightStart', value)}
              type="number"
              min={0}
              max={23}
            />
            <LabeledInput
              label="סיום משמרת לילה"
              value={localConfig.nightEnd}
              onChange={(value) => updateLocalConfig('nightEnd', value)}
              type="number"
              min={0}
              max={23}
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
                לוח זמנים נוכחי
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#1E40AF' }}>
              יום: {String(localConfig.dayStart || 0).padStart(2, '0')}:00 - {String(localConfig.dayEnd || 0).padStart(2, '0')}:00 • 
              לילה: {String(localConfig.nightStart || 0).padStart(2, '0')}:00 - {String(localConfig.nightEnd || 0).padStart(2, '0')}:00
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
            ספי התראות
          </h3>
          
          <div style={{ marginBottom: 16, maxWidth: 500 }}>
            <LabeledInput
              label=" סף התראות שווא בשניות"
              value={localConfig.falseWakeupThreshold}
              onChange={(value) => updateLocalConfig('falseWakeupThreshold', value)}
              type="number"
              min={0}
              description=" התראות לילה הקטנות/שוות למשך זה נחשבות להתראות שווא"
            />
          </div>
        </div>

        {/* Duration Bands - Fixed Layout */}
        <div style={S.card()}>
          <h3 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 16px 0'
          }}>
            קטגוריות משך זמן
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gap: 16, 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' 
          }}>
            {(localConfig.bands || []).map((band, idx) => (
              <div key={band.key || idx} style={{ 
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
                    background: band.color || '#000000' 
                  }} />
                  <span style={{ fontWeight: 600, color: band.color || '#000000' }}>
                    {band.label || 'ללא שם'}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gap: 12 }}>
                  <LabeledInput
                    label="תווית"
                    type="text"
                    value={band.label || ''}
                    onChange={(value) => updateLocalConfig(`bands.${idx}.label`, value)}
                  />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <LabeledInput
                      label="מינימום (שניות)"
                      value={band.min}
                      onChange={(value) => updateLocalConfig(`bands.${idx}.min`, value)}
                      type="number"
                      min={0}
                    />
                    <LabeledInput
                      label="מקסימום (שניות)"
                      value={band.max}
                      onChange={(value) => updateLocalConfig(`bands.${idx}.max`, value)}
                      type="number"
                      min={0}
                    />
                  </div>
                  
                  <ColorInput
                    label="צבע"
                    value={band.color || '#000000'}
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
                תצוגה מקדימה של טווחי משך
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {(localConfig.bands || []).map((band, idx) => (
                <span key={band.key || idx} style={{
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6,
                  padding: '4px 8px', 
                  borderRadius: 12, 
                  background: `${band.color || '#000000'}20`,
                  color: band.color || '#000000', 
                  fontWeight: 600,
                  fontSize: 12
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.color || '#000000' }} />
                  {band.label} ({band.min}-{band.max === 1e9 ? '∞' : band.max}ש')
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
                פעולות
              </h3>
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
                שמור את השינויים שלך או אפס להגדרות ברירת מחדל
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
                אפס לברירת מחדל
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
                {hasUnsavedChanges ? 'שמור שינויים' : 'אין שינויים'}
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
                יש לך שינויים שלא נשמרו. לחץ על "שמור שינויים" כדי להחיל אותם על לוח הבקרה.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;