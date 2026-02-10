import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Eye, Settings, FileText, BookOpen, User } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/AuthContext';
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
  const { user, loading } = useUser();
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
              {/* User Profile / Identity */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 12px 4px 4px',
                background: colors.surface,
                borderRadius: 20,
                border: `1px solid ${colors.border}`
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: user?.isAuthenticated ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' : colors.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 600, fontSize: 13
                }}>
                  {loading ? '...' : (user?.initials || <User size={16} />)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                    {loading ? 'Loading...' : (user?.displayName || 'Guest')}
                  </span>
                  {user?.isAuthenticated && (
                    <span style={{ fontSize: 10, color: colors.secondaryText }}>
                      {user?.domain ? `${user.domain}\\${user.username}` : user?.username}
                    </span>
                  )}
                </div>
              </div>

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
