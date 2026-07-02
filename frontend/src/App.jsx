import { lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
// Dashboard is the default landing route (see the index redirect below) — keep
// it eagerly bundled so the most common entry point never shows a loading
// flash. Every other route is code-split: its JS only downloads when visited.
import DashboardPage from './pages/NOCDashboard';
import { ClientConfigProvider } from './contexts/ClientConfigContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';

const ExplorerPage = lazy(() => import('./pages/ExplorerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const IncidentManagement = lazy(() => import('./pages/IncidentManagementPage'));
const PanelResearchPage = lazy(() => import('./pages/PanelResearchPage'));
const HowToUsePage = lazy(() => import('./pages/HowToUsePage'));
const IncidentStatsPage = lazy(() => import('./pages/IncidentStatsPage'));
const Health = lazy(() => import('./pages/Health'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ClientConfigProvider>
          <ErrorBoundary>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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


                <Route path="incident" element={<IncidentManagement />} />
                <Route path="research" element={<PanelResearchPage />} />
                <Route path="how-to-use" element={<HowToUsePage />} />
                <Route path="incident-stats" element={<IncidentStatsPage />} />
                <Route path="/health" element={<Health />} />

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Router>
          </ErrorBoundary>
        </ClientConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
