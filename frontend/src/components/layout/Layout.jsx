import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Eye, Settings, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ThemeToggle } from './ThemeToggle';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/explorer', label: 'Explorer', icon: Eye },
  { path: '/research', label: 'Panel Research', icon: FileText },
  { path: '/incident', label: 'Incident Managment', icon: AlertTriangle },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Layout = () => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);
  const location = useLocation();
  const navigate = useNavigate();

  const isActivePath = (path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.headerRow}>
            <ThemeToggle variant="switch" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(90deg,#EF4444,#F59E0B)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}>
                <AlertTriangle size={18} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Alert Stats</h1>
              </div>
            </div>

            <nav style={{ display: 'flex', gap: 8 }}>
              {navigationItems.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={S.navBtn(isActivePath(path))}
                  title={label}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={S.main}>
        <Outlet />
      </main>

    </div>
  );
};
