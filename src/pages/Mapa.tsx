import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '../contexts/DataContext';
import { curitibaNeighborhoods, useNeighborhood } from '../contexts/NeighborhoodContext';
import { Card } from '../components/UI';
import {
  Map as MapIcon, Info, AlertTriangle, Lightbulb, Shield, Trash2, Bus, HelpCircle, Zap, CircleDot,
  Layers3, MapPin, ExternalLink, Loader2,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import type { PostCategory, CommunityEvent } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';

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
  buraco: '#f59e0b', iluminacao: '#eab308', seguranca: '#ef4444', limpeza: '#10b981',
  transporte: '#3b82f6', fios: '#f97316', outros: '#64748b',
};

const lucideCategories: Record<PostCategory, typeof AlertTriangle> = {
  buraco: CircleDot, iluminacao: Lightbulb, seguranca: Shield, limpeza: Trash2,
  transporte: Bus, fios: Zap, outros: HelpCircle,
};

const eventLabels: Record<string, { emoji: string; label: string }> = {
  feira: { emoji: '🛍️', label: 'Feira' }, saude: { emoji: '❤️', label: 'Saúde' },
  reuniao: { emoji: '👥', label: 'Reunião' }, cultura: { emoji: '🎭', label: 'Cultura' },
  esporte: { emoji: '⚽', label: 'Esporte' }, campanha: { emoji: '📢', label: 'Campanha' },
  outros: { emoji: '📅', label: 'Evento' },
};

type LayerKey = 'reports' | 'events' | 'jobs';

type MapJob = {
  id: string;
  companyName: string;
  companyLogoUrl?: string;
  title: string;
  description: string;
  employmentType?: string;
  workModel?: string;
  location?: string;
  neighborhood?: string;
  salaryMin?: number;
  salaryMax?: number;
};

type Positioned<T> = { item: T; lat: number; lng: number; approximate: boolean };

const layerMeta: Record<LayerKey, { label: string; emoji: string; color: string }> = {
  reports: { label: 'Relatos', emoji: '📍', color: '#ea580c' },
  events: { label: 'Eventos', emoji: '📅', color: '#7c3aed' },
  jobs: { label: 'Empregos', emoji: '💼', color: '#2563eb' },
};

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function neighborhoodFromText(value?: string | null) {
  if (!value?.trim()) return null;
  const normalized = normalizeText(value);
  return curitibaNeighborhoods.find((neighborhood) => normalized.includes(normalizeText(neighborhood.name))) || null;
}

function smallOffset(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const angle = (Math.abs(hash) % 360) * Math.PI / 180;
  const radius = 0.00025 + (Math.abs(hash >> 8) % 4) * 0.00007;
  return { lat: Math.sin(angle) * radius, lng: Math.cos(angle) * radius };
}

function approximatePosition(text: string | undefined, id: string) {
  const neighborhood = neighborhoodFromText(text);
  if (!neighborhood) return null;
  const offset = smallOffset(id);
  return { lat: neighborhood.latitude + offset.lat, lng: neighborhood.longitude + offset.lng, approximate: true };
}

function createEmojiIcon(emoji: string, color: string, size = 50) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="15" fill="${color}" stroke="white" stroke-width="4"/><text x="${size / 2}" y="${Math.round(size * 0.65)}" text-anchor="middle" font-size="${Math.round(size * 0.47)}" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${emoji}</text></svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 2)],
    className: 'category-map-marker-image',
  });
}

function createCategoryIcon(category: PostCategory) {
  const cfg = categoryIcons[category] ?? categoryIcons.outros;
  return createEmojiIcon(cfg.emoji, categoryColors[category] ?? categoryColors.outros, 56);
}

function FocusPoint({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 18, { animate: false }); }, [map, lat, lng]);
  return null;
}

function RecenterButton({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length === 0) return null;
  return (
    <button
      onClick={() => map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: false, maxZoom: 16 })}
      type="button"
      className="absolute bottom-5 right-4 z-[1000] bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-orange-700 transition-colors"
      title="Enquadrar itens visíveis"
      aria-label="Enquadrar itens visíveis"
    >
      <MapIcon className="w-5 h-5" />
    </button>
  );
}

function eventPosition(event: CommunityEvent): Positioned<CommunityEvent> | null {
  if (event.latitude != null && event.longitude != null) return { item: event, lat: Number(event.latitude), lng: Number(event.longitude), approximate: false };
  const fallback = approximatePosition(event.location, event.id);
  return fallback ? { item: event, ...fallback } : null;
}

function jobPosition(job: MapJob): Positioned<MapJob> | null {
  const fallback = approximatePosition(`${job.location || ''} ${job.neighborhood || ''}`, job.id);
  return fallback ? { item: job, ...fallback } : null;
}

export default function Mapa() {
  const { posts, events } = useData();
  const { currentNeighborhood } = useNeighborhood();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostCategory | 'all'>('all');
  const [layers, setLayers] = useState<Set<LayerKey>>(() => new Set(['reports']));
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState(false);
  const [focusedPostId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('anb-map-focus-post'); } catch { return null; }
  });

  const reportPositions = useMemo(() => posts.flatMap((post) => {
    if (filter !== 'all' && post.category !== filter) return [];
    if (post.latitude != null && post.longitude != null) return [{ item: post, lat: Number(post.latitude), lng: Number(post.longitude), approximate: false }];
    const fallback = approximatePosition(post.location, post.id);
    return fallback ? [{ item: post, ...fallback }] : [];
  }), [posts, filter]);

  const eventPositions = useMemo(() => events.map(eventPosition).filter(Boolean) as Positioned<CommunityEvent>[], [events]);
  const jobPositions = useMemo(() => jobs.map(jobPosition).filter(Boolean) as Positioned<MapJob>[], [jobs]);

  const focusedPost = useMemo(() => focusedPostId ? reportPositions.find((entry) => entry.item.id === focusedPostId) ?? null : null, [reportPositions, focusedPostId]);

  const categoryMarkerIcons = useMemo(() => {
    const out = {} as Record<PostCategory, L.Icon>;
    (Object.keys(categoryIcons) as PostCategory[]).forEach((category) => { out[category] = createCategoryIcon(category); });
    return out;
  }, []);
  const eventIcon = useMemo(() => createEmojiIcon('📅', layerMeta.events.color), []);
  const jobIcon = useMemo(() => createEmojiIcon('💼', layerMeta.jobs.color), []);

  useEffect(() => {
    if (!focusedPostId) return;
    setLayers((previous) => new Set(previous).add('reports'));
    setFilter('all');
    try { sessionStorage.removeItem('anb-map-focus-post'); } catch {}
  }, [focusedPostId]);

  useEffect(() => {
    if (!layers.has('jobs') || jobsLoaded || jobsLoading) return;
    setJobsLoading(true);
    setJobsError(false);
    void supabase
      .from('public_job_posts')
      .select('id,company_name,company_logo_url,title,description,employment_type,work_model,location,neighborhood,salary_min,salary_max,is_active,expires_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.error('Erro ao carregar vagas no mapa:', error);
          setJobsError(true);
          setJobsLoading(false);
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        setJobs((data || []).filter((row: any) => !row.expires_at || row.expires_at >= today).map((row: any) => ({
          id: row.id,
          companyName: row.company_name || 'Empresa',
          companyLogoUrl: row.company_logo_url || undefined,
          title: row.title || 'Oportunidade',
          description: row.description || '',
          employmentType: row.employment_type || undefined,
          workModel: row.work_model || undefined,
          location: row.location || undefined,
          neighborhood: row.neighborhood || undefined,
          salaryMin: row.salary_min == null ? undefined : Number(row.salary_min),
          salaryMax: row.salary_max == null ? undefined : Number(row.salary_max),
        })));
        setJobsLoaded(true);
        setJobsLoading(false);
      });
  }, [layers, jobsLoaded]);

  const toggleLayer = (layer: LayerKey) => setLayers((previous) => {
    const next = new Set(previous);
    if (next.has(layer)) next.delete(layer); else next.add(layer);
    return next;
  });

  const showAllLayers = () => setLayers(new Set<LayerKey>(['reports', 'events', 'jobs']));
  const allLayersActive = layers.size === 3;

  const visiblePoints = useMemo(() => {
    const result: [number, number][] = [];
    if (layers.has('reports')) result.push(...reportPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    if (layers.has('events')) result.push(...eventPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    if (layers.has('jobs')) result.push(...jobPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    return result;
  }, [layers, reportPositions, eventPositions, jobPositions]);

  const layerCounts: Record<LayerKey, number> = {
    reports: reportPositions.length,
    events: eventPositions.length,
    jobs: jobPositions.length,
  };

  const defaultCenter: [number, number] = [currentNeighborhood.latitude, currentNeighborhood.longitude];

  const openJob = (jobId: string) => {
    try { sessionStorage.setItem('anb-job-focus', jobId); } catch {}
    navigate('/empregos');
  };

  const openEvent = (eventId: string) => {
    try { sessionStorage.setItem('anb-mural-focus-event', eventId); } catch {}
    navigate('/mural');
  };

  return (
    <div className="min-h-[620px] h-[calc(100dvh-140px)] flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center"><MapIcon className="w-5 h-5 text-orange-700 dark:text-orange-300" /></span>
              Mapa Comunitário
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Combine relatos, eventos e vagas no mesmo mapa.</p>
          </div>
          <button
            type="button"
            onClick={showAllLayers}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${allLayersActive ? 'bg-orange-700 text-white border-orange-700' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'}`}
          >
            <Layers3 className="w-4 h-4" /> Mostrar tudo
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Camadas do mapa">
          {(Object.keys(layerMeta) as LayerKey[]).map((layer) => {
            const active = layers.has(layer);
            const meta = layerMeta[layer];
            const layerLoading = layer === 'jobs' && jobsLoading;
            return (
              <button
                key={layer}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLayer(layer)}
                className={`min-h-11 shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all ${active ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border-slate-300 dark:border-slate-600' : 'bg-slate-100/80 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-transparent'}`}
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>{layerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : meta.emoji}</span>
                {meta.label}
                {layer === 'jobs' && jobsError ? <span className="text-[10px] font-black text-red-600">ERRO</span> : active && !layerLoading && <span className="text-xs font-black text-slate-500 dark:text-slate-300">{layerCounts[layer]}</span>}
              </button>
            );
          })}
        </div>

        {layers.has('reports') && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Categorias dos relatos">
            <button onClick={() => setFilter('all')} type="button" className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === 'all' ? 'bg-orange-700 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Todos os relatos</button>
            {(Object.keys(categoryIcons) as PostCategory[]).map((category) => {
              const Icon = lucideCategories[category];
              return <button key={category} onClick={() => setFilter(category)} type="button" className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${filter === category ? 'bg-orange-700 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}><Icon className="w-3.5 h-3.5" />{categoryIcons[category].label}</button>;
            })}
          </div>
        )}
      </div>

      <Card className="flex-1 min-h-[360px] !p-0 overflow-hidden relative border-slate-200 dark:border-slate-800 shadow-xl">
        <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} className="z-10" zoomAnimation markerZoomAnimation={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {focusedPost && <FocusPoint lat={focusedPost.lat} lng={focusedPost.lng} />}

          {layers.has('reports') && reportPositions.map(({ item: post, lat, lng, approximate }) => (
            <Marker key={`post-${post.id}`} position={[lat, lng]} icon={categoryMarkerIcons[post.category] ?? categoryMarkerIcons.outros} riseOnHover zIndexOffset={focusedPost?.item.id === post.id ? 1000 : 500}>
              <Popup minWidth={270} className="custom-popup">
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2"><span className="text-lg">{categoryIcons[post.category]?.emoji ?? '📍'}</span><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: categoryColors[post.category] }}>{categoryIcons[post.category]?.label ?? 'Outros'}</span></div>
                  <h3 className="font-bold text-slate-900 mb-1 leading-tight">{post.title}</h3>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Por {post.authorName}</p>
                  <p className="text-xs text-slate-600 line-clamp-3 mb-3">{post.description}</p>
                  <p className="text-xs text-slate-500 mb-3 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />{post.location}{approximate ? ' · posição aproximada' : ''}</p>
                  {post.imageUrl && <img src={post.imageUrl} alt="Imagem do relato" className="w-full h-36 object-cover rounded-xl mb-3" loading="lazy" decoding="async" />}
                  <button onClick={() => navigate(`/post/${post.id}`)} type="button" className="w-full py-2.5 bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold rounded-lg transition-colors">Ver detalhes no post</button>
                </div>
              </Popup>
            </Marker>
          ))}

          {layers.has('events') && eventPositions.map(({ item: event, lat, lng, approximate }) => {
            const meta = eventLabels[event.type] ?? eventLabels.outros;
            return (
              <Marker key={`event-${event.id}`} position={[lat, lng]} icon={eventIcon} riseOnHover zIndexOffset={420}>
                <Popup minWidth={260} className="custom-popup">
                  <div className="p-1">
                    <div className="flex items-center gap-2 mb-2"><span className="text-lg">{meta.emoji}</span><span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{meta.label}</span></div>
                    <h3 className="font-bold text-slate-900 mb-1">{event.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-3 mb-2">{event.description}</p>
                    <p className="text-xs font-semibold text-slate-600 mb-2">📅 {new Date(`${event.date}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-slate-500 mb-3">📍 {event.location}{approximate ? ' · posição aproximada' : ''}</p>
                    <button onClick={() => openEvent(event.id)} type="button" className="w-full py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold rounded-lg transition-colors">Ver no Mural <ExternalLink className="w-3.5 h-3.5 inline ml-1" /></button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {layers.has('jobs') && jobPositions.map(({ item: job, lat, lng, approximate }) => (
            <Marker key={`job-${job.id}`} position={[lat, lng]} icon={jobIcon} riseOnHover zIndexOffset={400}>
              <Popup minWidth={270} className="custom-popup">
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2">
                    {job.companyLogoUrl ? <img src={job.companyLogoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" loading="lazy" /> : <span className="text-xl">💼</span>}
                    <div><span className="block text-[11px] font-bold uppercase tracking-wider text-blue-700">Emprego</span><span className="text-xs font-semibold text-slate-600">{job.companyName}</span></div>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{job.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-3 mb-2">{job.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2 text-[11px] font-semibold text-slate-600">
                    {job.employmentType && <span className="px-2 py-1 rounded-md bg-slate-100">{job.employmentType.toUpperCase()}</span>}
                    {job.workModel && <span className="px-2 py-1 rounded-md bg-slate-100">{job.workModel}</span>}
                  </div>
                  {typeof job.salaryMin === 'number' && <p className="text-xs font-bold text-blue-700 mb-2">R$ {job.salaryMin.toLocaleString('pt-BR')}{typeof job.salaryMax === 'number' ? ` – R$ ${job.salaryMax.toLocaleString('pt-BR')}` : ''}</p>}
                  <p className="text-xs text-slate-500 mb-3">📍 {job.location || job.neighborhood || 'Localização não informada'}{approximate ? ' · posição aproximada pelo bairro' : ''}</p>
                  <button onClick={() => openJob(job.id)} type="button" className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors">Ver vaga <ExternalLink className="w-3.5 h-3.5 inline ml-1" /></button>
                </div>
              </Popup>
            </Marker>
          ))}

          <RecenterButton points={visiblePoints} />
        </MapContainer>

        <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 hidden lg:block min-w-[180px]">
          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Visível no mapa</h4>
          <div className="space-y-2">
            {(Object.keys(layerMeta) as LayerKey[]).filter((layer) => layers.has(layer)).map((layer) => <div key={layer} className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${layerMeta[layer].color}18` }}>{layerMeta[layer].emoji}</span><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{layerMeta[layer].label}</span><span className="text-xs font-black text-slate-500 ml-auto">{layerCounts[layer]}</span></div>)}
            {layers.size === 0 && <p className="text-xs text-slate-500">Ative uma camada acima.</p>}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-600" /><strong className="text-slate-900 dark:text-white">{visiblePoints.length}</strong><span>itens visíveis</span></div>
        {jobsLoading && <div className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando vagas...</div>}
        {jobsError && <p className="font-semibold text-red-600 dark:text-red-400">Não foi possível carregar as vagas. Desative e ative Empregos para tentar novamente.</p>}
        <p className="hidden sm:block">Você pode combinar várias camadas. Marcadores aproximados são identificados no detalhe.</p>
      </div>
    </div>
  );
}
