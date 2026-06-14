import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientConfig } from '../../contexts/ClientConfigContext';
import { TopBarContext } from '../../contexts/TopBarContext';
import { ThemeToggle } from './ThemeToggle';
import { DateRangePicker } from '../ui/DateRangePicker';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/explorer', label: 'Explorer' },
  { path: '/research', label: 'Research' },
  { path: '/incident', label: 'Incidents' },
  { path: '/incident-stats', label: 'Incident BI' },
  { path: '/how-to-use', label: 'How to use' },
];

const routesWithDateControls = ['/dashboard', '/explorer', '/research', '/incident-stats'];

export const Layout = () => {
  const { colors } = useTheme();
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

  // Active tab: primary text + a thin accent underline. Inactive: muted, no decoration.
  const navTabStyle = (active) => active
    ? { color: colors.text.primary, fontWeight: 500, boxShadow: `inset 0 -2px 0 ${colors.brand.primary}` }
    : { color: colors.text.secondary, fontWeight: 400 };

  const setTopBarSlots = useCallback((slots) => setTopBarSlotsState(slots || {}), []);
  const clearTopBarSlots = useCallback(() => setTopBarSlotsState({}), []);
  const topBarContextValue = useMemo(
    () => ({ slots: topBarSlots, setTopBarSlots, clearTopBarSlots }),
    [topBarSlots, setTopBarSlots, clearTopBarSlots]
  );

  const showSubbar = showDateControls || topBarSlots.status || topBarSlots.controls || topBarSlots.actions;

  return (
    <TopBarContext.Provider value={topBarContextValue}>
      <div className="ops-shell" style={{ background: colors.bg.primary, color: colors.text.primary }}>
        <header
          className="ops-topnav"
          style={{ background: colors.bg.secondary, borderBottom: `1px solid ${colors.border.primary}` }}
        >
          <span className="ops-brand">Alerts</span>

          <nav className="ops-nav">
            {navigationItems.map(({ path, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="ops-nav-button"
                style={navTabStyle(isActivePath(path))}
                aria-current={isActivePath(path) ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ops-nav-right">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="ops-nav-button"
              style={navTabStyle(settingsActive)}
              aria-current={settingsActive ? 'page' : undefined}
            >
              Settings
            </button>
            <ThemeToggle variant="compact" />
          </div>
        </header>

        {showSubbar && (
          <div
            className="ops-topbar"
            style={{ background: colors.bg.secondary, borderBottom: `1px solid ${colors.border.primary}` }}
          >
            <div className="ops-topbar-title" style={{ color: colors.text.secondary, fontSize: 13 }}>
              <span>{activeItem?.label || 'Alerts'}</span>
              {topBarSlots.status && <span className="ops-topbar-status">{topBarSlots.status}</span>}
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

            <div className="ops-topbar-actions">{topBarSlots.actions}</div>
          </div>
        )}

        <main className="ops-main">
          <Outlet />
        </main>
      </div>
    </TopBarContext.Provider>
  );
};
