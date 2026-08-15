import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NeighborhoodProvider } from './contexts/NeighborhoodContext';
import { ToastProvider } from './components/UI';
import BrazilWhatsappMask from './components/BrazilWhatsappMask';
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
import TodosBairros from './pages/TodosBairros';
import PostDetails from './pages/PostDetails';

export default function App() {
  return <ThemeProvider><AuthProvider><NeighborhoodProvider><DataProvider><ToastProvider><HashRouter><BrazilWhatsappMask /><Layout><Routes>
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
    <Route path="/todos-bairros" element={<TodosBairros />} />
    <Route path="/post/:postId" element={<PostDetails />} />
  </Routes></Layout><PanicButton /><CookieConsent /><Link to="/todos-bairros" className="fixed bottom-28 md:bottom-8 left-6 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:ring-emerald-300 dark:hover:ring-emerald-500/30 transition-all">Todos os bairros</Link></HashRouter></ToastProvider></DataProvider></NeighborhoodProvider></AuthProvider></ThemeProvider>;
}
