// components/Layout.jsx — Main layout with navigation
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Eye, Settings,FileText } from 'lucide-react';
import { S } from '../utils/styles';

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/explorer',  label: 'Explorer',  icon: Eye },
  { path: '/research', label: 'Panel Research', icon: FileText },
  { path: '/settings',  label: 'Settings',  icon: Settings },
  { path: '/incident',  label: 'Incident Managment',  icon: AlertTriangle },

];

export const Layout = () => {
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
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ 
                width:32, height:32, borderRadius:8, 
                background:'linear-gradient(90deg,#EF4444,#F59E0B)', 
                display:'flex', alignItems:'center', justifyContent:'center', 
                boxShadow:'0 2px 8px rgba(0,0,0,0.12)' 
              }}>
                <AlertTriangle size={18} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>Alert Stats</h1>
                <div style={{ fontSize:12, color:'#6B7280' }}>
                  Real-time NOC Dashboard
                </div>
              </div>
            </div>

            <nav style={{ display:'flex', gap:8 }}>
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