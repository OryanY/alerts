// pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useClientConfig } from '../contexts/ClientConfigContext';
import LabeledInput from '../components/LabeledInput';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const SettingsPage = () => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const { config, updateConfig, resetConfig } = useClientConfig();

  const [localConfig, setLocalConfig] = useState(config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    setHasUnsavedChanges(false);
  }, [config]);

  useEffect(() => {
    const isDifferent =
      JSON.stringify(localConfig) !== JSON.stringify(config);
    setHasUnsavedChanges(isDifferent);
  }, [localConfig, config]);

  const handleSave = () => updateConfig(localConfig);

  const handleReset = () => {
    setLocalConfig(DEFAULT_CLIENT_CFG);
    resetConfig();
  };

  const updateLocalConfig = (path, value) => {
    setLocalConfig((prev) => {
      const keys = path.split('.');
      const updated = structuredClone(prev);
      let cursor = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!cursor[key]) cursor[key] = {};
        cursor = cursor[key];
      }

      cursor[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const ColorInput = ({ label, value, onChange }) => (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <label
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.text.primary,
        }}
      >
        {label}
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border.primary,
            background: colors.bg.secondary,
            cursor: 'pointer',
          }}
        />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{
            ...S.input,
            flex: 1,
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ direction: 'rtl', color: colors.text.secondary }}>
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 8px 0',
          }}
        >
          הגדרות ספים ומשמרות
        </h2>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {/* ---------------- SHIFT SETTINGS ---------------- */}
        <div style={S.card()}>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 16px 0',
            }}
          >
            <Settings size={18} />
            הגדרות משמרות
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <LabeledInput
              label="תחילת משמרת יום"
              value={localConfig.dayStart}
              onChange={(v) => updateLocalConfig('dayStart', v)}
              type="number"
            />

            <LabeledInput
              label="סיום משמרת יום"
              value={localConfig.dayEnd}
              onChange={(v) => updateLocalConfig('dayEnd', v)}
              type="number"
            />

            <LabeledInput
              label="תחילת משמרת לילה"
              value={localConfig.nightStart}
              onChange={(v) => updateLocalConfig('nightStart', v)}
              type="number"
            />

            <LabeledInput
              label="סיום משמרת לילה"
              value={localConfig.nightEnd}
              onChange={(v) => updateLocalConfig('nightEnd', v)}
              type="number"
            />
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: colors.semantic.infoBg,
              borderRadius: 6,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: colors.semantic.info,
              color: colors.semantic.infoText,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Info size={16} style={{ color: colors.semantic.info }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                לוח זמנים נוכחי
              </span>
            </div>

            <div style={{ fontSize: 13 }}>
              יום: {String(localConfig.dayStart).padStart(2, '0')}:00 -{' '}
              {String(localConfig.dayEnd).padStart(2, '0')}:00 • לילה:{' '}
              {String(localConfig.nightStart).padStart(2, '0')}:00 -{' '}
              {String(localConfig.nightEnd).padStart(2, '0')}:00
            </div>
          </div>
        </div>

        {/* ---------------- ALERT THRESHOLD ---------------- */}
        <div style={S.card()}>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 16px 0',
            }}
          >
            ספי התראות
          </h3>

          <div style={{ maxWidth: 500 }}>
            <LabeledInput
              label="סף התראות שווא בשניות"
              value={localConfig.falseWakeupThreshold}
              onChange={(v) =>
                updateLocalConfig('falseWakeupThreshold', v)
              }
              type="number"
              description="התראות לילה הקטנות/שוות למשך זה נחשבות שווא"
            />
          </div>
        </div>

        {/* ---------------- DURATION BANDS ---------------- */}
        <div style={S.card()}>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 18,
              fontWeight: 600,
              margin: '0 0 16px 0',
            }}
          >
            קטגוריות משך זמן
          </h3>

          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns:
                'repeat(auto-fit, minmax(320px, 1fr))',
            }}
          >
            {(localConfig.bands || []).map((band, idx) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: colors.bg.tertiary,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: colors.border.primary,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: band.color,
                    }}
                  />

                  <span
                    style={{
                      fontWeight: 600,
                      color: band.color,
                      fontSize: 14,
                    }}
                  >
                    {band.label || 'ללא שם'}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <LabeledInput
                    label="תווית"
                    type="text"
                    value={band.label}
                    onChange={(v) =>
                      updateLocalConfig(`bands.${idx}.label`, v)
                    }
                  />

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <LabeledInput
                      label="מינימום (ש')"
                      type="number"
                      value={band.min}
                      onChange={(v) =>
                        updateLocalConfig(`bands.${idx}.min`, v)
                      }
                    />

                    <LabeledInput
                      label="מקסימום (ש')"
                      type="number"
                      value={band.max}
                      onChange={(v) =>
                        updateLocalConfig(`bands.${idx}.max`, v)
                      }
                    />
                  </div>

                  <ColorInput
                    label="צבע"
                    value={band.color}
                    onChange={(v) =>
                      updateLocalConfig(`bands.${idx}.color`, v)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bands Preview */}
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 6,
              background: colors.semantic.warningBg,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: colors.semantic.warning,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                color: colors.semantic.warningText,
              }}
            >
              <Info size={16} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                תצוגה מקדימה
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 8,
              }}
            >
              {(localConfig.bands || []).map((band, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 12,
                    background: `${band.color}20`,
                    color: band.color,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: band.color,
                    }}
                  />
                  {band.label} ({band.min}–{band.max === 1e9 ? '∞' : band.max}ש')
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- ACTIONS ---------------- */}
        <div style={S.card()}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: '0 0 4px 0',
                }}
              >
                פעולות
              </h3>

              <p
                style={{
                  fontSize: 14,
                  color: colors.text.secondary,
                  margin: 0,
                }}
              >
                שמור שינויים או אפס לברירת המחדל
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* Reset */}
              <button
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',

                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: colors.semantic.error,
                  background: colors.bg.secondary,
                  color: colors.semantic.errorText,
                }}
              >
                <RotateCcw size={16} />
                אפס לברירת מחדל
              </button>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',

                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: colors.brand.primary,
                  background: hasUnsavedChanges
                    ? colors.brand.primary
                    : colors.bg.tertiary,
                  color: hasUnsavedChanges
                    ? colors.text.inverse
                    : colors.text.tertiary,
                }}
              >
                <Save size={16} />
                {hasUnsavedChanges ? 'שמור שינויים' : 'אין שינויים'}
              </button>
            </div>
          </div>

          {/* Unsaved Changes Notice */}
          {hasUnsavedChanges && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                background: colors.semantic.errorBg,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.semantic.error,
                color: colors.semantic.errorText,
              }}
            >
              יש לך שינויים שלא נשמרו. לחץ על "שמור שינויים".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
