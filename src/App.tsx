import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './components/UI';
import Layout from './components/Layout';
import { PanicButton, CookieConsent } from './components/Safety';
import Feed from './pages/Feed';
import GuiaComercial from './pages/GuiaComercial';
import Mural from './pages/Mural';
import Denuncias from './pages/Denuncias';
import Login from './pages/Login';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <HashRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Feed />} />
                  <Route path="/guia" element={<GuiaComercial />} />
                  <Route path="/mural" element={<Mural />} />
                  <Route path="/denuncias" element={<Denuncias />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/perfil" element={<Profile />} />
                  <Route path="/perfil/:userId" element={<PublicProfile />} />
                </Routes>
              </Layout>
              <PanicButton />
              <CookieConsent />
            </HashRouter>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
