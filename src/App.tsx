import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NeighborhoodProvider } from './contexts/NeighborhoodContext';
import { ToastProvider } from './components/UI';
import BrazilWhatsappMask from './components/BrazilWhatsappMask';
import RecoveryRedirect from './components/RecoveryRedirect';
import InteractionGuard from './components/InteractionGuard';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
import { PanicButton, CookieConsent } from './components/Safety';

const Feed = lazy(() => import('./pages/Feed'));
const Mural = lazy(() => import('./pages/Mural'));
const Denuncias = lazy(() => import('./pages/Denuncias'));
const Mapa = lazy(() => import('./pages/Mapa'));
const Estatisticas = lazy(() => import('./pages/Estatisticas'));
const Login = lazy(() => import('./pages/Login'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const Empregos = lazy(() => import('./pages/Empregos'));
const CompanyDashboard = lazy(() => import('./pages/CompanyDashboard'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PostDetails = lazy(() => import('./pages/PostDetails'));

function RouteFallback() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#211a16] px-5 py-4 shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="h-5 w-5 rounded-full border-2 border-orange-700 border-t-transparent animate-spin" aria-hidden="true" />
        Carregando...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NeighborhoodProvider>
            <DataProvider>
              <ToastProvider>
                <RecoveryRedirect />
                <HashRouter>
                  <BrazilWhatsappMask />
                  <InteractionGuard />
                  <Layout>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/" element={<Feed />} />
                        <Route path="/guia" element={<Empregos />} />
                        <Route path="/empregos" element={<Empregos />} />
                        <Route path="/mural" element={<Mural />} />
                        <Route path="/denuncias" element={<Denuncias />} />
                        <Route path="/mapa" element={<Mapa />} />
                        <Route path="/estatisticas" element={<Estatisticas />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/perfil" element={<ProfilePage />} />
                        <Route path="/perfil/:userId" element={<PublicProfile />} />
                        <Route path="/empresa" element={<CompanyDashboard />} />
                        <Route path="/notificacoes" element={<Notifications />} />
                        <Route path="/post/:postId" element={<PostDetails />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                  <PanicButton />
                  <CookieConsent />
                </HashRouter>
              </ToastProvider>
            </DataProvider>
          </NeighborhoodProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
