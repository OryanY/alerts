import { useTheme } from '../../contexts/ThemeContext';

export const ErrorCallout = ({ message, details }) => {
  const { colors } = useTheme();
  return (
    <div role="alert" style={{
      background: colors.semantic.errorBg,
      border: `1px solid ${colors.semantic.error}`,
      color: colors.semantic.errorText,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16
    }}>
      <strong>Request failed:</strong> {message}
      {details && process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12 }}>Debug Details</summary>
          <pre style={{
            fontSize: 10,
            marginTop: 4,
            overflow: 'auto',
            maxHeight: 100,
            background: colors.bg.tertiary,
            padding: 8,
            borderRadius: 4
          }}>
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};
