import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Eye, Settings, FileText, BookOpen, TrendingUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ThemeToggle } from './ThemeToggle';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/explorer', label: 'Explorer', icon: Eye },
  { path: '/research', label: 'Panel Research', icon: FileText },
  { path: '/incident', label: 'Incident Managment', icon: AlertTriangle },
  { path: '/history', label: 'History', icon: FileText },
  { path: '/how-to-use', label: 'How to Use', icon: BookOpen },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ThemeToggle variant="switch" />
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
