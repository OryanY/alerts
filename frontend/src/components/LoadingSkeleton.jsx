export const LoadingSkeleton = ({ width = '100%', height = 20, style }) => (
  <div
    style={{
      backgroundColor: '#F3F4F6',
      height,
      width,
      borderRadius: 4,
      animation: 'pulse 2s ease-in-out infinite',
      ...style
    }}
  />
);