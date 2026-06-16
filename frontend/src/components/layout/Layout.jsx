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

  // Active tab: primary brand color with solid background and capsule styling. Inactive: secondary text.
  const navTabStyle = (active) => active
    ? {
        color: colors.brand.primary,
        background: colors.bg.secondary,
        boxShadow: `0 1px 3px ${colors.shadow.sm}, 0 1px 2px rgba(0, 0, 0, 0.05)`,
        fontWeight: 600,
        borderRadius: 99,
        padding: '6px 16px',
        fontSize: '13px',
        border: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    : {
        color: colors.text.secondary,
        background: 'transparent',
        fontWeight: 500,
        borderRadius: 99,
        padding: '6px 16px',
        fontSize: '13px',
        border: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      };

  const rightNavTabStyle = (active) => active
    ? {
        color: colors.brand.primary,
        fontWeight: 600,
        borderRadius: 99,
        padding: '6px 16px',
        fontSize: '13px',
        border: 'none',
        background: colors.bg.tertiary + '80',
        transition: 'all 0.2s ease',
      }
    : {
        color: colors.text.secondary,
        fontWeight: 500,
        borderRadius: 99,
        padding: '6px 16px',
        fontSize: '13px',
        border: 'none',
        background: 'transparent',
        transition: 'all 0.2s ease',
      };

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
          style={{
            background: `${colors.bg.secondary}e6`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${colors.border.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 60,
          }}
        >
          {/* Left area: Brand logo */}
          <div style={{ flex: '1 1 0%', display: 'flex', alignItems: 'center' }}>
            <span className="ops-brand" style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: colors.brand.primary,
              textTransform: 'uppercase',
              userSelect: 'none',
              cursor: 'pointer',
            }} onClick={() => navigate('/dashboard')}>
              Alerts
            </span>
          </div>

          {/* Center area: Centered nav tabs */}
          <nav className="ops-nav" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: colors.bg.tertiary + '80',
            padding: 4,
            borderRadius: 99,
            border: `1px solid ${colors.border.primary}50`,
          }}>
            {navigationItems.map(({ path, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="ops-nav-button"
                style={{
                  ...navTabStyle(isActivePath(path)),
                  minHeight: 'auto',
                }}
                aria-current={isActivePath(path) ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Right area: Settings & Theme Toggle */}
          <div className="ops-nav-right" style={{
            flex: '1 1 0%',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="ops-nav-button"
              style={rightNavTabStyle(settingsActive)}
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
