import './StatCard.css';

const StatCard = ({ title, value }) => (
  <div className="stat-card card">
    <div className="stat-title">{title}</div>
    <div className="stat-value">{value}</div>
  </div>
);

export default StatCard;