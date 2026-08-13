import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NeighborhoodProvider } from './contexts/NeighborhoodContext';
import { ToastProvider } from './components/UI';
import Layout from './components/Layout';
import { PanicButton, CookieConsent } from './components/Safety';
import Feed from './pages/Feed';
import GuiaComercial from './pages/GuiaComercial';
import Mural from './pages/Mural';
import Denuncias from './pages/Denuncias';
import Mapa from './pages/Mapa';
import Estatisticas from './pages/Estatisticas';
import Login from './pages/Login';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Empregos from './pages/Empregos';

export default function App() {
  return <ThemeProvider><AuthProvider><NeighborhoodProvider><DataProvider><ToastProvider><HashRouter><Layout><Routes>
    <Route path="/" element={<Feed />} />
    <Route path="/guia" element={<GuiaComercial />} />
    <Route path="/mural" element={<Mural />} />
    <Route path="/denuncias" element={<Denuncias />} />
    <Route path="/mapa" element={<Mapa />} />
    <Route path="/estatisticas" element={<Estatisticas />} />
    <Route path="/empregos" element={<Empregos />} />
    <Route path="/login" element={<Login />} />
    <Route path="/perfil" element={<Profile />} />
    <Route path="/perfil/:userId" element={<PublicProfile />} />
  </Routes></Layout><PanicButton /><CookieConsent /></HashRouter></ToastProvider></DataProvider></NeighborhoodProvider></AuthProvider></ThemeProvider>;
}
