import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import DashboardPage from './pages/NOCDashboard';
import ExplorerPage from './pages/ExplorerPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { ClientConfigProvider } from './contexts/ClientConfigContext';
import IncidentManagment from './pages/IncidentManagment';
import IncidentHistoryPage from './pages/IncidentHistoryPage';
import PanelResearchPage from './pages/PanelResearchPage';
import HowToUsePage from './pages/HowToUsePage';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';


function App() {
  return (
    <ThemeProvider>
      <ClientConfigProvider>
        <AuthProvider>
          <ErrorBoundary>
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
                  <Route path="history" element={<IncidentHistoryPage />} />
                  <Route path="research" element={<PanelResearchPage />} />
                  <Route path="how-to-use" element={<HowToUsePage />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Router>
          </ErrorBoundary>
        </AuthProvider>
      </ClientConfigProvider>
    </ThemeProvider>
  );
}

export default App;