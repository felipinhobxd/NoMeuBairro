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
import { PanicButton, CookieConsent } from './components/Safety';
import Feed from './pages/Feed';
import Mural from './pages/Mural';
import Denuncias from './pages/Denuncias';
import Mapa from './pages/Mapa';
import Estatisticas from './pages/Estatisticas';
import Login from './pages/Login';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Empregos from './pages/Empregos';
import CompanyDashboard from './pages/CompanyDashboard';
import Notifications from './pages/Notifications';
import PostDetails from './pages/PostDetails';

export default function App() {
  return <ThemeProvider><AuthProvider><NeighborhoodProvider><DataProvider><ToastProvider><RecoveryRedirect /><HashRouter><BrazilWhatsappMask /><InteractionGuard /><Layout><Routes>
    <Route path="/" element={<Feed />} />
    <Route path="/guia" element={<Empregos />} />
    <Route path="/empregos" element={<Empregos />} />
    <Route path="/mural" element={<Mural />} />
    <Route path="/denuncias" element={<Denuncias />} />
    <Route path="/mapa" element={<Mapa />} />
    <Route path="/estatisticas" element={<Estatisticas />} />
    <Route path="/login" element={<Login />} />
    <Route path="/perfil" element={<Profile />} />
    <Route path="/perfil/:userId" element={<PublicProfile />} />
    <Route path="/empresa" element={<CompanyDashboard />} />
    <Route path="/notificacoes" element={<Notifications />} />
    <Route path="/post/:postId" element={<PostDetails />} />
  </Routes></Layout><PanicButton /><CookieConsent /></HashRouter></ToastProvider></DataProvider></NeighborhoodProvider></AuthProvider></ThemeProvider>;
}
