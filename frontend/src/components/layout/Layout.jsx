import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Eye, Settings, FileText, BookOpen, Activity, History } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientConfig } from '../../contexts/ClientConfigContext';
import { TopBarContext } from '../../contexts/TopBarContext';
import { ThemeToggle } from './ThemeToggle';
import { DateRangePicker } from '../ui/DateRangePicker';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Activity },
  { path: '/explorer', label: 'Explorer', icon: Eye },
  { path: '/research', label: 'Research', icon: FileText },
  { path: '/incident', label: 'Incidents', icon: AlertTriangle },
  { path: '/incident-stats', label: 'Incident BI', icon: BarChart3 },
  { path: '/history', label: 'History', icon: History },
  { path: '/how-to-use', label: 'How To Use', icon: BookOpen },
];

const routesWithDateControls = ['/dashboard', '/explorer', '/research', '/incident-stats'];

export const Layout = () => {
  const { colors, styles: S } = useTheme();
  const { dateRange, setDateRange, setPresetRange } = useClientConfig();
  const [topBarSlots, setTopBarSlotsState] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  const isActivePath = (path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const activeItem = navigationItems.find((item) => isActivePath(item.path)) ||
    (location.pathname.startsWith('/settings') ? { label: 'Settings' } : null);
  const showDateControls = routesWithDateControls.some((path) => isActivePath(path));
  const settingsActive = location.pathname.startsWith('/settings');
  const navKeyStyle = (active) => ({
    borderColor: active ? `${colors.brand.primary}55` : 'transparent',
    background: active ? `${colors.brand.primary}12` : 'transparent',
    color: active ? colors.brand.primary : colors.text.secondary,
    boxShadow: active ? `0 8px 18px ${colors.brand.primary}16` : 'none',
  });
  const setTopBarSlots = useCallback((slots) => setTopBarSlotsState(slots || {}), []);
  const clearTopBarSlots = useCallback(() => setTopBarSlotsState({}), []);
  const topBarContextValue = useMemo(
    () => ({ slots: topBarSlots, setTopBarSlots, clearTopBarSlots }),
    [topBarSlots, setTopBarSlots, clearTopBarSlots]
  );

  return (
    <TopBarContext.Provider value={topBarContextValue}>
      <div
        className="ops-shell"
        style={{
          background: colors.bg.primary,
          color: colors.text.primary,
        }}
      >
        <aside
          className="ops-sidebar"
          style={{
            background: colors.bg.secondary,
            borderRight: `1px solid ${colors.border.primary}`,
          }}
        >
          <nav className="ops-nav">
            {navigationItems.map(({ path, label, icon: Icon }) => {
              const active = isActivePath(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`ops-nav-button${active ? ' ops-nav-button-active' : ''}`}
                  style={navKeyStyle(active)}
                  title={label}
                  aria-label={label}
                  data-label={label}
                >
                  <span
                    className="ops-nav-lamp"
                    style={{ background: active ? colors.brand.primary : 'transparent' }}
                  />
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                </button>
              );
            })}
          </nav>

          <div className="ops-sidebar-footer">
            <ThemeToggle variant="compact" />
          </div>
        </aside>

        <div className="ops-workspace">
          <header
            className="ops-topbar"
            style={{
              background: colors.bg.secondary,
              borderBottom: `1px solid ${colors.border.primary}`,
            }}
          >
            <div className="ops-topbar-title" style={{ color: colors.text.secondary, fontSize: 13 }}>
              <span>{activeItem?.label || 'Alerts'}</span>
              {topBarSlots.status && (
                <span className="ops-topbar-status">
                  {topBarSlots.status}
                </span>
              )}
            </div>
            {(showDateControls || topBarSlots.controls) && (
              <div className="ops-topbar-controls">
                {showDateControls && (
                  <DateRangePicker
                    dateRange={dateRange}
                    onChange={setDateRange}
                    setPresetRange={setPresetRange}
                    variant="compact"
                  />
                )}
                {topBarSlots.controls}
              </div>
            )}
            <div className="ops-topbar-actions">
              {topBarSlots.actions}
              <button
                type="button"
                onClick={() => navigate('/settings')}
                title="Settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 32,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: `1px solid ${settingsActive ? colors.brand.primary : colors.border.primary}`,
                  background: settingsActive ? `${colors.brand.primary}14` : colors.bg.secondary,
                  color: settingsActive ? colors.brand.primary : colors.text.primary,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Settings size={15} />
                Settings
              </button>
              <ThemeToggle variant="compact" />
            </div>
          </header>

          <main style={S.main}>
            <Outlet />
          </main>
        </div>
      </div>
    </TopBarContext.Provider>
  );
};
