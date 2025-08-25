import { formatDuration, formatDateTime } from '../lib/formatters';
import './AlertTable.css';

const AlertTable = ({ alerts = [] }) => {
  const badgeClass = (seconds) => {
    if (seconds <= 30) return 'badge badge-short';
    if (seconds <= 300) return 'badge badge-medium';
    return 'badge badge-long';
  };

  return (
    <div className="table-wrap card">
      <div className="table-header">
        <h3>Alert Details</h3>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Panel</th>
              <th>Application</th>
              <th>Node</th>
              <th>Duration</th>
              <th>Time Fired</th>
              <th>Operator</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((row, idx) => (
              <tr key={row.history_id || `${row.incident_id}-${idx}`}>
                <td>{row.panel_title || 'N/A'}</td>
                <td>{row.application || 'N/A'}</td>
                <td>{row.node_name || 'N/A'}</td>
                <td><span className={badgeClass(row.duration_sec)}>{formatDuration(row.duration_sec)}</span></td>
                <td>{formatDateTime(row.time_fired)}</td>
                <td>{row.operator || 'N/A'}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertTable;