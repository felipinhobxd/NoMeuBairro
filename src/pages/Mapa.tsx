import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '../contexts/DataContext';
import { useNeighborhood } from '../contexts/NeighborhoodContext';
import { Card } from '../components/UI';
import { Map as MapIcon, Info, AlertTriangle, Lightbulb, Shield, Trash2, Bus, HelpCircle, Zap, CircleDot, X, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Post, PostCategory } from '../types';
import { useNavigate } from 'react-router-dom';

const categoryIcons: Record<PostCategory, { emoji: string; label: string }> = {
  buraco: { emoji: '🕳️', label: 'Buraco' }, iluminacao: { emoji: '💡', label: 'Iluminação' }, seguranca: { emoji: '🛡️', label: 'Segurança' }, limpeza: { emoji: '🗑️', label: 'Limpeza' }, transporte: { emoji: '🚌', label: 'Transporte' }, fios: { emoji: '⚡', label: 'Fios' }, outros: { emoji: '❓', label: 'Outros' },
};
const categoryColors: Record<PostCategory, string> = { buraco: '#f59e0b', iluminacao: '#eab308', seguranca: '#ef4444', limpeza: '#10b981', transporte: '#3b82f6', fios: '#f97316', outros: '#64748b' };
const lucideCategories: Record<PostCategory, typeof AlertTriangle> = { buraco: CircleDot, iluminacao: Lightbulb, seguranca: Shield, limpeza: Trash2, transporte: Bus, fios: Zap, outros: HelpCircle };

function createCategoryIcon(category: PostCategory) {
  const cfg = categoryIcons[category] ?? categoryIcons.outros;
  const color = categoryColors[category] ?? categoryColors.outros;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect x="3" y="3" width="66" height="66" rx="20" fill="${color}" stroke="white" stroke-width="5"/><text x="36" y="46" text-anchor="middle" font-size="34" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${cfg.emoji}</text></svg>`;
  return L.icon({ iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, iconSize: [72, 72], iconAnchor: [36, 36], className: 'category-map-marker-image' });
}

function RecenterButton({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (!points.length) return null;
  return <button onClick={(e) => { e.stopPropagation(); map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: false }); }} className="absolute bottom-20 right-4 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors" title="Centralizar em todos os relatos" type="button"><MapIcon className="w-5 h-5" /></button>;
}

function SelectedPostOverlay({ post, onClose }: { post: Post; onClose: () => void }) {
  const map = useMap();
  const navigate = useNavigate();
  const [position, setPosition] = useState({ left: 0, top: 0, below: false });

  useEffect(() => {
    const update = () => {
      const point = map.latLngToContainerPoint([Number(post.latitude), Number(post.longitude)]);
      const rect = map.getContainer().getBoundingClientRect();
      const cardHalf = Math.min(190, Math.max(150, rect.width / 2 - 16));
      const left = Math.min(Math.max(point.x, cardHalf + 8), rect.width - cardHalf - 8);
      const below = point.y < 220;
      const top = Math.min(Math.max(point.y, 24), rect.height - 24);
      setPosition({ left, top, below });
    };
    update();
    map.on('move zoom resize', update);
    return () => { map.off('move zoom resize', update); };
  }, [map, post]);

  const anonymous = post.authorId === 'anonymous';
  const authorName = anonymous ? 'Denúncia Anônima' : (post.authorName || 'Morador');
  const color = categoryColors[post.category] ?? categoryColors.outros;
  const category = categoryIcons[post.category] ?? categoryIcons.outros;

  return (
    <div
      className="absolute z-[2000] w-[min(380px,calc(100%-20px))] pointer-events-auto"
      style={{ left: position.left, top: position.top, transform: position.below ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 18px))' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-2xl bg-slate-950 text-white shadow-2xl border border-slate-700 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${color}22`, border: `1px solid ${color}66` }}>{category.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>{category.label}</div>
              <h3 className="font-bold text-base leading-tight mt-1">{post.title}</h3>
              <div className="text-[11px] text-slate-400 mt-1 truncate">📍 {post.location}</div>
            </div>
            <button onClick={onClose} type="button" aria-label="Fechar" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center text-[11px] font-bold text-emerald-400 shrink-0">{anonymous ? 'D' : post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" /> : authorName.charAt(0).toUpperCase()}</div>
            <span className={anonymous ? 'text-xs font-semibold text-red-400' : 'text-xs font-semibold text-slate-200'}>{authorName}</span>
          </div>
          {post.imageUrl && <img src={post.imageUrl} alt="Imagem do relato" className="w-full h-32 object-cover rounded-xl mt-4" loading="lazy" />}
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mt-3">{post.description}</p>
          <button onClick={() => navigate(`/post/${post.id}`)} type="button" className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">Ver detalhes do post <ExternalLink className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-950 border-r border-b border-slate-700 rotate-45 ${position.below ? 'top-[-8px]' : 'bottom-[-8px]'}`} />
    </div>
  );
}

export default function Mapa() {
  const { posts } = useData();
  const { currentNeighborhood } = useNeighborhood();
  const [filter, setFilter] = useState<PostCategory | 'all'>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const filteredPosts = useMemo(() => posts.filter(p => p.latitude != null && p.longitude != null && (filter === 'all' || p.category === filter)), [posts, filter]);
  const points = useMemo(() => filteredPosts.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number]), [filteredPosts]);
  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) ?? null : null;
  const defaultCenter: [number, number] = [currentNeighborhood.latitude, currentNeighborhood.longitude];

  useEffect(() => {
    if (selectedPost && !filteredPosts.some(p => p.id === selectedPost.id)) setSelectedPostId(null);
  }, [filteredPosts, selectedPost]);

  return <div className="h-[calc(100vh-160px)] flex flex-col gap-4">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><MapIcon className="w-5 h-5 text-emerald-600" /></div>Mapa Comunitário</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Filtre por categoria e toque em qualquer parte do marcador para ver o relato.</p></div><div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar"><button onClick={() => { setFilter('all'); setSelectedPostId(null); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`} type="button">Todos</button>{(Object.keys(categoryIcons) as PostCategory[]).map(cat => { const Icon = lucideCategories[cat]; const count = posts.filter(p => p.category === cat && p.latitude != null && p.longitude != null).length; return <button key={cat} onClick={() => { setFilter(cat); setSelectedPostId(null); }} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`} type="button"><Icon className="w-3.5 h-3.5" />{categoryIcons[cat].label}{count > 0 && <span className="opacity-70">{count}</span>}</button>; })}</div></div>

    <Card className="flex-1 !p-0 overflow-hidden relative border-slate-200 dark:border-slate-800 shadow-xl"><MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} className="z-10" zoomAnimation markerZoomAnimation={false} touchZoom dragging tapTolerance={20}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {filteredPosts.map((post: Post) => <Marker key={post.id} position={[Number(post.latitude), Number(post.longitude)]} icon={createCategoryIcon(post.category)} riseOnHover zIndexOffset={1000} bubblingMouseEvents={false} eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); setSelectedPostId(post.id); } }} />)}
      {selectedPost && <SelectedPostOverlay post={selectedPost} onClose={() => setSelectedPostId(null)} />}
      <RecenterButton points={points} />
    </MapContainer>

    <div className="absolute top-4 right-4 z-[1000] pointer-events-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 hidden md:block"><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info className="w-3 h-3" /> Legenda</h4><div className="space-y-2">{filteredPosts.length === 0 && <p className="text-[10px] text-slate-500 italic">Nenhum relato nesta categoria.</p>}{(Object.keys(categoryIcons) as PostCategory[]).map(cat => { const count = posts.filter(p => p.category === cat && p.latitude != null && p.longitude != null).length; if (!count) return null; return <div key={cat} className="flex items-center gap-2"><span className="w-6 h-6 rounded-md flex items-center justify-center text-sm" style={{ background: `${categoryColors[cat]}20` }}>{categoryIcons[cat].emoji}</span><span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{categoryIcons[cat].label}</span><span className="text-[10px] font-bold text-slate-400 ml-auto">{count}</span></div>; })}</div></div>
    <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none"><div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/70 dark:border-slate-700/70 shadow-lg text-xs text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><strong className="text-slate-700 dark:text-slate-200">{filteredPosts.length}</strong><span>relatos no mapa</span></div></div>
  </div>;
}
