export const ErrorCallout = ({ message, details }) => (
  <div style={{
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    color: '#991B1B',
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
          background: '#FECACA',
          padding: 8,
          borderRadius: 4
        }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      </details>
    )}
  </div>
);
