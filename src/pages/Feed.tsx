import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNeighborhood, curitibaNeighborhoods } from '../contexts/NeighborhoodContext';
import {
  Plus, Filter, ChevronDown, Heart, MessageSquare,
  MapPin, ShieldAlert, AlertTriangle, Lightbulb, Zap,
  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw,
} from 'lucide-react';
import {
  EmptyState, Card, Modal, Input, Textarea, Select, Button,
  StatusBadge, CategoryBadge, postCategories, timeAgo, ImageUpload, useToast,
  ImageViewer,
} from '../components/UI';
import MapView from '../components/MapView';
import MapPicker from '../components/MapPicker';
import { cn } from '../utils/cn';
import type { PostCategory, PostStatus, Comment } from '../types';

const catIcons: Record<string, typeof AlertTriangle> = {
  buraco: AlertTriangle, iluminacao: Lightbulb, fios: Zap,
  limpeza: Trash2, transporte: Bus, seguranca: Shield, outros: HelpCircle,
};
const statusOpts: { id: PostStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'pending', label: 'Pendente' },
  { id: 'in_progress', label: 'Em andamento' }, { id: 'resolved', label: 'Resolvido' },
];
const catOpts = Object.entries(postCategories).map(([v, d]) => ({ value: v, label: `${d.emoji} ${d.label}` }));

function CommentItem({ comment, replies, onReply, replyingTo, onDelete, onReport, currentUser, isPostOwner }: {
  comment: Comment; replies: Comment[]; onReply: (c: Comment) => void; replyingTo: string | null; onDelete: (id: string) => void; onReport: (id: string) => void; currentUser: any; isPostOwner: boolean;
}) {
  const isAuthor = currentUser?.id === comment.authorId;
  const isAdmin = currentUser?.id === '88157980-94d3-49cb-84bf-e8841f1799f8';

  return (
    <div className={cn('group', comment.parentId && 'ml-8 border-l-2 border-slate-100 dark:border-slate-800 pl-3')}>
      <div className="flex items-start gap-2.5">
        <Link to={`/perfil/${comment.authorId}`} className="shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400 ring-1 ring-transparent hover:ring-emerald-500/30 transition-all">
            {comment.authorAvatarUrl ? (
              <img src={comment.authorAvatarUrl} alt={comment.authorName} className="w-full h-full object-cover" />
            ) : (
              comment.authorName.charAt(0).toUpperCase()
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/perfil/${comment.authorId}`} className="text-xs font-semibold text-slate-900 dark:text-white hover:text-emerald-600 transition-colors">
              {comment.authorName}
            </Link>
            <span className="text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed whitespace-pre-line break-words">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => onReply(comment)}
              className={cn('text-[11px] font-semibold transition-colors',
                replyingTo === comment.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400')}>
              Responder
            </button>
            <button onClick={() => onReport(comment.id)}
              className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors">
              Denunciar
            </button>
            {showDelete && (
              <button onClick={() => onDelete(comment.id)} className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors">
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map(r => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              onReply={onReply}
              replyingTo={replyingTo}
              onDelete={onDelete}
              onReport={onReport}
              currentUser={currentUser}
              isPostOwner={isPostOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Feed ──────────────────────────────────────────────
export default function Feed() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { posts, addPost, supportPost, addComment, deleteComment, deletePost, updatePostStatus, isMyPost, commentsByPost, reportContent, fetchData, loading } = useData();
  const { currentNeighborhood, setNeighborhoodByCep } = useNeighborhood();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [showReport, setShowReport] = useState<{ postId?: string; commentId?: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [activeCategory, setActiveCategory] = useState<PostCategory | null>(null);
  const [activeStatus, setActiveStatus] = useState<PostStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [supported, setSupported] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem('anb-supported') || '[]')); }
    catch { return new Set<string>(); }
  });
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({});
  const [heartsAnimating, setHeartsAnimating] = useState<Set<string>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const [ft, setFt] = useState('');
  const [fc, setFc] = useState<PostCategory>('buraco');
  const [fl, setFl] = useState('');
  const [fLat, setFLat] = useState<number | undefined>();
  const [fLng, setFLng] = useState<number | undefined>();
  const [fd, setFd] = useState('');
  const [fi, setFi] = useState('');

  // Sincroniza a localização virtual sempre que o bairro mudar
  useEffect(() => {
    if (currentNeighborhood) {
      setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude });
    }
  }, [currentNeighborhood]);

  const toggleDescription = useCallback((postId: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  // ─── Status counts ───────────────────────────────────
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [posts]);

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

  // ─── Memoized filtering ─────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const normalize = (s: string) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const currentNBName = normalize(currentNeighborhood.name);

    return posts.filter(p => {
      // 1. Filtros Globais (Categoria e Status)
      if (activeCategory && p.category !== activeCategory) return false;
      if (activeStatus !== 'all' && p.status !== activeStatus) return false;

      // 2. Filtro de Autor
      if (onlyMine && user && p.authorId !== user.id) return false;
      if (onlyMine && !user) return false;

      // 3. LOGICA DE LOCALIZAÇÃO (Busca Têxtil ou Bairro Atual)
      if (q) {
        return normalize(p.title).includes(q) ||
               normalize(p.description).includes(q) ||
               normalize(p.location).includes(q) ||
               normalize(p.authorName).includes(q);
      }

      // AGORA RESPEITA O BAIRRO (MESMO SENDO ANÔNIMO)
      // Prioridade 1: Geográfica (Raio de 5km)
      const center = userLocation || { lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude };
      if (p.latitude && p.longitude) {
        const dist = calculateDistance(center.lat, center.lng, Number(p.latitude), Number(p.longitude));
        if (dist <= 5) return true;
      }

      // Prioridade 2: Nome do bairro
      const postLoc = normalize(p.location);
      if (postLoc.includes(currentNBName)) return true;

      return false;
    });
  }, [posts, activeCategory, activeStatus, searchQuery, onlyMine, nearMe, userLocation, user, currentNeighborhood]);

  const toggleNearMe = useCallback(async () => {
    if (!nearMe) {
      toast('Obtendo sua localização GPS...', 'info');

      if (!navigator.geolocation) {
        toast('Navegador sem suporte a GPS. Usando localização do bairro.', 'warning');
        setNearMe(true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setNearMe(true);
          toast('Localização GPS obtida!');
        },
        (err) => {
          console.error('Geolocation Error:', err);
          toast('GPS falhou. Usando localização do bairro.', 'warning');
          setNearMe(true);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      setNearMe(false);
      // Reseta para a localização do bairro quando desativa o "Perto de mim"
      setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude });
    }
  }, [nearMe, currentNeighborhood, toast]);

  // ─── Handlers ────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (!ft.trim() || !fd.trim() || !fl.trim()) return;
    addPost({
      title: ft,
      description: fd,
      category: fc,
      location: fl,
      imageUrl: fi || undefined,
      latitude: fLat,
      longitude: fLng
    });
    setShowCreate(false);
    setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi('');
    setFLat(undefined); setFLng(undefined);
    toast('Relato publicado com sucesso!');
  }, [ft, fd, fl, fc, fi, fLat, fLng, addPost, toast]);

  const handlePostCepSearch = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFl(data.logradouro);
          toast('Rua localizada pelo CEP!');
        }
      } catch {}
    }
  };

  const handleSupport = useCallback((id: string) => {
    const isSupported = supported.has(id);
    supportPost(id);

    const next = new Set(supported);
    if (isSupported) {
      next.delete(id);
    } else {
      next.add(id);
      setHeartsAnimating(prev => { const n = new Set(prev); n.add(id); return n; });
      setTimeout(() => setHeartsAnimating(prev => { const n = new Set(prev); n.delete(id); return n; }), 500);
    }

    setSupported(next);
    try { localStorage.setItem('anb-supported', JSON.stringify([...next])); } catch {}
  }, [supported, supportPost]);

  const toggleComments = useCallback((postId: string) => {
    setExpandedPosts(prev => { const n = new Set(prev); n.has(postId) ? n.delete(postId) : n.add(postId); return n; });
  }, []);

  const handleSubmitComment = useCallback((postId: string) => {
    const text = (commentTexts[postId] ?? '').trim();
    if (!text || !user) return;
    addComment(postId, text, replyingTo[postId] ?? undefined);
    setCommentTexts(prev => ({ ...prev, [postId]: '' }));
    setReplyingTo(prev => ({ ...prev, [postId]: null }));
    toast('Comentário adicionado!');
  }, [commentTexts, replyingTo, user, addComment, toast]);

  const handleReplyClick = useCallback((postId: string, comment: Comment) => {
    setReplyingTo(prev => ({ ...prev, [postId]: prev[postId] === comment.id ? null : comment.id }));
  }, []);

  const handleDeletePost = useCallback((postId: string) => {
    deletePost(postId); setConfirmDeleteId(null); toast('Relato excluído.', 'info');
  }, [deletePost, toast]);

  const handleDeleteComment = useCallback((commentId: string) => {
    deleteComment(commentId);
    toast('Comentário excluído.', 'info');
  }, [deleteComment, toast]);

  const handleStatusChange = useCallback((postId: string, status: PostStatus) => {
    updatePostStatus(postId, status);
    const labels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido' };
    toast(`Status atualizado para "${labels[status]}".`);
  }, [updatePostStatus, toast]);

  const handleSendReport = async () => {
    if (!reportReason.trim()) return;
    const finalReason = reportDetail.trim()
      ? `${reportReason}: ${reportDetail}`
      : reportReason;

    await reportContent({ ...showReport, reason: finalReason });
    setShowReport(null);
    setReportReason('');
    setReportDetail('');
    toast('Denúncia enviada para análise do administrador.');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Relatos Comunitários</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bairro atual: <strong className="text-emerald-600 dark:text-emerald-400">{currentNeighborhood.name}</strong>
          </p>
        </div>
        <button
          onClick={() => {
            fetchData();
            toast('Atualizando relatos...', 'info');
          }}
          disabled={loading}
          className="mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
          aria-label="Atualizar relatos"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      {isAuthenticated && user && posts.length === 0 && (
        <Card className="!bg-gradient-to-br !from-emerald-50 !to-teal-50 dark:!from-emerald-500/5 dark:!to-teal-500/5 !ring-emerald-200 dark:!ring-emerald-500/20 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-2xl" role="img" aria-hidden="true">👋</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Olá, {user.name.split(' ')[0]}! Bem-vindo ao bairro.</h3>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/60 mt-1 leading-relaxed">
                Este é o espaço onde moradores se unem para melhorar o bairro {currentNeighborhood.name}. Crie seu primeiro relato! 🌿
              </p>
              <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
                <Sparkles className="w-3.5 h-3.5" /> Criar meu primeiro relato
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título ou digite um CEP para trocar de bairro..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const clean = searchQuery.replace(/\D/g, '');
                if (clean.length === 8) {
                  toast('Buscando CEP...', 'info');

                  try {
                    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
                    const data = await res.json();

                    if (!data.erro) {
                      const ok = await setNeighborhoodByCep(clean);
                      if (ok) {
                        toast('Bairro localizado: ' + data.bairro);
                        setSearchQuery('');
                      }
                    } else {
                      toast('CEP não encontrado.', 'error');
                    }
                  } catch (error) {
                    toast('Erro ao buscar CEP.', 'error');
                  }
                }
              }
            }}
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            aria-label="Buscar relatos ou mudar CEP"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1" role="tablist">
            {statusOpts.map(s => {
              const count = statusCounts[s.id] ?? 0;
              return (
                <button key={s.id} role="tab" aria-selected={activeStatus === s.id} onClick={() => setActiveStatus(s.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                    activeStatus === s.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}>
                  {s.label}
                  {count > 0 && <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none', activeStatus === s.id ? 'bg-white/20' : 'bg-slate-200/80 dark:bg-slate-700')}>{count}</span>}
                </button>
              );
            })}
          </div>
          {isAuthenticated && (
            <button onClick={() => setOnlyMine(!onlyMine)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
                onlyMine ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}
              aria-pressed={onlyMine} title="Mostrar apenas meus relatos">
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Meus</span>
            </button>
          )}

          <button onClick={toggleNearMe}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
              nearMe ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}
            aria-pressed={nearMe} title="Mostrar relatos perto de mim">
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Perto de mim</span>
          </button>

          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
              showFilters ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400')}>
            <Filter className="w-3.5 h-3.5" /><span className="hidden sm:inline">Categorias</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {Object.entries(postCategories).map(([key, def]) => {
              const Icon = catIcons[key] ?? HelpCircle;
              return (
                <button key={key} onClick={() => setActiveCategory(activeCategory === key ? null : key as PostCategory)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    activeCategory === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')}>
                  <Icon className="w-3.5 h-3.5" />{def.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare}
          title={searchQuery ? 'Nenhum resultado encontrado' : 'Nenhum relato por enquanto'}
          description={searchQuery ? `Nenhum relato corresponde a "${searchQuery}".` : `Seja o primeiro a registrar um problema no bairro ${currentNeighborhood.name}!`}
          action={searchQuery ? { label: 'Limpar busca', onClick: () => setSearchQuery('') }
            : isAuthenticated ? { label: 'Criar relato', onClick: () => setShowCreate(true) }
            : { label: 'Entrar para participar', onClick: () => navigate('/login') }} />
      ) : (
        <>
          {searchQuery && <p className="text-xs text-slate-400 -mt-2">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{searchQuery}"</p>}
          <div className="space-y-3 stagger">
            {filtered.map(post => {
              const isAnon = post.authorId === 'anonymous';
              const isExpanded = expandedPosts.has(post.id);
              const isDescriptionExpanded = expandedDescriptions.has(post.id);
              const shouldShowReadMore = post.description.length > 200;
              const postComments = commentsByPost[post.id] ?? [];
              const rootComments = postComments.filter((c: Comment) => !c.parentId);
              const curReply = replyingTo[post.id] ?? null;
              const replyTarget = curReply ? postComments.find((c: Comment) => c.id === curReply) : null;

              return (
                <Card key={post.id} id={`post-${post.id}`} className={cn(
                  isAnon && 'ring-red-200 dark:ring-red-500/20',
                  'animate-card-enter active:scale-[0.99] md:active:scale-100 transition-transform'
                )}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isAnon ? (
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                      ) : (
                        <Link to={`/perfil/${post.authorId}`} className="relative group shrink-0">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all">
                            {post.authorAvatarUrl ? (
                              <img src={post.authorAvatarUrl} alt={post.authorName} className="w-full h-full object-cover" />
                            ) : (
                              post.authorName.charAt(0).toUpperCase()
                            )}
                          </div>
                        </Link>
                      )}
                      <div className="min-w-0 flex-1">
                        {isAnon ? (
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">{post.authorName}</p>
                        ) : (
                          <Link to={`/perfil/${post.authorId}`} className="text-sm font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block">
                            {post.authorName}
                          </Link>
                        )}
                        <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
                      </div>
                    </div>

                    <StatusBadge status={post.status} />
                    {isMyPost(post) && (
                      confirmDeleteId === post.id ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <button onClick={() => handleDeletePost(post.id)} className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors">Confirmar</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(post.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all" aria-label="Excluir relato"><Trash2 className="w-4 h-4" /></button>
                      )
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{post.title}</h3>
                  <div className="relative">
                    <p className={cn(
                      "text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line break-words transition-all",
                      !isDescriptionExpanded && "line-clamp-4"
                    )}>
                      {post.description}
                    </p>
                    {shouldShowReadMore && (
                      <button
                        onClick={() => toggleDescription(post.id)}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline underline-offset-2"
                      >
                        {isDescriptionExpanded ? "Ver menos" : "Ler descrição completa"}
                      </button>
                    )}
                  </div>
                  {post.imageUrl && (
                    <div
                      className="mt-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setZoomedImage(post.imageUrl!)}
                    >
                      <img src={post.imageUrl} alt="" className="w-full max-h-72 object-cover" loading="lazy" />
                    </div>
                  )}
                  {post.latitude && post.longitude && (
                    <div className="mt-3">
                      <MapView lat={post.latitude} lng={post.longitude} title={post.title} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <CategoryBadge category={post.category} />
                    {post.location && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" />{post.location}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => handleSupport(post.id)}
                      className={cn('flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95',
                        supported.has(post.id) ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400')}
                      aria-label="Apoiar">
                      <Heart className={cn('w-4 h-4', supported.has(post.id) && 'fill-current', heartsAnimating.has(post.id) && 'animate-heart-pop')} />
                      <span>{post.supports > 0 ? post.supports : ''} Apoio{post.supports !== 1 ? 's' : ''}</span>
                    </button>
                    <button onClick={() => toggleComments(post.id)}
                      className={cn('flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95',
                        isExpanded ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400')}
                      aria-expanded={isExpanded}>
                      <MessageSquare className="w-4 h-4" />
                      <span>{postComments.length > 0 ? postComments.length : ''} Comentário{postComments.length !== 1 ? 's' : ''}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setShowReport({ postId: post.id })}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 active:bg-red-50 dark:active:bg-red-500/10 transition-all"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Denunciar
                    </button>

                    {isMyPost(post) && (
                      <div className="flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar pb-1">
                        {post.status !== 'pending' && (
                          <button onClick={() => handleStatusChange(post.id, 'pending')}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 active:scale-95 transition-all">
                            Pendente
                          </button>
                        )}
                        {post.status !== 'in_progress' && (
                          <button onClick={() => handleStatusChange(post.id, 'in_progress')}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 ring-1 ring-blue-200 dark:ring-blue-500/20 transition-all">
                            Em andamento
                          </button>
                        )}
                        {post.status !== 'resolved' && (
                          <button onClick={() => handleStatusChange(post.id, 'resolved')}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 ring-1 ring-blue-200 dark:ring-blue-500/20 transition-all">
                            Resolvido
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-fade-in">
                      {rootComments.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p>
                      ) : (
                        <div className="space-y-3">
                              {rootComments.map((rc: Comment) => {
                            const replies = postComments.filter((c: Comment) => c.parentId === rc.id);
                            return <CommentItem
                              key={rc.id}
                              comment={rc}
                              replies={replies}
                              onReply={(c) => handleReplyClick(post.id, c)}
                              replyingTo={curReply}
                              onDelete={handleDeleteComment}
                              onReport={(id) => setShowReport({ commentId: id })}
                              currentUser={user}
                              isPostOwner={user?.id === post.authorId}
                            />;
                          })}
                        </div>
                      )}
                      {curReply && replyTarget && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400 animate-slide-down">
                          <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Respondendo a <strong>{replyTarget.authorName}</strong></span>
                          <button onClick={() => setReplyingTo(prev => ({ ...prev, [post.id]: null }))} className="ml-auto p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors" aria-label="Cancelar resposta"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      {isAuthenticated ? (
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                            {user?.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 relative">
                            <textarea value={commentTexts[post.id] ?? ''} onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(post.id); } }}
                              placeholder={curReply ? `Responder a ${replyTarget?.authorName ?? ''}...` : 'Escreva um comentário...'} rows={2}
                              className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none" />
                            <button onClick={() => handleSubmitComment(post.id)}
                              disabled={!(commentTexts[post.id] ?? '').trim()}
                              className={cn('absolute right-2 bottom-2 p-1.5 rounded-lg transition-all',
                                (commentTexts[post.id] ?? '').trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'text-slate-300 dark:text-slate-600')}
                              aria-label="Enviar">
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => navigate('/login')} className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-400 hover:text-emerald-600 hover:border-emerald-300 dark:hover:text-emerald-400 transition-colors">
                          Entre na sua conta para comentar
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {isAuthenticated && (
        <button onClick={() => setShowCreate(true)}
          className="fixed bottom-28 md:bottom-8 right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center active:scale-95 group" aria-label="Criar novo relato">
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Relato">
        <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Input label="Título" placeholder="Ex: Buraco na Rua das Flores" value={ft} onChange={e => setFt(e.target.value)} required />
          <Select label="Categoria" options={catOpts} value={fc} onChange={e => setFc(e.target.value as PostCategory)} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Localização (Rua/Bairro)" placeholder="Ex: Rua das Flores, 123" value={fl} onChange={e => setFl(e.target.value)} required />
            <Input
              label="Buscar por CEP"
              placeholder="Ex: 81460296"
              maxLength={8}
              onChange={e => handlePostCepSearch(e.target.value)}
            />
          </div>

          <MapPicker onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); }} address={fl} />
          <Textarea label="Descrição" placeholder="Descreva o problema com detalhes..." value={fd} onChange={e => setFd(e.target.value)} required />
          <ImageUpload value={fi} onChange={setFi} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!ft.trim() || !fd.trim() || !fl.trim()}>Publicar relato</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showReport} onClose={() => setShowReport(null)} title="Denunciar Conteúdo">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Ajude-nos a manter o bairro seguro. Por que você está denunciando este conteúdo?</p>
          <Select
            label="Categoria da Denúncia"
            options={[
              { value: '', label: 'Selecione uma categoria...' },
              { value: 'Conteúdo ofensivo ou ódio', label: 'Conteúdo ofensivo ou ódio' },
              { value: 'Informação falsa (Spam)', label: 'Informação falsa (Spam)' },
              { value: 'Assédio ou perseguição', label: 'Assédio ou perseguição' },
              { value: 'Conteúdo inadequado ou ilegal', label: 'Conteúdo inadequado ou ilegal' },
              { value: 'Outros', label: 'Outros' },
            ]}
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
          />
          <Textarea
            label="Detalhes da denúncia (opcional)"
            placeholder="Descreva melhor o problema para ajudar o administrador..."
            value={reportDetail}
            onChange={e => setReportDetail(e.target.value)}
            rows={3}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowReport(null)}>Cancelar</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleSendReport} disabled={!reportReason}>Enviar Denúncia</Button>
          </div>
        </div>
      </Modal>

      <ImageViewer
        src={zoomedImage || ''}
        open={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
      />
    </div>
  );
}
