// components/LoadingSpinner.jsx — Loading spinner component
export const LoadingSpinner = ({ size = 40 }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  }}>
    <div style={{
      width: size,
      height: size,
      border: '3px solid #E5E7EB',
      borderTop: '3px solid #3B82F6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  </div>
);