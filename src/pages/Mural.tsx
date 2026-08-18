import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  useNeighborhood, neighborhoodMatches, neighborhoodSearchText, normalizeNeighborhoodText,
} from '../contexts/NeighborhoodContext';
import { CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw, Search, X, LocateFixed, Map, AlertTriangle, Bookmark } from 'lucide-react';
import { EmptyState, Card, Modal, Input, Textarea, Select, Button, useToast } from '../components/UI';
import MapPicker from '../components/MapPicker';
import { cn } from '../utils/cn';
import type { EventType } from '../types';
import { useSavedItems } from '../hooks/useSavedItems';
import { clearLocalDraft, readLocalDraft, saveLocalDraft } from '../utils/localDrafts';

const evTypes: Record<EventType, { label: string; emoji: string }> = {
  feira: { label: 'Feira', emoji: '🛍️' }, saude: { label: 'Saúde', emoji: '❤️' },
  reuniao: { label: 'Reunião', emoji: '👥' }, cultura: { label: 'Cultura', emoji: '🎭' },
  esporte: { label: 'Esporte', emoji: '⚽' }, campanha: { label: 'Campanha', emoji: '📢' },
  outros: { label: 'Outros', emoji: '📌' },
};
const evTypeOpts = Object.entries(evTypes).map(([v, d]) => ({ value: v, label: `${d.emoji} ${d.label}` }));
const filterTypes: { id: EventType | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'Todos', emoji: '📋' },
  ...Object.entries(evTypes).map(([id, d]) => ({ id: id as EventType, ...d })),
];

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Mural() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    events, addEvent, deleteEvent, isMyEvent, toggleAttendance, getEventAttendees, reportContent,
    loadEvents, eventsLoading, attendingEventIds,
  } = useData();
  const { currentNeighborhood, isNeighborhoodSelected } = useNeighborhood();
  const { toast } = useToast();
  const { isSaved: isEventSaved, toggleSaved: toggleSavedEvent } = useSavedItems('event');

  const [activeType, setActiveType] = useState<EventType | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<{ eventId: string; title: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [nearMe, setNearMe] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [viewAttendeesTarget, setViewAttendeesTarget] = useState<{ id: string; title: string } | null>(null);
  const [currentAttendees, setCurrentAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  const [ft, setFt] = useState('');
  const [ftype, setFtype] = useState<EventType>('reuniao');
  const [fdate, setFdate] = useState('');
  const [floc, setFloc] = useState('');
  const [fdesc, setFdesc] = useState('');
  const [fLat, setFLat] = useState<number | undefined>();
  const [fLng, setFLng] = useState<number | undefined>();
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [eventDraftReady, setEventDraftReady] = useState(false);
  const [eventDraftRestored, setEventDraftRestored] = useState(false);

  useEffect(() => {
    setEventDraftReady(false);
    setEventDraftRestored(false);
    if (!user?.id) return;
    const key = `nmb-draft:event:${user.id}`;
    const draft = readLocalDraft<{ title?: string; type?: EventType; date?: string; location?: string; description?: string; latitude?: number; longitude?: number }>(key);
    if (draft) {
      setFt(draft.title || '');
      setFtype(draft.type || 'reuniao');
      setFdate(draft.date || '');
      setFloc(draft.location || '');
      setFdesc(draft.description || '');
      setFLat(typeof draft.latitude === 'number' ? draft.latitude : undefined);
      setFLng(typeof draft.longitude === 'number' ? draft.longitude : undefined);
      if (draft.title || draft.date || draft.location || draft.description) setEventDraftRestored(true);
    }
    setEventDraftReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !eventDraftReady) return;
    const key = `nmb-draft:event:${user.id}`;
    const hasContent = Boolean(ft.trim() || fdate || floc.trim() || fdesc.trim() || fLat != null || fLng != null);
    if (!hasContent) {
      clearLocalDraft(key);
      return;
    }
    const timer = window.setTimeout(() => {
      saveLocalDraft(key, { title: ft, type: ftype, date: fdate, location: floc, description: fdesc, latitude: fLat, longitude: fLng });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [user?.id, eventDraftReady, ft, ftype, fdate, floc, fdesc, fLat, fLng]);

  const discardEventDraft = useCallback(() => {
    if (user?.id) clearLocalDraft(`nmb-draft:event:${user.id}`);
    setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc(''); setFLat(undefined); setFLng(undefined);
    setEventDraftRestored(false);
    toast('Rascunho descartado.', 'info');
  }, [user?.id, toast]);

  useEffect(() => {
    const focusedId = sessionStorage.getItem('anb-mural-focus-event');
    if (!focusedId || events.length === 0) return;
    setActiveType('all');
    setSearchQuery('');
    const timer = window.setTimeout(() => {
      document.getElementById(`ev-${focusedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sessionStorage.removeItem('anb-mural-focus-event');
    }, 100);
    return () => window.clearTimeout(timer);
  }, [events.length]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    for (const e of events) c[e.type] = (c[e.type] ?? 0) + 1;
    return c;
  }, [events]);

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = normalizeNeighborhoodText(searchQuery);
    return events.filter(e => {
      if (activeType !== 'all' && e.type !== activeType) return false;

      if (q) {
        const searchable = normalizeNeighborhoodText([
          e.title, e.description, e.location, e.neighborhood || '', e.locality || '',
          neighborhoodSearchText(e.neighborhood), neighborhoodSearchText(e.locality),
        ].join(' '));
        return searchable.includes(q);
      }

      if (nearMe) {
        const center = userLocation || { lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude };
        if (e.latitude == null || e.longitude == null) return false;
        return distanceKm(center.lat, center.lng, Number(e.latitude), Number(e.longitude)) <= 5;
      }

      if (!isNeighborhoodSelected || !currentNeighborhood.name) return true;
      return neighborhoodMatches(currentNeighborhood.name, e.neighborhood, e.locality, e.location);
    });
  }, [events, activeType, searchQuery, nearMe, userLocation, currentNeighborhood, isNeighborhoodSelected]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [filtered]);

  const toggleNearMe = () => {
    if (nearMe) {
      setNearMe(false);
      setUserLocation(null);
      return;
    }
    if (!navigator.geolocation) {
      setNearMe(true);
      setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude });
      toast('GPS indisponível. Usando o centro do bairro selecionado.', 'info');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setLocating(false);
      },
      () => {
        setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude });
        setNearMe(true);
        setLocating(false);
        toast('GPS indisponível. Usando o centro do bairro selecionado.', 'info');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const handleCreate = async () => {
    if (!ft.trim() || !fdate || !floc.trim() || !fdesc.trim()) return;
    const { error } = await addEvent({
      title: ft,
      description: fdesc,
      date: fdate,
      location: floc.trim(),
      type: ftype,
      latitude: fLat,
      longitude: fLng,
    });

    if (!error) {
      if (user?.id) clearLocalDraft(`nmb-draft:event:${user.id}`);
      setEventDraftRestored(false);
      setShowCreate(false);
      setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc('');
      setFLat(undefined); setFLng(undefined);
      toast('Evento publicado com sucesso!');
    } else toast('Erro ao publicar evento. Verifique sua conexão.', 'error');
  };

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteEvent(id);
    if (!result.ok) { toast(result.error || 'Não foi possível remover o evento.', 'error'); return; }
    setConfirmDeleteId(null);
    toast('Evento removido.', 'info');
  }, [deleteEvent, toast]);

  const handleToggleAttendance = async (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const result = await toggleAttendance(eventId);
    if (!result.ok) { toast(result.error || 'Não foi possível atualizar sua presença.', 'error'); return; }
    toast('Presença atualizada!');
  };

  const openAttendees = async (id: string, title: string) => {
    setViewAttendeesTarget({ id, title });
    setLoadingAttendees(true);
    setCurrentAttendees(await getEventAttendees(id));
    setLoadingAttendees(false);
  };

  const openMapOverview = useCallback(() => {
    try {
      sessionStorage.removeItem('anb-map-focus-post');
      sessionStorage.removeItem('anb-map-focus-event');
    } catch {}
    navigate('/mapa');
  }, [navigate]);

  const handleSendReport = async () => {
    if (!showReport || !reportReason.trim()) return;
    if (!isAuthenticated || !user) { navigate('/login'); return; }
    const reason = reportDetail.trim() ? `${reportReason}: ${reportDetail.trim()}` : reportReason;
    const result = await reportContent({ eventId: showReport.eventId, reason });
    if (!result.ok) { toast(result.error || 'Não foi possível enviar a denúncia.', 'error'); return; }
    setShowReport(null);
    setReportReason('');
    setReportDetail('');
    toast('Denúncia enviada para análise do administrador.');
  };

  const selectedLabel = isNeighborhoodSelected && currentNeighborhood.name ? currentNeighborhood.name : 'todos os bairros';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Mural da Comunidade</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mostrando <strong className="text-emerald-600 dark:text-emerald-400">{selectedLabel}</strong>
          </p>
        </div>
        <button
          onClick={() => { void loadEvents(true); toast('Atualizando mural...', 'info'); }}
          disabled={eventsLoading}
          className="mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
          aria-label="Atualizar mural"
        >
          <RefreshCw className={cn('w-5 h-5', eventsLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar evento, bairro ou CIC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
        </div>
        <button
          onClick={toggleNearMe}
          disabled={locating}
          className={cn('min-h-11 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors', nearMe ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}
          aria-pressed={nearMe}
        >
          <LocateFixed className={cn('w-4 h-4', locating && 'animate-pulse')} />
          <span className="hidden sm:inline">Perto de mim</span>
        </button>
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filterTypes.map(t => {
            const count = typeCounts[t.id] ?? 0;
            return (
              <button key={t.id} role="tab" aria-selected={activeType === t.id} onClick={() => setActiveType(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all', activeType === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}>
                <span role="img" aria-hidden="true">{t.emoji}</span>{t.label}
                {count > 0 && <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none', activeType === t.id ? 'bg-white/20' : 'bg-slate-200/80 dark:bg-slate-700')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {eventsLoading && events.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">Carregando eventos...</div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={CalendarDays}
          title={searchQuery ? 'Nenhum evento encontrado' : 'Nenhum evento no mural'}
          description={searchQuery ? `Nenhum resultado para "${searchQuery}".` : `Nenhum evento encontrado em ${selectedLabel}.`}
          action={isAuthenticated ? { label: 'Publicar evento', onClick: () => setShowCreate(true) } : { label: 'Entrar para participar', onClick: () => navigate('/login') }} />
      ) : (
        <div className="space-y-3 stagger">
          {sorted.map(ev => {
            const et = evTypes[ev.type] ?? evTypes.outros;
            const isPast = new Date(ev.date + 'T23:59:59') < new Date();
            const canDelete = isMyEvent(ev);
            const isExpanded = expandedEvents.has(ev.id);
            const shouldShowReadMore = ev.description.length > 150;
            const isAttending = attendingEventIds.has(ev.id);
            const area = ev.locality && ev.neighborhood ? `${ev.locality} · ${ev.neighborhood}` : ev.locality || ev.neighborhood;

            return (
              <Card key={ev.id} id={`ev-${ev.id}`} className={cn(isPast && 'opacity-60', 'animate-card-enter scroll-mt-28')}>
                <div className="flex gap-4">
                  <div className="shrink-0 w-16 text-center">
                    <div className="w-16 h-16 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-none">{new Date(ev.date + 'T12:00:00').getDate()}</span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{new Date(ev.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ev.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400"><span role="img" aria-hidden="true">{et.emoji}</span>{et.label}</span>
                        {canDelete && (confirmDeleteId === ev.id ? (
                          <div className="flex items-center gap-1 animate-fade-in"><button onClick={() => handleDelete(ev.id)} className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold">Confirmar</button><button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">Cancelar</button></div>
                        ) : <button onClick={() => setConfirmDeleteId(ev.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Excluir evento"><Trash2 className="w-3.5 h-3.5" /></button>)}
                      </div>
                    </div>

                    <p className={cn('text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed', !isExpanded && 'line-clamp-2')}>{ev.description}</p>
                    {shouldShowReadMore && <button onClick={() => toggleExpand(ev.id)} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline">{isExpanded ? 'Ver menos' : 'Ler descrição completa'}</button>}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {area && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 font-semibold text-orange-800 dark:text-orange-300"><MapPin className="w-3 h-3" />{area}</span>}
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" />{ev.location}</span>
                      <span className="inline-flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" />{fmtDate(ev.date)}</span>
                      {ev.latitude != null && ev.longitude != null && <button onClick={openMapOverview} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"><Map className="w-3 h-3" />Ver no mapa</button>}
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                      <button onClick={() => { if (!isAuthenticated) { navigate('/login'); return; } setShowReport({ eventId: ev.id, title: ev.title }); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><AlertTriangle className="w-3.5 h-3.5" />Denunciar</button>
                      <button type="button" onClick={() => void toggleSavedEvent(ev.id)} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors', isEventSaved(ev.id) ? 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/10' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10')} aria-pressed={isEventSaved(ev.id)}><Bookmark className={cn('w-3.5 h-3.5', isEventSaved(ev.id) && 'fill-current')} />{isEventSaved(ev.id) ? 'Salvo' : 'Salvar'}</button>
                      <button onClick={() => openAttendees(ev.id, ev.title)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"><Users className="w-3.5 h-3.5" /><span>{ev.attendanceCount || 0}</span></button>
                      <Button size="sm" variant="secondary" className={cn('h-8 !px-3 !text-[11px]', isAttending && '!bg-emerald-600 !text-white !ring-0 hover:!bg-emerald-700')} onClick={() => void handleToggleAttendance(ev.id)} aria-pressed={isAttending}>
                        <CheckCircle2 className="w-3.5 h-3.5" />{isAttending ? 'Confirmado' : 'Vou comparecer'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isAuthenticated && <button onClick={() => setShowCreate(true)} className="fixed bottom-28 md:bottom-8 right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center active:scale-95 group" aria-label="Publicar evento"><Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" /></button>}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Publicar Evento">
        <form onSubmit={e => { e.preventDefault(); void handleCreate(); }} className="space-y-4">
          {eventDraftRestored && <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10"><div><p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Rascunho recuperado automaticamente</p><p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Seu evento ficou salvo neste dispositivo.</p></div><button type="button" onClick={discardEventDraft} className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline shrink-0">Descartar</button></div>}
          <Input label="Título do evento" placeholder="Ex: Feira de orgânicos" value={ft} onChange={e => setFt(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3"><Select label="Tipo" options={evTypeOpts} value={ftype} onChange={e => setFtype(e.target.value as EventType)} required /><Input label="Data" type="date" value={fdate} onChange={e => setFdate(e.target.value)} required /></div>
          <Input label="Local" placeholder="Ex: Praça, rua e número" value={floc} onChange={e => setFloc(e.target.value)} required />
          <MapPicker onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); }} address={floc} />
          <Textarea label="Descrição" placeholder="Detalhes do evento, horário, como participar..." value={fdesc} onChange={e => setFdesc(e.target.value)} required />
          <p className="text-[10px] text-slate-400">O rascunho deste evento é salvo automaticamente neste dispositivo por até 30 dias.</p>
          <div className="flex gap-3 pt-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button><Button type="submit" className="flex-1" disabled={!ft.trim() || !fdate || !floc.trim() || !fdesc.trim()}>Publicar</Button></div>
        </form>
      </Modal>

      <Modal open={!!showReport} onClose={() => { setShowReport(null); setReportReason(''); setReportDetail(''); }} title="Denunciar Evento">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Você está denunciando <strong>{showReport?.title}</strong>. Escolha o motivo para o administrador analisar.</p>
          <Select label="Categoria da Denúncia" options={[{ value: '', label: 'Selecione uma categoria...' }, { value: 'Conteúdo ofensivo ou ódio', label: 'Conteúdo ofensivo ou ódio' }, { value: 'Informação falsa (Spam)', label: 'Informação falsa (Spam)' }, { value: 'Assédio ou perseguição', label: 'Assédio ou perseguição' }, { value: 'Conteúdo inadequado ou ilegal', label: 'Conteúdo inadequado ou ilegal' }, { value: 'Outros', label: 'Outros' }]} value={reportReason} onChange={e => setReportReason(e.target.value)} />
          <Textarea label="Detalhes da denúncia (opcional)" placeholder="Explique o problema para ajudar na análise..." value={reportDetail} onChange={e => setReportDetail(e.target.value)} rows={3} />
          <div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1" onClick={() => { setShowReport(null); setReportReason(''); setReportDetail(''); }}>Cancelar</Button><Button className="flex-1 !bg-red-600 hover:!bg-red-700 !text-white" onClick={() => void handleSendReport()} disabled={!reportReason}>Enviar Denúncia</Button></div>
        </div>
      </Modal>

      <Modal open={!!viewAttendeesTarget} onClose={() => setViewAttendeesTarget(null)} title={`Confirmados: ${viewAttendeesTarget?.title || ''}`}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {loadingAttendees ? <div className="py-10 text-center text-slate-400">Carregando lista...</div> : currentAttendees.length === 0 ? <div className="py-10 text-center text-slate-400 italic">Ninguém confirmou presença ainda.</div> : (
            <div className="grid grid-cols-1 gap-2">
              {currentAttendees.map(attendee => (
                <Link key={attendee.id} to={`/perfil/${attendee.userId}`} onClick={() => setViewAttendeesTarget(null)} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all">
                    {attendee.userAvatarUrl ? <img src={attendee.userAvatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : attendee.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white truncate">{attendee.userName}</p><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ver Perfil</p></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
