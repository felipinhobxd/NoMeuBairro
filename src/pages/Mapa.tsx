import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useData } from '../contexts/DataContext';
import { curitibaNeighborhoods, useNeighborhood } from '../contexts/NeighborhoodContext';
import { Card } from '../components/UI';
import MapClusterController, { type HeatPoint } from '../components/MapClusterController';
import {
  Map as MapIcon, Info, AlertTriangle, Lightbulb, Shield, Trash2, Bus, HelpCircle, Zap, CircleDot,
  Layers3, MapPin, ExternalLink, Loader2, LocateFixed, Flame, Eye,
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
type UserPoint = { lat: number; lng: number };

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
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'exact' | 'neighborhood';
};

type Positioned<T> = { item: T; lat: number; lng: number; approximate: boolean };

const layerMeta: Record<LayerKey, { label: string; emoji: string; color: string; description: string }> = {
  reports: { label: 'Relatos', emoji: '📍', color: '#ea580c', description: 'Problemas e relatos da comunidade' },
  events: { label: 'Eventos', emoji: '📅', color: '#7c3aed', description: 'Eventos publicados no Mural' },
  jobs: { label: 'Empregos', emoji: '💼', color: '#2563eb', description: 'Vagas com localização disponível' },
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

function distanceKm(a: UserPoint, b: UserPoint) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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

function FocusPoint({ lat, lng, zoom = 18, popupZIndex }: { lat: number; lng: number; zoom?: number; popupZIndex?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: false });
    if (popupZIndex == null) return;
    const timer = window.setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker && Number(layer.options.zIndexOffset || 0) === popupZIndex) layer.openPopup();
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [map, lat, lng, zoom, popupZIndex]);
  return null;
}

function RecenterButton({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length === 0) return null;
  return (
    <button
      onClick={() => map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: true, maxZoom: 16 })}
      type="button"
      className="absolute bottom-5 right-4 z-[1000] w-11 h-11 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-orange-700 hover:border-orange-300 transition-all active:scale-95 flex items-center justify-center"
      title="Enquadrar itens visíveis"
      aria-label="Enquadrar itens visíveis"
    >
      <MapIcon className="w-5 h-5" />
    </button>
  );
}

function eventPosition(event: CommunityEvent): Positioned<CommunityEvent> | null {
  if (event.latitude != null && event.longitude != null) {
    return {
      item: event,
      lat: Number(event.latitude),
      lng: Number(event.longitude),
      approximate: Boolean(event.locationPrecision && event.locationPrecision !== 'exact'),
    };
  }
  const fallback = approximatePosition(`${event.location || ''} ${event.neighborhood || ''}`, event.id);
  return fallback ? { item: event, ...fallback } : null;
}

function jobPosition(job: MapJob): Positioned<MapJob> | null {
  if (job.latitude != null && job.longitude != null && Number.isFinite(job.latitude) && Number.isFinite(job.longitude)) {
    return {
      item: job,
      lat: Number(job.latitude),
      lng: Number(job.longitude),
      approximate: job.locationPrecision !== 'exact',
    };
  }
  const fallback = approximatePosition(`${job.location || ''} ${job.neighborhood || ''}`, job.id);
  return fallback ? { item: job, ...fallback } : null;
}

export default function Mapa() {
  const { posts, events } = useData();
  const { currentNeighborhood } = useNeighborhood();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostCategory | 'all'>('all');
  const [layers, setLayers] = useState<Set<LayerKey>>(() => new Set(['reports', 'events', 'jobs']));
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState(false);
  const [userPosition, setUserPosition] = useState<UserPoint | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [focusedPostId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('anb-map-focus-post'); } catch { return null; }
  });
  const [focusedEventId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('anb-map-focus-event'); } catch { return null; }
  });

  const reportPositions = useMemo(() => (posts || []).flatMap((post) => {
    if (filter !== 'all' && post.category !== filter) return [];
    if (post.latitude != null && post.longitude != null) return [{ item: post, lat: Number(post.latitude), lng: Number(post.longitude), approximate: Boolean(post.locationPrecision && post.locationPrecision !== 'exact') }];
    const fallback = approximatePosition(`${post.location || ''} ${post.neighborhood || ''}`, post.id);
    return fallback ? [{ item: post, ...fallback }] : [];
  }), [posts, filter]);

  const eventPositions = useMemo(() => (events || []).map(eventPosition).filter(Boolean) as Positioned<CommunityEvent>[], [events]);
  const jobPositions = useMemo(() => jobs.map(jobPosition).filter(Boolean) as Positioned<MapJob>[], [jobs]);

  const withinNearbyRadius = (position: { lat: number; lng: number }) => !nearMe || !userPosition || distanceKm(userPosition, position) <= 3;
  const visibleReportPositions = useMemo(() => reportPositions.filter(withinNearbyRadius), [reportPositions, nearMe, userPosition]);
  const visibleEventPositions = useMemo(() => eventPositions.filter(withinNearbyRadius), [eventPositions, nearMe, userPosition]);
  const visibleJobPositions = useMemo(() => jobPositions.filter(withinNearbyRadius), [jobPositions, nearMe, userPosition]);

  const focusedPost = useMemo(() => focusedPostId ? reportPositions.find((entry) => entry.item.id === focusedPostId) ?? null : null, [reportPositions, focusedPostId]);
  const focusedEvent = useMemo(() => focusedEventId ? eventPositions.find((entry) => entry.item.id === focusedEventId) ?? null : null, [eventPositions, focusedEventId]);

  const categoryMarkerIcons = useMemo(() => {
    const out = {} as Record<PostCategory, L.Icon>;
    (Object.keys(categoryIcons) as PostCategory[]).forEach((category) => { out[category] = createCategoryIcon(category); });
    return out;
  }, []);
  const eventIcon = useMemo(() => createEmojiIcon('📅', layerMeta.events.color), []);
  const jobIcon = useMemo(() => createEmojiIcon('💼', layerMeta.jobs.color), []);
  const userIcon = useMemo(() => createEmojiIcon('●', '#0f766e', 42), []);

  useEffect(() => {
    if (!focusedPostId) return;
    setLayers((previous) => new Set(previous).add('reports'));
    setFilter('all');
    setNearMe(false);
    try { sessionStorage.removeItem('anb-map-focus-post'); } catch {}
  }, [focusedPostId]);

  useEffect(() => {
    if (!focusedEventId) return;
    setLayers((previous) => new Set(previous).add('events'));
    setNearMe(false);
    try { sessionStorage.removeItem('anb-map-focus-event'); } catch {}
  }, [focusedEventId]);

  useEffect(() => {
    if (!layers.has('jobs') || jobsLoaded || jobsLoading) return;
    setJobsLoading(true);
    setJobsError(false);
    void supabase
      .from('public_job_posts')
      .select('id,company_name,company_logo_url,title,description,employment_type,work_model,location,neighborhood,salary_min,salary_max,latitude,longitude,location_precision,is_active,expires_at')
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
          latitude: row.latitude == null ? undefined : Number(row.latitude),
          longitude: row.longitude == null ? undefined : Number(row.longitude),
          locationPrecision: row.location_precision === 'exact' ? 'exact' : row.location_precision === 'neighborhood' ? 'neighborhood' : undefined,
        })));
        setJobsLoaded(true);
        setJobsLoading(false);
      });
  }, [layers, jobsLoaded, jobsLoading]);

  const toggleLayer = (layer: LayerKey) => setLayers((previous) => {
    const next = new Set(previous);
    if (next.has(layer)) next.delete(layer); else next.add(layer);
    return next;
  });

  const showAllLayers = () => setLayers(new Set<LayerKey>(['reports', 'events', 'jobs']));
  const allLayersActive = layers.size === 3;

  const toggleNearMe = () => {
    if (nearMe) {
      setNearMe(false);
      setLocationError('');
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Seu navegador não oferece localização.');
      return;
    }
    setLocationLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNearMe(true);
        setLocationLoading(false);
        setLayers((previous) => new Set(previous).add('reports').add('events'));
      },
      (error) => {
        setLocationLoading(false);
        setLocationError(error.code === error.PERMISSION_DENIED ? 'Permita o acesso à localização para usar “Perto de mim”.' : 'Não foi possível obter sua localização agora.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const visiblePoints = useMemo(() => {
    const result: [number, number][] = [];
    if (layers.has('reports')) result.push(...visibleReportPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    if (layers.has('events')) result.push(...visibleEventPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    if (layers.has('jobs')) result.push(...visibleJobPositions.map((entry) => [entry.lat, entry.lng] as [number, number]));
    if (nearMe && userPosition) result.push([userPosition.lat, userPosition.lng]);
    return result;
  }, [layers, visibleReportPositions, visibleEventPositions, visibleJobPositions, nearMe, userPosition]);

  const heatPoints = useMemo<HeatPoint[]>(() => {
    const result: HeatPoint[] = [];
    if (layers.has('reports')) {
      result.push(...visibleReportPositions.map(({ item, lat, lng, approximate }) => ({
        id: `post-${item.id}`, lat, lng, approximate, weight: approximate ? 0.58 : 1,
      })));
    }
    if (layers.has('events')) {
      result.push(...visibleEventPositions.map(({ item, lat, lng, approximate }) => ({
        id: `event-${item.id}`, lat, lng, approximate, weight: approximate ? 0.58 : 1,
      })));
    }
    if (layers.has('jobs')) {
      result.push(...visibleJobPositions.map(({ item, lat, lng, approximate }) => ({
        id: `job-${item.id}`, lat, lng, approximate, weight: approximate ? 0.58 : 1,
      })));
    }
    return result;
  }, [layers, visibleReportPositions, visibleEventPositions, visibleJobPositions]);

  const layerCounts: Record<LayerKey, number> = {
    reports: visibleReportPositions.length,
    events: visibleEventPositions.length,
    jobs: visibleJobPositions.length,
  };

  const itemCount = visiblePoints.length - (nearMe && userPosition ? 1 : 0);
  const defaultCenter: [number, number] = [currentNeighborhood.latitude, currentNeighborhood.longitude];
  const defaultZoom = currentNeighborhood.name ? 14 : 12;

  const openJob = (jobId: string) => {
    try { sessionStorage.setItem('anb-job-focus', jobId); } catch {}
    navigate('/empregos');
  };

  const openEvent = (eventId: string) => {
    try { sessionStorage.setItem('anb-mural-focus-event', eventId); } catch {}
    navigate('/mural');
  };

  return (
    <div className="min-h-[650px] h-[calc(100dvh-132px)] flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0"><MapIcon className="w-5 h-5 text-orange-700 dark:text-orange-300" /></span>
            Mapa Comunitário
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Áreas mais movimentadas ficam mais quentes conforme relatos, eventos e vagas se acumulam.</p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleNearMe}
            disabled={locationLoading}
            className={`min-h-11 inline-flex items-center justify-center gap-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold border transition-all disabled:opacity-60 ${nearMe ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-300'}`}
          >
            {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            {nearMe ? 'Raio de 3 km' : 'Perto de mim'}
          </button>
          <button
            type="button"
            onClick={showAllLayers}
            className={`min-h-11 inline-flex items-center justify-center gap-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${allLayersActive ? 'bg-orange-700 text-white border-orange-700 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-orange-300'}`}
          >
            <Layers3 className="w-4 h-4" /> Mostrar tudo
          </button>
        </div>
      </div>

      <Card className="!p-3 sm:!p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0" aria-label="Camadas do mapa">
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
                  className={`min-h-11 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl border text-sm font-bold transition-all ${active ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm border-slate-900 dark:border-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  title={meta.description}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: active ? 'rgba(255,255,255,.13)' : `${meta.color}18`, color: active ? 'inherit' : meta.color }}>{layerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : meta.emoji}</span>
                  {meta.label}
                  {layer === 'jobs' && jobsError ? <span className="text-[10px] font-black text-red-500">ERRO</span> : active && !layerLoading && <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-white/15 dark:bg-slate-900/10' : 'bg-slate-200 dark:bg-slate-800'}`}>{layerCounts[layer]}</span>}
                </button>
              );
            })}
          </div>

        </div>

        {layers.has('reports') && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Categorias dos relatos">
            <button onClick={() => setFilter('all')} type="button" className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${filter === 'all' ? 'bg-orange-700 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Todos os relatos</button>
            {(Object.keys(categoryIcons) as PostCategory[]).map((category) => {
              const Icon = lucideCategories[category];
              return <button key={category} onClick={() => setFilter(category)} type="button" className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${filter === category ? 'bg-orange-700 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}><Icon className="w-3.5 h-3.5" />{categoryIcons[category].label}</button>;
            })}
          </div>
        )}
      </Card>

      {locationError && <p className="-mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{locationError}</p>}

      <Card className="flex-1 min-h-[390px] !p-0 overflow-hidden relative !border-slate-200 dark:!border-slate-800 shadow-xl">
        <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ height: '100%', width: '100%' }} className="z-10" zoomAnimation markerZoomAnimation zoomAnimationThreshold={6} zoomSnap={1} wheelDebounceTime={28} wheelPxPerZoomLevel={70}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {focusedEvent && <FocusPoint lat={focusedEvent.lat} lng={focusedEvent.lng} zoom={18} popupZIndex={1100} />}
          {!focusedEvent && focusedPost && <FocusPoint lat={focusedPost.lat} lng={focusedPost.lng} zoom={18} popupZIndex={1000} />}
          {!focusedEvent && !focusedPost && nearMe && userPosition && <FocusPoint lat={userPosition.lat} lng={userPosition.lng} zoom={14} />}

          {nearMe && userPosition && (
            <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} zIndexOffset={1200}>
              <Popup><div className="text-sm font-bold text-slate-900">Você está aproximadamente aqui</div><p className="text-xs text-slate-500 mt-1">Sua localização é usada apenas nesta tela e não é salva.</p></Popup>
            </Marker>
          )}

          {layers.has('reports') && visibleReportPositions.map(({ item: post, lat, lng, approximate }) => (
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

          {layers.has('events') && visibleEventPositions.map(({ item: event, lat, lng, approximate }) => {
            const meta = eventLabels[event.type] ?? eventLabels.outros;
            const isFocused = focusedEvent?.item.id === event.id;
            return (
              <Marker key={`event-${event.id}`} position={[lat, lng]} icon={eventIcon} riseOnHover zIndexOffset={isFocused ? 1100 : 420}>
                <Popup minWidth={280} className="custom-popup">
                  <div className="p-1">
                    <div className="flex items-center gap-2 mb-2"><span className="text-lg">{meta.emoji}</span><span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{meta.label}</span>{isFocused && <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">EVENTO SELECIONADO</span>}</div>
                    <h3 className="font-bold text-slate-900 mb-1">{event.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-3 mb-2">{event.description}</p>
                    <p className="text-xs font-semibold text-slate-600 mb-2">📅 {new Date(`${event.date}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                    <div className="rounded-lg bg-violet-50 px-3 py-2 mb-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-0.5">Endereço do evento</p>
                      <p className="text-xs font-semibold text-slate-700">📍 {event.location || 'Localização não informada'}</p>
                      {approximate && <p className="text-[10px] text-slate-500 mt-1">Posição aproximada no mapa.</p>}
                    </div>
                    <button onClick={() => openEvent(event.id)} type="button" className="w-full py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold rounded-lg transition-colors">Ver no Mural <ExternalLink className="w-3.5 h-3.5 inline ml-1" /></button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {layers.has('jobs') && visibleJobPositions.map(({ item: job, lat, lng, approximate }) => (
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
                  <p className="text-xs text-slate-500 mb-3">📍 {job.location || job.neighborhood || 'Localização não informada'}{approximate ? ' · posição aproximada pelo bairro' : ' · posição no endereço informado'}</p>
                  <button onClick={() => openJob(job.id)} type="button" className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors">Ver vaga <ExternalLink className="w-3.5 h-3.5 inline ml-1" /></button>
                </div>
              </Popup>
            </Marker>
          ))}

          <MapClusterController points={heatPoints} />
          <RecenterButton points={visiblePoints} />
        </MapContainer>

        <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 hidden lg:block min-w-[205px]">
          <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Visível no mapa</h4>
          <div className="space-y-2.5">
            {(Object.keys(layerMeta) as LayerKey[]).filter((layer) => layers.has(layer)).map((layer) => <div key={layer} className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${layerMeta[layer].color}18` }}>{layerMeta[layer].emoji}</span><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{layerMeta[layer].label}</span><span className="text-xs font-black text-slate-500 ml-auto">{layerCounts[layer]}</span></div>)}
            {true && <div className="pt-2 border-t border-slate-100 dark:border-slate-800"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> Mapa de calor</p><div className="h-2.5 rounded-full bg-gradient-to-r from-green-500 via-yellow-400 via-orange-500 to-red-600" /><div className="flex justify-between mt-1 text-[9px] font-semibold text-slate-400"><span>poucos</span><span>muitos</span></div></div>}
            {nearMe && <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 pt-1">Filtrando em até 3 km de você.</p>}
            {layers.size === 0 && <p className="text-xs text-slate-500">Ative uma camada acima.</p>}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-orange-600" /><strong className="text-slate-900 dark:text-white">{itemCount}</strong><span>itens visíveis</span></div>
        {true && <span className="font-semibold text-orange-700 dark:text-orange-300">Cores mais quentes = maior concentração de itens</span>}
        {nearMe && <span className="font-semibold text-teal-700 dark:text-teal-300">Perto de mim ativo · sua posição não é armazenada</span>}
        {jobsLoading && <div className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando vagas...</div>}
        {jobsError && <p className="font-semibold text-red-600 dark:text-red-400">Não foi possível carregar as vagas. Desative e ative Empregos para tentar novamente.</p>}
        <p className="hidden md:block ml-auto text-slate-400">Os números indicam quantos itens estão agrupados naquela área.</p>
      </div>
    </div>
  );
}
