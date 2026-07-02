import { Lock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Shown above destructive controls when the login gate is on and no session
// exists. Links to Settings where the user logs in.
const LoginRequiredNote = ({ action = 'פעולות מחיקה' }) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', marginBottom: 16, borderRadius: 8,
        background: colors.semantic.warningBg,
        border: `1px solid ${colors.semantic.warning}`,
        color: colors.semantic.warningText, fontSize: 13,
        direction: 'rtl',
      }}
    >
      <Lock size={16} style={{ color: colors.semantic.warning, flexShrink: 0 }} />
      <span>
        {action} דורשות התחברות.{' '}
        <a href="/settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
          התחבר בהגדרות
        </a>.
      </span>
    </div>
  );
};

export default LoginRequiredNote;
