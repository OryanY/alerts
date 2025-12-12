import { Moon } from '../../icons';
import { ChartCard } from '../ui/ChartCard';
import { useTheme } from '../../contexts/ThemeContext';

export const WakeupGauge = ({ shiftData, loading, error }) => {
  const { colors } = useTheme();

  const nightShift = shiftData?.find(s => s.shift === 'Night');
  const falseWakeups = nightShift?.false_wakeups || 0;
  const trueAlerts = nightShift?.true_alerts || 0;
  const total = falseWakeups + trueAlerts;
  const falsePct = total ? (falseWakeups / total) * 100 : 0;

  const arcColor = colors.semantic.error;
  const arcBackground = colors.border.secondary;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  return (
    <ChartCard
      title="התראות שווא בלילה"
      icon={Moon}
      loading={loading}
      error={error}
      height={230}
    >
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
        <span style={{ marginRight: 12 }}>אמת: {trueAlerts} </span>
        <span>שקר: {falseWakeups}</span>
      </div>
    </ChartCard>
  );
};