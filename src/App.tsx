import { lazy, Suspense, type ComponentType } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NeighborhoodProvider } from './contexts/NeighborhoodContext';
import { ToastProvider } from './components/UI';
import BrazilWhatsappMask from './components/BrazilWhatsappMask';
import RecoveryRedirect from './components/RecoveryRedirect';
import InteractionGuard from './components/InteractionGuard';
import DataRouteLoader from './components/DataRouteLoader';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
import { PanicButton, CookieConsent } from './components/Safety';

type LazyModule = { default: ComponentType<any> };
const CHUNK_RETRY_PREFIX = 'nmb-chunk-retry:';
const CHUNK_REFRESH_QUERY = '_nmb_chunk_refresh';

function isDynamicImportError(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /failed to fetch dynamically imported module|dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror|loading chunk/i.test(text);
}

function clearChunkRefreshQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHUNK_REFRESH_QUERY)) return;
    url.searchParams.delete(CHUNK_REFRESH_QUERY);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}

function lazyWithRetry(importer: () => Promise<LazyModule>, key: string) {
  return lazy(async () => {
    const retryKey = `${CHUNK_RETRY_PREFIX}${key}`;
    try {
      const loaded = await importer();
      try { sessionStorage.removeItem(retryKey); } catch {}
      clearChunkRefreshQuery();
      return loaded;
    } catch (error) {
      if (!isDynamicImportError(error)) throw error;
      let alreadyRetried = false;
      try { alreadyRetried = sessionStorage.getItem(retryKey) === '1'; } catch {}
      if (alreadyRetried) throw error;
      try { sessionStorage.setItem(retryKey, '1'); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.set(CHUNK_REFRESH_QUERY, Date.now().toString());
      window.location.replace(url.toString());
      return await new Promise<LazyModule>(() => {});
    }
  });
}

const Feed = lazyWithRetry(() => import('./pages/Feed'), 'feed');
const Mural = lazyWithRetry(() => import('./pages/Mural'), 'mural');
const Denuncias = lazyWithRetry(() => import('./pages/Denuncias'), 'denuncias');
const Mapa = lazyWithRetry(() => import('./pages/Mapa'), 'mapa');
const Estatisticas = lazyWithRetry(() => import('./pages/Estatisticas'), 'estatisticas');
const Login = lazyWithRetry(() => import('./pages/Login'), 'login');
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'), 'perfil');
const PublicProfile = lazyWithRetry(() => import('./pages/PublicProfile'), 'perfil-publico');
const Empregos = lazyWithRetry(() => import('./pages/Empregos'), 'empregos');
const CompanyDashboard = lazyWithRetry(() => import('./pages/CompanyDashboard'), 'empresa');
const CompanyPublicProfile = lazyWithRetry(() => import('./pages/CompanyPublicProfile'), 'empresa-publica');
const Notifications = lazyWithRetry(() => import('./pages/Notifications'), 'notificacoes');
const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'), 'post');
const Admin = lazyWithRetry(() => import('./pages/Admin'), 'admin');

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
                  <DataRouteLoader />
                  <BrazilWhatsappMask />
                  <InteractionGuard />
                  <Layout>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/" element={<Feed />} />
                        <Route path="/empregos" element={<Empregos />} />
                        <Route path="/mural" element={<Mural />} />
                        <Route path="/denuncias" element={<Denuncias />} />
                        <Route path="/mapa" element={<Mapa />} />
                        <Route path="/estatisticas" element={<Estatisticas />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/perfil" element={<ProfilePage />} />
                        <Route path="/perfil/:userId" element={<PublicProfile />} />
                        <Route path="/empresa" element={<CompanyDashboard />} />
                        <Route path="/empresa/:companyId" element={<CompanyPublicProfile />} />
                        <Route path="/notificacoes" element={<Notifications />} />
                        <Route path="/post/:postId" element={<PostDetails />} />
                        <Route path="/admin" element={<Admin />} />
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
