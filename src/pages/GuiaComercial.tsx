import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Search, Phone, MapPin, MessageCircle, Plus, Trash2, Star, MessageSquare, RefreshCw } from 'lucide-react';
import { EmptyState, Card, Modal, Input, Textarea, Select, Button, useToast, ImageViewer, timeAgo } from '../components/UI';
import MapView from '../components/MapView';
import MapPicker from '../components/MapPicker';
import { cn } from '../utils/cn';
import type { BusinessCategory, BusinessRating } from '../types';

function RatingStars({ rating, total, size = "w-3 h-3" }: { rating?: number; total?: number; size?: string }) {
  if (!rating) return <span className="text-[10px] text-slate-400 font-medium italic">Sem avaliações</span>;
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={cn(size, s <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-200 dark:text-slate-700")} />
        ))}
      </div>
      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{rating.toFixed(1)} ({total})</span>
    </div>
  );
}


const bizCat: Record<BusinessCategory, { label: string; emoji: string }> = {
  alimentacao: { label: 'Alimentação', emoji: '🍽️' }, saude: { label: 'Saúde', emoji: '❤️' },
  servicos: { label: 'Serviços', emoji: '🔧' }, educacao: { label: 'Educação', emoji: '📚' },
  comercio: { label: 'Comércio', emoji: '🛒' }, beleza: { label: 'Beleza', emoji: '💇' },
  outros: { label: 'Outros', emoji: '📌' },
};
const bizCatOpts = Object.entries(bizCat).map(([v, d]) => ({ value: v, label: `${d.emoji} ${d.label}` }));
const filterCats: { id: BusinessCategory | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'Todos', emoji: '🏪' },
  ...Object.entries(bizCat).map(([id, d]) => ({ id: id as BusinessCategory, ...d })),
];

export default function GuiaComercial() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { businesses, addBusiness, deleteBusiness, isMyBusiness, addBusinessRating, getBusinessRatings, fetchData, loading } = useData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<BusinessCategory | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [ratingTarget, setRatingTarget] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const [viewRatingsTarget, setViewRatingsTarget] = useState<{ id: string; name: string } | null>(null);
  const [currentRatings, setCurrentRatings] = useState<BusinessRating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);


  const [fn, setFn] = useState(''); const [fc, setFc] = useState<BusinessCategory>('servicos');
  const [fd, setFd] = useState(''); const [fph, setFph] = useState('');
  const [fwa, setFwa] = useState(''); const [fad, setFad] = useState('');
  const [fLat, setFLat] = useState<number | undefined>();
  const [fLng, setFLng] = useState<number | undefined>();
  const [fOpen, setFOpen] = useState('');
  const [fClose, setFClose] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [expandedBiz, setExpandedBiz] = useState<Set<string>>(new Set());

  // Category counts
  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: businesses.length };
    for (const b of businesses) c[b.category] = (c[b.category] ?? 0) + 1;
    return c;
  }, [businesses]);

  const toggleExpand = (id: string) => {
    setExpandedBiz(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = businesses.filter(b => {
    if (activeCat !== 'all' && b.category !== activeCat) return false;
    if (search) { const q = search.toLowerCase(); return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q); }
    return true;
  });

  const handleCreate = () => {
    if (!fn.trim() || !fd.trim()) return;
    addBusiness({
      name: fn,
      description: fd,
      category: fc,
      phone: fph || undefined,
      whatsapp: fwa || undefined,
      address: fad || undefined,
      openTime: fOpen || undefined,
      closeTime: fClose || undefined,
      latitude: fLat,
      longitude: fLng
    });
    setShowCreate(false); setFn(''); setFc('servicos'); setFd(''); setFph(''); setFwa(''); setFad('');
    setFOpen(''); setFClose('');
    setFLat(undefined); setFLng(undefined);
    toast('Negócio cadastrado com sucesso!');
  };

  const handleDelete = useCallback((id: string) => { deleteBusiness(id); setConfirmDeleteId(null); toast('Negócio removido.', 'info'); }, [deleteBusiness, toast]);

  const handleRating = async () => {
    if (!ratingTarget || !isAuthenticated) return;
    setIsSubmittingRating(true);
    try {
      await addBusinessRating({ businessId: ratingTarget, stars, comment });
      setRatingTarget(null);
      setStars(5);
      setComment('');
      toast('Sua avaliação foi salva! Se você já tinha avaliado, ela foi atualizada.');
    } catch (error) {
      toast('Erro ao enviar avaliação.', 'error');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const openRatings = async (id: string, name: string) => {
    setViewRatingsTarget({ id, name });
    setLoadingRatings(true);
    try {
      const data = await getBusinessRatings(id);
      setCurrentRatings(data);
    } catch (error) {
      toast('Erro ao carregar avaliações.', 'error');
    } finally {
      setLoadingRatings(false);
    }
  };

  const fmtPhone = (p: string) => p.replace(/\D/g, '');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Guia Comercial</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Descubra negócios e serviços locais no Vitória Régia</p>
        </div>
        <button
          onClick={() => {
            fetchData();
            toast('Atualizando guia...', 'info');
          }}
          disabled={loading}
          className="mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
          aria-label="Atualizar guia"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="search" placeholder="Buscar por nome ou serviço..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" aria-label="Buscar negócios" />
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filterCats.map(c => {
            const count = catCounts[c.id] ?? 0;
            return (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  activeCat === c.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}>
                <span role="img" aria-hidden="true">{c.emoji}</span>{c.label}
                {count > 0 && <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none', activeCat === c.id ? 'bg-white/20' : 'bg-slate-200/80 dark:bg-slate-700')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} title="Nenhum comércio cadastrado"
          description="Conhece um negócio local? Ajude a divulgar os serviços do bairro para toda a comunidade!"
          action={isAuthenticated ? { label: 'Cadastrar negócio', onClick: () => setShowCreate(true) } : { label: 'Entrar para participar', onClick: () => navigate('/login') }} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 stagger">
          {filtered.map(b => {
            const cat = bizCat[b.category] ?? bizCat.outros;
            const canDelete = isMyBusiness(b);
            const isExpanded = expandedBiz.has(b.id);
            const shouldShowReadMore = b.description.length > 120;

            const isOpen = () => {
              if (!b.open_time || !b.close_time) return null;
              const now = new Date();
              const currentTime = now.getHours() * 60 + now.getMinutes();
              const [hOpen, mOpen] = b.open_time.split(':').map(Number);
              const [hClose, mClose] = b.close_time.split(':').map(Number);
              const openTotal = hOpen * 60 + mOpen;
              const closeTotal = hClose * 60 + mClose;

              if (closeTotal > openTotal) {
                return currentTime >= openTotal && currentTime < closeTotal;
              } else {
                // Caso feche após meia-noite
                return currentTime >= openTotal || currentTime < closeTotal;
              }
            };

            const openStatus = isOpen();

            return (
              <Card key={b.id} id={`biz-${b.id}`} className="animate-card-enter">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 text-xl">{cat.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{b.name}</h3>
                      {openStatus !== null && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                          openStatus ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        )}>
                          {openStatus ? "Aberto" : "Fechado"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{cat.label}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <RatingStars rating={b.avgRating} total={b.totalRatings} />
                    </div>
                  </div>
                  {canDelete && (
                    confirmDeleteId === b.id ? (
                      <div className="flex items-center gap-1 animate-fade-in shrink-0">
                        <button onClick={() => handleDelete(b.id)} className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors">Confirmar</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(b.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all shrink-0" aria-label="Excluir negócio"><Trash2 className="w-4 h-4" /></button>
                    )
                  )}
                </div>
                <div>
                  <p className={cn(
                    "text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed transition-all",
                    !isExpanded && "line-clamp-3"
                  )}>
                    {b.description}
                  </p>
                  {shouldShowReadMore && (
                    <button
                      onClick={() => toggleExpand(b.id)}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline underline-offset-2"
                    >
                      {isExpanded ? "Ver menos" : "Ler descrição completa"}
                    </button>
                  )}
                </div>
                {b.imageUrl && (
                  <div
                    className="mt-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity"
                    onClick={() => setZoomedImage(b.imageUrl!)}
                  >
                    <img src={b.imageUrl} alt="" className="w-full max-h-48 object-cover" loading="lazy" />
                  </div>
                )}
                {b.latitude && b.longitude && (
                  <div className="mt-3">
                    <MapView lat={b.latitude} lng={b.longitude} title={b.name} className="h-32 w-full rounded-lg overflow-hidden" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {b.phone && <a href={`tel:${fmtPhone(b.phone)}`} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 active:scale-95 transition-all"><Phone className="w-4 h-4" />Ligar</a>}
                  {b.whatsapp && <a href={`https://wa.me/55${fmtPhone(b.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 active:scale-95 transition-all"><MessageCircle className="w-4 h-4" />WhatsApp</a>}
                </div>
                {b.address && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg"><MapPin className="w-3 h-3 shrink-0" />{b.address}</div>}

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  <button
                    onClick={() => isAuthenticated ? setRatingTarget(b.id) : navigate('/login')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-400/5 text-xs font-bold text-yellow-700 dark:text-yellow-400 active:scale-95 transition-all"
                  >
                    <Star className="w-4 h-4 fill-current" /> Avaliar
                  </button>
                  <button
                    onClick={() => openRatings(b.id, b.name)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" /> Opiniões
                  </button>
                </div>
                {b.createdBy && b.createdBy !== 'anonymous' && (
                  <div className="mt-2 flex justify-end">
                    <Link to={`/perfil/${b.createdBy}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline">
                      Ver Dono <Plus className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {isAuthenticated && (
        <button onClick={() => setShowCreate(true)} className="fixed bottom-28 md:bottom-8 right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center active:scale-95 group" aria-label="Cadastrar negócio">
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Cadastrar Negócio">
        <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Input label="Nome do negócio" placeholder="Ex: Padaria do Seu João" value={fn} onChange={e => setFn(e.target.value)} required />
          <Select label="Categoria" options={bizCatOpts} value={fc} onChange={e => setFc(e.target.value as BusinessCategory)} required />
          <Textarea label="Descrição" placeholder="Descreva os serviços oferecidos..." value={fd} onChange={e => setFd(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Horário Abertura" type="time" value={fOpen} onChange={e => setFOpen(e.target.value)} />
            <Input label="Horário Fechamento" type="time" value={fClose} onChange={e => setFClose(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" placeholder="(41) 99999-9999" value={fph} onChange={e => setFph(e.target.value)} />
            <Input label="WhatsApp" placeholder="(41) 99999-9999" value={fwa} onChange={e => setFwa(e.target.value)} />
          </div>
          <Input label="Endereço" placeholder="Rua, número - Bairro" value={fad} onChange={e => setFad(e.target.value)} />
          <MapPicker onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); }} address={fad} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!fn.trim() || !fd.trim()}>Cadastrar</Button>
          </div>
        </form>
      </Modal>

      <ImageViewer
        src={zoomedImage || ''}
        open={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
      />

      {/* Modal de Avaliação */}
      <Modal open={!!ratingTarget} onClose={() => setRatingTarget(null)} title="Avaliar Negócio">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setStars(s)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star className={cn("w-10 h-10 transition-colors", s <= stars ? "fill-yellow-400 text-yellow-400" : "text-slate-200 dark:text-slate-700")} />
                </button>
              ))}
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {stars === 1 ? 'Péssimo' : stars === 2 ? 'Ruim' : stars === 3 ? 'Regular' : stars === 4 ? 'Bom' : 'Excelente!'}
            </span>
          </div>

          <Textarea
            label="Sua opinião (opcional)"
            placeholder="Conte aos vizinhos o que achou deste serviço..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setRatingTarget(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleRating} disabled={isSubmittingRating}>
              {isSubmittingRating ? 'Enviando...' : 'Publicar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Lista de Avaliações */}
      <Modal
        open={!!viewRatingsTarget}
        onClose={() => setViewRatingsTarget(null)}
        title={`Avaliações: ${viewRatingsTarget?.name}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {loadingRatings ? (
            <div className="py-10 text-center text-slate-400">Carregando avaliações...</div>
          ) : currentRatings.length === 0 ? (
            <div className="py-10 text-center text-slate-400 italic">Ninguém avaliou este negócio ainda. Seja o primeiro!</div>
          ) : (
            currentRatings.map(r => (
              <div key={r.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {r.userAvatarUrl ? <img src={r.userAvatarUrl} className="w-full h-full object-cover" /> : r.userName?.charAt(0)}
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">{r.userName}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="flex gap-0.5 mb-1.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={cn("w-3 h-3", s <= r.stars ? "fill-yellow-400 text-yellow-400" : "text-slate-200 dark:text-slate-700")} />
                  ))}
                </div>
                {r.comment && <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{r.comment}"</p>}
              </div>
            ))
          )}
        </div>
      </Modal>

    </div>
  );
}
