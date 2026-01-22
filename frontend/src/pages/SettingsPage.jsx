// pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Info } from 'lucide-react';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useClientConfig } from '../contexts/ClientConfigContext';
import LabeledInput from '../components/ui/LabeledInput';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const SettingsPage = () => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const toMinutes = (seconds) => {
    if (!seconds) return 0;
    return Math.round((seconds / 60) * 10) / 10;
  };

  const { config, updateConfig, resetConfig } = useClientConfig();

  const [localConfig, setLocalConfig] = useState(config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    setLocalConfig(config);
    setHasUnsavedChanges(false);
    setValidationError(null);
  }, [config]);

  useEffect(() => {
    const isDifferent =
      JSON.stringify(localConfig) !== JSON.stringify(config);
    setHasUnsavedChanges(isDifferent);
  }, [localConfig, config]);

  // Validate config before saving
  const validateConfig = () => {
    // Shift validation
    if (localConfig.dayStart >= localConfig.dayEnd) {
      return 'שעת תחילת משמרת יום חייבת להיות קטנה משעת סיום';
    }

    // Night shift: nightStart should be > nightEnd (wraps around midnight)
    // e.g., 22:00 to 08:00 is valid, but 08:00 to 22:00 is wrong
    if (localConfig.nightStart <= localConfig.nightEnd) {
      return 'משמרת לילה חייבת לעבור את חצות - תחילה גדולה מסיום (למשל: 22 עד 8)';
    }

    // Duration bands validation
    if (localConfig.bands && localConfig.bands.length >= 2) {
      if (localConfig.bands[0].max >= localConfig.bands[1].max) {
        return 'סף התראות קצרות חייב להיות קטן מסף התראות בינוניות';
      }
    }

    return null; // No errors
  };

  const handleSave = () => {
    const error = validateConfig();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    updateConfig(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_CLIENT_CFG);
    setValidationError(null);
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

  const handleBandUpdate = (idx, field, value) => {
    setLocalConfig(prev => {
      const newBands = structuredClone(prev.bands);
      const val = parseInt(value, 10);

      if (isNaN(val)) return prev;

      if (field === 'max') {
        newBands[idx].max = val;
        // Auto-update next band's min if exists
        if (idx < newBands.length - 1) {
          newBands[idx + 1].min = val + 1;
        }
      }

      return { ...prev, bands: newBands };
    });
  };



  return (
    <div style={{ direction: 'rtl', color: colors.text.secondary }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px 0' }}>הגדרות ספים ומשמרות</h2>
          <p style={{ margin: 0, fontSize: 13, color: colors.text.tertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
            {validationError ? (
              <>
                <Info size={14} style={{ color: colors.semantic.error }} />
                <span style={{ color: colors.semantic.error, fontWeight: 600 }}>{validationError}</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Info size={14} style={{ color: colors.semantic.warning }} />
                <span style={{ color: colors.semantic.warning, fontWeight: 600 }}>יש שינויים שלא נשמרו</span>
              </>
            ) : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              border: `1px solid ${colors.border.primary}`,
              background: colors.bg.secondary,
              color: colors.text.secondary,
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            <RotateCcw size={14} />
            אפס
          </button>

          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 8,
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              border: 'none',
              background: hasUnsavedChanges ? colors.brand.primary : colors.bg.tertiary,
              color: hasUnsavedChanges ? '#fff' : colors.text.tertiary,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: hasUnsavedChanges ? `0 2px 8px ${colors.brand.primary}40` : 'none',
              transition: 'all 0.2s',
              opacity: hasUnsavedChanges ? 1 : 0.7,
            }}
          >
            <Save size={16} />
            {hasUnsavedChanges ? 'שמור' : 'אין שינויים'}
          </button>
        </div>
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

        {/* ---------------- CLUSTERING SETTINGS ---------------- */}
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
            הגדרות מתקדמות (איחוד וספים)
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              alignItems: 'start'
            }}
          >
            {/* Clustering Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>איחוד התראות</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="checkbox"
                  id="clusteringEnabled"
                  checked={localConfig.clusteringEnabled ?? true}
                  onChange={(e) => updateLocalConfig('clusteringEnabled', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label
                  htmlFor="clusteringEnabled"
                  style={{ cursor: 'pointer', fontWeight: 500, userSelect: 'none' }}
                >
                  איחוד התראות חכמים
                </label>
              </div>

              {(localConfig.clusteringEnabled ?? true) && (
                <LabeledInput
                  label="סף איחוד (דקות)"
                  value={localConfig.clusteringThreshold ?? 15}
                  onChange={(v) => updateLocalConfig('clusteringThreshold', v)}
                  type="number"
                  description="התראות עוקבות מאותו פאנל רועש יאוחדו להתראה אחת"
                />
              )}
            </div>

            {/* Threshold Section */}
            <div style={{ paddingRight: 48, borderRight: `1px solid ${colors.border.primary}` }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>ספי התראות</h4>
              <LabeledInput
                label="סף התראות שווא (דקות)"
                value={toMinutes(localConfig.falseWakeupThreshold)}
                onChange={(v) =>
                  updateLocalConfig('falseWakeupThreshold', Math.round(v * 60))
                }
                type="number"
                description="התראות לילה הקטנות/שוות למשך זה נחשבות שווא"
              />
            </div>
          </div>
        </div>

        {/* ---------------- ALERT THRESHOLD ---------------- */}


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

          <div style={{ display: 'grid', gap: 24 }}>
            {/* Threshold Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div style={{ padding: 16, background: colors.bg.secondary, borderRadius: 8, border: `1px solid ${colors.border.primary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: localConfig.bands[0].color }} />
                  <span style={{ fontWeight: 600, color: colors.text.primary }}>התראות קצרות עד:</span>
                </div>
                <LabeledInput
                  label="סף עליון (דקות)"
                  type="number"
                  value={toMinutes(localConfig.bands[0].max)}
                  onChange={(v) => handleBandUpdate(0, 'max', Math.round(v * 60))}
                  description="כל מה שמתחת לערך זה ייחשב קצר (Short)"
                />
              </div>

              <div style={{ padding: 16, background: colors.bg.secondary, borderRadius: 8, border: `1px solid ${colors.border.primary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: localConfig.bands[1].color }} />
                  <span style={{ fontWeight: 600, color: colors.text.primary }}>התראות בינוניות עד:</span>
                </div>
                <LabeledInput
                  label="סף עליון (דקות)"
                  type="number"
                  value={toMinutes(localConfig.bands[1].max)}
                  onChange={(v) => handleBandUpdate(1, 'max', Math.round(v * 60))}
                  description={`בין ${toMinutes(localConfig.bands[0].max)} לערך זה ייחשב בינוני (Medium)`}
                />
              </div>
            </div>

            {/* Visual Timeline Bar */}
            <div style={{ position: 'relative', marginTop: 8 }}>
              <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', width: '100%' }}>
                {/* Short Section */}
                <div style={{ flex: 1, background: localConfig.bands[0].color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  Short (0-{toMinutes(localConfig.bands[0].max)}m)
                </div>
                {/* Medium Section */}
                <div style={{ flex: 2, background: localConfig.bands[1].color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  Medium ({toMinutes(localConfig.bands[0].max)}-{toMinutes(localConfig.bands[1].max)}m)
                </div>
                {/* Long Section */}
                <div style={{ flex: 2, background: localConfig.bands[2].color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  Long ({toMinutes(localConfig.bands[1].max)}m+)
                </div>
              </div>
            </div>




          </div>
        </div>



        {/* ---------------- STATISTICS SETTINGS ---------------- */}
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
            תצוגת סטטיסטיקה
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>חישוב משך זמן מייצג:</label>
            <div style={{ display: 'flex', gap: 20 }}>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="durationMetric"
                  value="average"
                  checked={localConfig.durationMetric === 'average'}
                  onChange={() => updateLocalConfig('durationMetric', 'average')}
                />
                ממוצע (יותר רגיש להתראות חריגות)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="durationMetric"
                  value="median"
                  checked={localConfig.durationMetric !== 'average'} // Default to median
                  onChange={() => updateLocalConfig('durationMetric', 'median')}
                />
                חציון (פחות רגיש)
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
