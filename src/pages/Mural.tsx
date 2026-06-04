import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigate, Link } from 'react-router-dom';
import { useNeighborhood } from '../contexts/NeighborhoodContext';
import { CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw } from 'lucide-react';
import { EmptyState, Card, Modal, Input, Textarea, Select, Button, useToast, ImageViewer } from '../components/UI';
import MapView from '../components/MapView';
import MapPicker from '../components/MapPicker';
import { cn } from '../utils/cn';
import type { EventType } from '../types';

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

export default function Mural() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { events, addEvent, deleteEvent, isMyEvent, toggleAttendance, getEventAttendees, fetchData, loading } = useData();
  const { toast } = useToast();

  const [activeType, setActiveType] = useState<EventType | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [viewAttendeesTarget, setViewAttendeesTarget] = useState<{ id: string; title: string } | null>(null);
  const [currentAttendees, setCurrentAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [userAttendance, setUserAttendance] = useState<Set<string>>(new Set());

  // Detecta quais eventos o usuário atual vai comparecer (simplificado via localStorage para UX rápida + DB)
  useEffect(() => {
    // Aqui poderíamos buscar do banco, mas para manter a performance,
    // a verificação real acontece no toggleAttendance do DataContext.
  }, [events, user]);

  const [ft, setFt] = useState(''); const [ftype, setFtype] = useState<EventType>('reuniao');
  const [fdate, setFdate] = useState(''); const [floc, setFloc] = useState(''); const [fdesc, setFdesc] = useState('');
  const [fLat, setFLat] = useState<number | undefined>();
  const [fLng, setFLng] = useState<number | undefined>();
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  // ─── Haversine Distance Formula ────────────────────────
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    for (const e of events) c[e.type] = (c[e.type] ?? 0) + 1;
    return c;
  }, [events]);

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { currentNeighborhood } = useNeighborhood();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (currentNeighborhood) {
      setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude });
    }
  }, [currentNeighborhood]);

  const filtered = useMemo(() => {
    const normalize = (s: string) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const currentNBName = normalize(currentNeighborhood.name);

    return events.filter(e => {
      // Filtro de Categoria
      if (activeType !== 'all' && e.type !== activeType) return false;

      // Lógica de Localização (Mesma do Feed)
      const center = userLocation || { lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude };
      if (e.latitude && e.longitude) {
        const dist = calculateDistance(center.lat, center.lng, Number(e.latitude), Number(e.longitude));
        if (dist <= 5) return true;
      }

      const loc = normalize(e.location);
      if (loc.includes(currentNBName)) return true;

      return false;
    });
  }, [events, activeType, currentNeighborhood, userLocation]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [filtered]);

  const handleCreate = async () => {
    if (!ft.trim() || !fdate || !floc.trim() || !fdesc.trim()) return;
    await addEvent({
      title: ft,
      description: fdesc,
      date: fdate,
      location: floc,
      type: ftype,
      latitude: fLat,
      longitude: fLng
    });
    setShowCreate(false); setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc('');
    setFLat(undefined); setFLng(undefined);
    toast('Evento publicado com sucesso!');
  };

  const handleDelete = useCallback((id: string) => { deleteEvent(id); setConfirmDeleteId(null); toast('Evento removido.', 'info'); }, [deleteEvent, toast]);

  const handleToggleAttendance = async (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    await toggleAttendance(eventId);
    toast('Presença atualizada!');
  };

  const openAttendees = async (id: string, title: string) => {
    setViewAttendeesTarget({ id, title });
    setLoadingAttendees(true);
    const data = await getEventAttendees(id);
    setCurrentAttendees(data);
    setLoadingAttendees(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Mural da Comunidade</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Feiras, campanhas, eventos e avisos do bairro Vitória Régia</p>
        </div>
        <button
          onClick={() => {
            fetchData();
            toast('Atualizando mural...', 'info');
          }}
          disabled={loading}
          className="mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
          aria-label="Atualizar mural"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filterTypes.map(t => {
            const count = typeCounts[t.id] ?? 0;
            return (
              <button key={t.id} onClick={() => setActiveType(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  activeType === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}>
                <span role="img" aria-hidden="true">{t.emoji}</span>{t.label}
                {count > 0 && <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none', activeType === t.id ? 'bg-white/20' : 'bg-slate-200/80 dark:bg-slate-700')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {sorted.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum evento no mural"
          description="Tem algo acontecendo no bairro? Compartilhe com toda a comunidade!"
          action={isAuthenticated ? { label: 'Publicar evento', onClick: () => setShowCreate(true) } : { label: 'Entrar para participar', onClick: () => navigate('/login') }} />
      ) : (
        <div className="space-y-3 stagger">
          {sorted.map(ev => {
            const et = evTypes[ev.type] ?? evTypes.outros;
            const isPast = new Date(ev.date + 'T23:59:59') < new Date();
            const canDelete = isMyEvent(ev);
            const isExpanded = expandedEvents.has(ev.id);
            const shouldShowReadMore = ev.description.length > 150;

            return (
              <Card key={ev.id} id={`ev-${ev.id}`} className={cn(isPast && 'opacity-60', 'animate-card-enter')}>
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <span role="img" aria-hidden="true">{et.emoji}</span>{et.label}
                        </span>
                        {canDelete && (
                          confirmDeleteId === ev.id ? (
                            <div className="flex items-center gap-1 animate-fade-in">
                              <button onClick={() => handleDelete(ev.id)} className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold transition-colors">Confirmar</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(ev.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all" aria-label="Excluir evento"><Trash2 className="w-3.5 h-3.5" /></button>
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed transition-all",
                        !isExpanded && "line-clamp-2"
                      )}>
                        {ev.description}
                      </p>
                      {shouldShowReadMore && (
                        <button
                          onClick={() => toggleExpand(ev.id)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline underline-offset-2"
                        >
                          {isExpanded ? "Ver menos" : "Ler descrição completa"}
                        </button>
                      )}
                    </div>
                    {ev.latitude && ev.longitude && (
                      <div className="mt-3">
                        <MapView lat={ev.latitude} lng={ev.longitude} title={ev.title} className="h-32 w-full rounded-lg overflow-hidden" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" />{ev.location}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"><Clock className="w-3 h-3" />{fmtDate(ev.date)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAttendees(ev.id, ev.title)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{ev.attendanceCount || 0}</span>
                        </button>

                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 !px-3 !text-[11px]"
                          onClick={() => handleToggleAttendance(ev.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Vou comparecer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isAuthenticated && (
        <button onClick={() => setShowCreate(true)} className="fixed bottom-28 md:bottom-8 right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center active:scale-95 group" aria-label="Publicar evento">
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Publicar Evento">
        <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Input label="Título do evento" placeholder="Ex: Feira de orgânicos" value={ft} onChange={e => setFt(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" options={evTypeOpts} value={ftype} onChange={e => setFtype(e.target.value as EventType)} required />
            <Input label="Data" type="date" value={fdate} onChange={e => setFdate(e.target.value)} required />
          </div>
          <Input label="Local" placeholder="Ex: Praça central do bairro" value={floc} onChange={e => setFloc(e.target.value)} required />
          <MapPicker onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); }} address={floc} />
          <Textarea label="Descrição" placeholder="Detalhes do evento, horário, como participar..." value={fdesc} onChange={e => setFdesc(e.target.value)} required />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!ft.trim() || !fdate || !floc.trim() || !fdesc.trim()}>Publicar</Button>
          </div>
        </form>
      </Modal>

      <ImageViewer
        src={zoomedImage || ''}
        open={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
      />

      {/* Modal de Confirmados */}
      <Modal
        open={!!viewAttendeesTarget}
        onClose={() => setViewAttendeesTarget(null)}
        title={`Confirmados: ${viewAttendeesTarget?.title}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {loadingAttendees ? (
            <div className="py-10 text-center text-slate-400">Carregando lista...</div>
          ) : currentAttendees.length === 0 ? (
            <div className="py-10 text-center text-slate-400 italic">Ninguém confirmou presença ainda.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {currentAttendees.map(attendee => (
                <Link
                  key={attendee.id}
                  to={`/perfil/${attendee.userId}`}
                  onClick={() => setViewAttendeesTarget(null)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all">
                    {attendee.userAvatarUrl ? (
                      <img src={attendee.userAvatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      attendee.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{attendee.userName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ver Perfil</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
