import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import DashboardPage  from './pages/NOCDashboard';
import  ExplorerPage  from './pages/ExplorerPage';
import  SettingsPage  from './pages/SettingsPage';
import  NotFoundPage  from './pages/NotFoundPage';
import { ClientConfigProvider } from './contexts/ClientConfigContext';
import IncidentManagment from './pages/IncidentManagment';


function App() {
  return (
    <ClientConfigProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Default redirect */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard with optional date range in URL */}
            <Route path="dashboard" element={<DashboardPage />} />
            
            {/* Explorer with full URL state support */}
            <Route path="explorer" element={<ExplorerPage />} />
            
            {/* Settings page */}
            <Route path="settings" element={<SettingsPage />} />
            
            
            <Route path="incident" element={<IncidentManagment />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </ClientConfigProvider>
  );
}

export default App;