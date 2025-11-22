import { Moon } from '../icons';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ErrorCallout } from './ErrorCallout';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

export const WakeupGauge = ({ shiftData, loading, error }) => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  if (error) {
    return <ErrorCallout message={error.message} details={error} />;
  }

  if (loading) {
    return (
      <div style={S.card({ height: 350 })}>
        <LoadingSkeleton width="40%" height={20} style={{ marginBottom: 20 }} />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 200
        }}>
          <LoadingSkeleton width={200} height={200} style={{ borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  const nightShift = shiftData?.find(s => s.shift === 'Night');
  const falseWakeups = nightShift?.false_wakeups || 0;
  const trueAlerts = nightShift?.true_alerts || 0;
  const total = falseWakeups + trueAlerts;
  const falsePct = total ? (falseWakeups / total) * 100 : 0;

  // THEMIZED COLORS
  const arcColor = colors.semantic.error;              // red arc
  const arcBackground = colors.border.secondary;       // background track
  const iconColor = colors.brand.primary;              // moon icon
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  return (
    <div style={S.card()}>
      
      {/* TITLE */}
      <h3 style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 16,
        fontWeight: 600,
        margin: '0 0 20px 0',
        position: 'relative',
        color: textPrimary
      }}>
        <Moon 
          size={16}
          style={{ 
            color: iconColor,
            position: 'absolute',
            right: 'calc(50% + 80px)' 
          }} 
        />
        <span>התראות שווא בלילה</span>
      </h3>

      {/* GAUGE */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
      }}>

        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>

            {/* background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={arcBackground}
              strokeWidth="10"
              fill="none"
            />

            {/* active arc */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={arcColor}
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${falsePct * 2.827} 282.7`}
              strokeLinecap="round"
            />
          </svg>

          {/* CENTER LABEL */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: 22,
              fontWeight: 700,
              color: textPrimary 
            }}>
              {falseWakeups} / {total} שקריות
            </div>

            <div style={{ 
              fontSize: 12, 
              color: textSecondary 
            }}>
              אחוז התראות שקריות: {nightShift?.false_wakeup_rate || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ROW */}
      <div style={{ 
        textAlign: 'center',
        fontSize: 12,
        color: textSecondary 
      }}>
        <span style={{ marginRight: 12 }}> אמת: {trueAlerts} </span>
        <span>שקרי: {falseWakeups}</span>
      </div>

    </div>
  );
};
