import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import Filters from '../components/Filters';
import TopStats from '../components/TopStats';
import AlertTable from '../components/AlertTable';
import { fetchAlerts, fetchOverview, fetchByPanel, fetchByApplication } from '../lib/api';
import { formatDuration } from '../lib/formatters';
import './Dashboard.css';

const DEFAULT_FILTERS = {
  panel_title: '',
  application: '',
  node_name: '',
  network: '',
  object: '',
  operator: '',
  min_duration: '',
  max_duration: '',
  start_date: '',
  end_date: '',
};

const Dashboard = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [panelStats, setPanelStats] = useState([]);
  const [applicationStats, setApplicationStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const alertParams = useMemo(() => {
    const params = { page: pagination.page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  }, [filters, pagination.page]);

  const rangeParams = useMemo(() => {
    const p = {};
    if (filters.start_date) p.start_date = filters.start_date;
    if (filters.end_date) p.end_date = filters.end_date;
    return p;
  }, [filters.start_date, filters.end_date]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetchAlerts(alertParams),
      fetchOverview(rangeParams),
      fetchByPanel(rangeParams),
      fetchByApplication(rangeParams),
    ])
      .then(([alertsData, overviewData, byPanel, byApp]) => {
        if (!mounted) return;
        setAlerts(alertsData.alerts || []);
        setPagination((prev) => ({
          ...prev,
          totalPages: alertsData.totalPages || 1,
          total: alertsData.total || 0,
        }));
        setOverview(overviewData || null);
        setPanelStats(byPanel || []);
        setApplicationStats(byApp || []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [alertParams, rangeParams]);

  const changePage = (next) => {
    setPagination((p) => ({ ...p, page: next }));
  };

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="header-title"> Noisemaker Alert Analytics</h1>
        <p className="header-subtitle">Analyze and research your alert history</p>
      </header>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading alert data...</p>
        </div>
      )}

      {!loading && (
        <>
          {overview && (
            <section className="grid grid-auto stats">
              <StatCard title="Total Alerts" value={overview.total_alerts?.toLocaleString?.() ?? '0'} />
              <StatCard title="Average Duration" value={formatDuration(Math.round(overview.avg_duration || 0))} />
              <StatCard
                title="Short Alerts (â‰¤30s)"
                value={
                  `${overview.short_alerts} (${overview.total_alerts ? Math.round((overview.short_alerts / overview.total_alerts) * 100) : 0}%)`
                }
              />
              <StatCard
                title="Long Alerts (>5min)"
                value={
                  `${overview.long_alerts} (${overview.total_alerts ? Math.round((overview.long_alerts / overview.total_alerts) * 100) : 0}%)`
                }
              />
            </section>
          )}

          <TopStats panelStats={panelStats} applicationStats={applicationStats} />

          <Filters filters={filters} setFilters={(next) => {
            // ×›×œ ×©×™× ×•×™ ×¤×™×œ×˜×¨ ×ž××¤×¡ ×œ×¢×ž×•×“ 1
            setPagination((p) => ({ ...p, page: 1 }));
            setFilters(next);
          }} />

          <AlertTable alerts={alerts} />

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <p className="muted">
                Showing {alerts.length} of {pagination.total.toLocaleString()} results
              </p>
              <div className="pager">
                <button
                  className="btn btn-secondary"
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                <span className="muted">Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  className="btn btn-secondary"
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;