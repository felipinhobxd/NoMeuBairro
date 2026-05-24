import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '../contexts/DataContext';
import { Card, Badge } from '../components/UI';
import { Map as MapIcon, Filter, Info, AlertTriangle, Lightbulb, Shield, Trash2, Bus, HelpCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { PostCategory } from '../types';
import { useNavigate } from 'react-router-dom';

// Fix para ícones do Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const categoryIcons: Record<PostCategory, any> = {
  buraco: AlertTriangle,
  iluminacao: Lightbulb,
  seguranca: Shield,
  limpeza: Trash2,
  transporte: Bus,
  fios: AlertTriangle,
  outros: HelpCircle,
};

const categoryColors: Record<PostCategory, string> = {
  buraco: 'bg-amber-500',
  iluminacao: 'bg-yellow-400',
  seguranca: 'bg-red-500',
  limpeza: 'bg-emerald-500',
  transporte: 'bg-blue-500',
  fios: 'bg-orange-500',
  outros: 'bg-slate-500',
};

// Componente para ajustar o zoom e centro baseado nos marcadores
function RecenterButton({ points }: { points: [number, number][] }) {
  const map = useMap();

  if (points.length === 0) return null;

  const handleRecenter = () => {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50] });
  };

  return (
    <button
      onClick={handleRecenter}
      className="absolute bottom-20 right-4 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
      title="Centralizar em todos os relatos"
    >
      <MapIcon className="w-5 h-5" />
    </button>
  );
}

export default function Mapa() {
  const { posts } = useData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostCategory | 'all'>('all');

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const hasCoords = p.latitude && p.longitude;
      const matchesFilter = filter === 'all' || p.category === filter;
      return hasCoords && matchesFilter;
    });
  }, [posts, filter]);

  const points = useMemo(() =>
    filteredPosts.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number]),
  [filteredPosts]);

  // Centro inicial: Vitória Régia, Curitiba (aprox)
  const defaultCenter: [number, number] = [-25.5415, -49.3375];

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <MapIcon className="w-5 h-5 text-emerald-600" />
            </div>
            Mapa Comunitário
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Visualize todos os relatos do bairro geograficamente</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
              filter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Todos
          </button>
          {(Object.keys(categoryIcons) as PostCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 capitalize ${
                filter === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex-1 !p-0 overflow-hidden relative border-slate-200 dark:border-slate-800 shadow-xl">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          className="z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredPosts.map(post => {
            const Icon = categoryIcons[post.category] || HelpCircle;
            return (
              <Marker
                key={post.id}
                position={[Number(post.latitude), Number(post.longitude)]}
              >
                <Popup minWidth={200} className="custom-popup">
                  <div className="p-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${categoryColors[post.category]}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{post.category}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-1 leading-tight">{post.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{post.description}</p>
                    <button
                      onClick={() => navigate('/')} // No feed, o post será focado se o ID for passado (idealmente)
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      Ver Detalhes no Feed
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <RecenterButton points={points} />
        </MapContainer>

        {/* Legend Overlay */}
        <div className="absolute top-4 right-4 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 hidden md:block">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Info className="w-3 h-3" /> Legenda
          </h4>
          <div className="space-y-2">
            {filteredPosts.length === 0 && (
              <p className="text-[10px] text-slate-500 italic">Nenhum relato nesta categoria.</p>
            )}
            {Object.entries(categoryColors).map(([cat, color]) => {
              const count = posts.filter(p => p.category === cat && p.latitude).length;
              if (count === 0) return null;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 capitalize">{cat}</span>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-700 dark:text-slate-300">{filteredPosts.length}</span>
          <span>Relatos visualizados</span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
        <p className="hidden sm:block">Clique nos marcadores para ver os detalhes de cada ocorrência.</p>
      </div>
    </div>
  );
}
