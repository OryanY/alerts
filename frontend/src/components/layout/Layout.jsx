import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Eye, Settings, FileText, BookOpen,
  AlertTriangle, TrendingUp, History, Zap, GitBranch, Menu, X
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import './top-nav.css';

const NAV = [
  { path: '/dashboard', label: 'Monitoring', icon: BarChart3 },
  { path: '/explorer', label: 'Explorer', icon: Eye },
  { path: '/research', label: 'Panel Research', icon: TrendingUp },
  { path: '/incident-stats', label: 'Incident BI', icon: GitBranch },
  { path: '/incident', label: 'Management', icon: AlertTriangle },
  { path: '/history', label: 'History', icon: History },
];

export const Layout = () => {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const el = document.querySelector('.app-shell');
    if (!el) return;
    const handleScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = useCallback((path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }, [location.pathname]);

  const accent = colors.brand.cyan;
  const purple = colors.brand.purple;

  return (
    <div className="app-shell top-nav-layout">
      {/* Dynamic Health Strip Gradient */}
      <div className="health-strip" />

      {/* Floating Glass Navbar */}
      <nav className={`top-navbar ${scrolled ? 'scrolled' : ''}`} style={{
        background: scrolled ? colors.bg.glass : colors.bg.secondary,
        borderColor: scrolled ? colors.border.secondary : colors.border.primary,
        boxShadow: scrolled ? colors.shadow.md : 'none',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
      }}>
        <div className="top-navbar-inner">

          {/* Brand/Logo */}
          <div className="brand-section" onClick={() => navigate('/')}>
            <div className="brand-icon" style={{
              background: `linear-gradient(135deg, ${accent}, ${purple})`,
              boxShadow: scrolled ? `0 0 12px ${accent}60` : 'none',
            }}>
              <Zap size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div className="brand-text" style={{ color: colors.text.primary }}>
              <span className="bold">Tequila</span>
              <span className="light" style={{ color: colors.text.tertiary }}>Alerts</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="desktop-links">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = isActive(path);
              return (
                <button
                  key={path}
                  className={`top-nav-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(path)}
                  style={{
                    color: active ? accent : colors.text.secondary,
                    background: active ? `${accent}12` : 'transparent',
                    borderColor: active ? `${accent}40` : 'transparent',
                    boxShadow: active ? `inset 0 1px 4px ${accent}20` : 'none',
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.5 : 1.8} />
                  <span>{label}</span>
                  {active && (
                    <div className="active-line" style={{ background: accent, boxShadow: `0 -2px 8px ${accent}` }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="nav-actions">
            <button
              onClick={() => navigate('/how-to-use')}
              className="action-btn"
              title="How to use"
              style={{ color: colors.text.secondary, borderColor: colors.border.primary }}
            >
              <BookOpen size={16} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="action-btn"
              title="Settings"
              style={{ color: colors.text.secondary, borderColor: colors.border.primary }}
            >
              <Settings size={16} />
            </button>

            <div className="divider" style={{ background: colors.border.primary }} />
            <ThemeToggle variant="compact" />

            {/* Mobile Toggle */}
            <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} style={{ color: colors.text.primary }}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="mobile-menu" style={{ background: colors.bg.card, borderColor: colors.border.primary }}>
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = isActive(path);
              return (
                <button
                  key={path}
                  className={`mobile-nav-item ${active ? 'active' : ''}`}
                  onClick={() => { navigate(path); setMobileOpen(false); }}
                  style={{
                    color: active ? accent : colors.text.primary,
                    background: active ? `${accent}12` : 'transparent',
                    borderLeft: `3px solid ${active ? accent : 'transparent'}`,
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Main Page Area */}
      <main className="main-content top-nav-main" style={{ background: colors.bg.primary }}>
        <div className="main-content-inner page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
