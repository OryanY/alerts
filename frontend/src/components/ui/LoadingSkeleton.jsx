export const LoadingSkeleton = ({ width = '100%', height = 20, style = {} }) => (
  <div
    className="skeleton"
    style={{ width, height, borderRadius: 6, ...style }}
  />
);