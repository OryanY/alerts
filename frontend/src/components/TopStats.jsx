import { formatDuration } from '../lib/formatters';
import './TopStats.css';

const Clickable = ({ onClick, children, title }) => (
  <button
    className="link-like"
    onClick={onClick}
    title={title}
    style={{ all:'unset', cursor:'pointer', color:'#2563eb' }}
  >
    {children}
  </button>
);

const TopStats = ({ panelStats = [], applicationStats = [], onClickPanel, onClickApp }) => (
  <div className="top-stats grid grid-two">
    <div className="top-card card">
      <h3>Top Panels by Alert Count</h3>
      <div>
        {panelStats.slice(0, 5).map((panel, i) => (
          <div key={`${panel.panel_title}-${i}`} className="stat-item">
            <span className="stat-name" title={panel.panel_title}>
              {onClickPanel ? (
                <Clickable onClick={() => onClickPanel(panel.panel_title)} title="Filter by panel">
                  {panel.panel_title}
                </Clickable>
              ) : panel.panel_title}
            </span>
            <div className="stat-values">
              <span>{panel.alert_count} alerts</span>
              <span>({formatDuration(Math.round(panel.avg_duration || 0))} avg)</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="top-card card">
      <h3>Top Applications by Alert Count</h3>
      <div>
        {applicationStats.slice(0, 5).map((app, i) => (
          <div key={`${app.application}-${i}`} className="stat-item">
            <span className="stat-name" title={app.application}>
              {onClickApp ? (
                <Clickable onClick={() => onClickApp(app.application)} title="Filter by application">
                  {app.application}
                </Clickable>
              ) : app.application}
            </span>
            <div className="stat-values">
              <span>{app.alert_count} alerts</span>
              <span>({formatDuration(Math.round(app.avg_duration || 0))} avg)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TopStats;
