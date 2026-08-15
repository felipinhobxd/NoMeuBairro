import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '../contexts/DataContext';
import { useNeighborhood } from '../contexts/NeighborhoodContext';
import { Card } from '../components/UI';
import { Map as MapIcon, Info, AlertTriangle, Lightbulb, Shield, Trash2, Bus, HelpCircle, Zap, CircleDot, X, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PostCategory, Post } from '../types';
import { useNavigate } from 'react-router-dom';

const categoryIcons: Record<PostCategory, { emoji: string; label: string }> = {
  buraco: { emoji: '🕳️', label: 'Buraco' },
  iluminacao: { emoji: '💡', label: 'Iluminação' },
  seguranca: { emoji: '🛡️', label: 'Segurança' },
  limpeza: { emoji: '🗑️', label: 'Limpeza' },
  transporte: { emoji: '🚌', label: 'Transporte' },
  fios: { emoji: '⚡', label: 'Fios' },
  outros: { emoji: '❓', label: 'Outros' },
};

const categoryColors: Record<PostCategory, string> = {
  buraco: '#f59e0b',
  iluminacao: '#eab308',
  seguranca: '#ef4444',
  limpeza: '#10b981',
  transporte: '#3b82f6',
  fios: '#f97316',
  outros: '#64748b',
};

const lucideCategories: Record<PostCategory, typeof AlertTriangle> = {
  buraco: CircleDot,
  iluminacao: Lightbulb,
  seguranca: Shield,
  limpeza: Trash2,
  transporte: Bus,
  fios: Zap,
  outros: HelpCircle,
};

function createCategoryIcon(category: PostCategory) {
  const cfg = categoryIcons[category] ?? categoryIcons.outros;
  const color = categoryColors[category] ?? categoryColors.outros;

  return L.divIcon({
    className: 'category-map-marker',
    html: `<div title="${cfg.label}" style="width:60px;height:60px;border-radius:18px;background:${color};border:3px solid white;box-shadow:0 6px 20px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1;cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;box-sizing:border-box">${cfg.emoji}</div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -32],
  });
}

function RecenterButton({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (!points.length) return null;

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: false });
      }}
      className="absolute bottom-20 right-4 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
      title="Centralizar em todos os relatos"
      type="button"
    >
      <MapIcon className="w-5 h-5" />
    </button>
  );
}

export default function Mapa() {
  const { posts } = useData();
  const { currentNeighborhood } = useNeighborhood();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostCategory | 'all'>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const filteredPosts = useMemo(
    () => posts.filter(
      p => p.latitude != null && p.longitude != null && (filter === 'all' || p.category === filter)
    ),
    [posts, filter]
  );

  const points = useMemo(
    () => filteredPosts.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number]),
    [filteredPosts]
  );

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) ?? null : null;
  const defaultCenter: [number, number] = [currentNeighborhood.latitude, currentNeighborhood.longitude];

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
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Filtre por categoria e toque em qualquer parte do marcador para ver o relato.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => { setFilter('all'); setSelectedPostId(null); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
            type="button"
          >
            Todos
          </button>
          {(Object.keys(categoryIcons) as PostCategory[]).map(cat => {
            const Icon = lucideCategories[cat];
            const count = posts.filter(p => p.category === cat && p.latitude != null && p.longitude != null).length;
            return (
              <button
                key={cat}
                onClick={() => { setFilter(cat); setSelectedPostId(null); }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                type="button"
              >
                <Icon className="w-3.5 h-3.5" />
                {categoryIcons[cat].label}
                {count > 0 && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="flex-1 !p-0 overflow-hidden relative border-slate-200 dark:border-slate-800 shadow-xl">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          className="z-10"
          zoomAnimation
          markerZoomAnimation={false}
          touchZoom
          dragging
          tapTolerance={20}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredPosts.map((post: Post) => (
            <Marker
              key={post.id}
              position={[Number(post.latitude), Number(post.longitude)]}
              icon={createCategoryIcon(post.category)}
              riseOnHover
              bubblingMouseEvents={false}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => setSelectedPostId(post.id),
              }}
            />
          ))}

          <RecenterButton points={points} />
        </MapContainer>

        {selectedPost && (
          <PostMapPanel
            post={selectedPost}
            onClose={() => setSelectedPostId(null)}
            onOpen={() => navigate(`/post/${selectedPost.id}`)}
          />
        )}

        <div className="absolute top-4 right-4 z-[1000] pointer-events-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 hidden md:block">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Info className="w-3 h-3" /> Legenda
          </h4>
          <div className="space-y-2">
            {filteredPosts.length === 0 && <p className="text-[10px] text-slate-500 italic">Nenhum relato nesta categoria.</p>}
            {(Object.keys(categoryIcons) as PostCategory[]).map(cat => {
              const count = posts.filter(p => p.category === cat && p.latitude != null && p.longitude != null).length;
              if (!count) return null;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm" style={{ background: `${categoryColors[cat]}20` }}>
                    {categoryIcons[cat].emoji}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{categoryIcons[cat].label}</span>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 z-[1000] md:right-auto md:max-w-sm pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/70 dark:border-slate-700/70 shadow-lg text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <strong className="text-slate-700 dark:text-slate-200">{filteredPosts.length}</strong>
            <span>relatos no mapa</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PostMapPanel({ post, onClose, onOpen }: { post: Post; onClose: () => void; onOpen: () => void }) {
  const anonymous = post.authorId === 'anonymous';
  const authorName = anonymous ? 'Denúncia Anônima' : (post.authorName || 'Morador');
  const color = categoryColors[post.category] ?? categoryColors.outros;
  const category = categoryIcons[post.category] ?? categoryIcons.outros;

  return (
    <div
      className="absolute z-[1100] bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      onClick={event => event.stopPropagation()}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${color}20` }}>
          {category.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>{category.label}</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mt-1 leading-tight">{post.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">📍 {post.location}</p>
        </div>
        <button onClick={onClose} type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">
            {anonymous ? 'D' : post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" /> : authorName.charAt(0).toUpperCase()}
          </div>
          <span className={anonymous ? 'text-xs font-semibold text-red-600 dark:text-red-400' : 'text-xs font-semibold text-slate-700 dark:text-slate-200'}>{authorName}</span>
        </div>

        {post.imageUrl && (
          <img src={post.imageUrl} alt="Imagem do relato" className="w-full h-40 object-cover rounded-xl mb-3" loading="lazy" />
        )}

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">{post.description}</p>

        <button
          onClick={onOpen}
          type="button"
          className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
        >
          Ver detalhes do post
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
