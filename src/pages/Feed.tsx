import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  useNeighborhood, neighborhoodMatches, neighborhoodSearchText, normalizeNeighborhoodText,
} from '../contexts/NeighborhoodContext';
import {
  Plus, Filter, ChevronDown, Heart, MessageSquare,
  MapPin, ShieldAlert, AlertTriangle, Lightbulb, Zap,
  Trash2, Bus, Shield, HelpCircle, Droplets, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase, Bookmark, LocateFixed,
} from 'lucide-react';
import {
  EmptyState, Card, Modal, Input, Textarea, Select, Button,
  StatusBadge, CategoryBadge, postCategories, timeAgo, ImageUpload, useToast,
  ImageViewer,
} from '../components/UI';
import MapPicker from '../components/MapPicker';
import { cn } from '../utils/cn';
import { supabase } from '../utils/supabase';
import { postShareUrl, shareContent } from '../utils/share';
import { useSavedItems } from '../hooks/useSavedItems';
import { clearLocalDraft, readLocalDraft, saveLocalDraft } from '../utils/localDrafts';
import type { PostCategory, PostStatus, Comment, OfficialProtocolStatus, SimilarPost } from '../types';
import PublicServiceContact from '../components/PublicServiceContact';
import { getPublicServiceContact } from '../utils/publicServices';

const catIcons: Record<string, typeof AlertTriangle> = {
  buraco: AlertTriangle, iluminacao: Lightbulb, fios: Zap,
  saneamento: Droplets, limpeza: Trash2, transporte: Bus, seguranca: Shield, outros: HelpCircle,
};
const statusOpts: { id: PostStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'pending', label: 'Aberto' },
  { id: 'in_progress', label: 'Em andamento' }, { id: 'resolved', label: 'Resolvido' },
];
const catOpts = Object.entries(postCategories).map(([v, d]) => ({ value: v, label: `${d.emoji} ${d.label}` }));
const CREATE_POST_INTENT_KEY = 'nmb-after-login-action';
const FEED_RENDER_BATCH = 20;

type NeighborhoodWeeklySummary = {
  area: string;
  newReports: number;
  previousReports: number;
  resolvedReports: number;
  upcomingEvents: number;
  newJobs: number;
  topCategory?: PostCategory | null;
  topCategoryCount: number;
  updatedAt?: string;
};

function CommentItem({ comment, replies, allComments, onReply, replyingTo, onDelete, onReport, currentUser, isPostOwner }: {
  comment: Comment; replies: Comment[]; allComments: Comment[]; onReply: (c: Comment) => void; replyingTo: string | null; onDelete: (id: string) => void; onReport: (id: string) => void; currentUser: any; isPostOwner: boolean;
}) {
  const isAuthor = currentUser?.id === comment.authorId;
  return (
    <div className={cn('group', comment.parentId && 'ml-8 border-l-2 border-slate-100 dark:border-slate-800 pl-3')}>
      <div className="flex items-start gap-2.5">
        <Link to={`/perfil/${comment.authorId}`} className="shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400 ring-1 ring-transparent hover:ring-emerald-500/30 transition-all">
            {comment.authorAvatarUrl ? <img src={comment.authorAvatarUrl} alt={comment.authorName} className="w-full h-full object-cover" /> : comment.authorName.charAt(0).toUpperCase()}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><Link to={`/perfil/${comment.authorId}`} className="text-xs font-semibold text-slate-900 dark:text-white hover:text-emerald-600 transition-colors">{comment.authorName}</Link><span className="text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span></div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed whitespace-pre-line break-words">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => onReply(comment)} className={cn('text-[11px] font-semibold transition-colors', replyingTo === comment.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400')}>Responder</button>
            <button onClick={() => onReport(comment.id)} className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors">Denunciar</button>
            {(isAuthor || isPostOwner) && <button onClick={() => onDelete(comment.id)} className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors">Excluir</button>}
          </div>
        </div>
      </div>
      {replies.length > 0 && <div className="mt-2 space-y-2">{replies.map(r => <CommentItem key={r.id} comment={r} replies={allComments.filter((child: Comment) => child.parentId === r.id)} allComments={allComments} onReply={onReply} replyingTo={replyingTo} onDelete={onDelete} onReport={onReport} currentUser={currentUser} isPostOwner={isPostOwner} />)}</div>}
    </div>
  );
}

export default function Feed() {
  const { user, isAuthenticated, canModerate } = useAuth();
  const navigate = useNavigate();
  const { posts, addPost, supportPost, addComment, deleteComment, deletePost, updatePostStatus, isMyPost, commentsByPost, reportContent, fetchData, loading } = useData();
  const { currentNeighborhood, isNeighborhoodSelected, setNeighborhoodByCep } = useNeighborhood();
  const { toast } = useToast();
  const { isSaved: isPostSaved, toggleSaved: toggleSavedPost } = useSavedItems('post');

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
  const [nearRadius, setNearRadius] = useState<1 | 3 | 5 | 10>(5);
  const [sortMode, setSortMode] = useState<'recent' | 'supported' | 'discussed' | 'nearest'>('recent');
  const [onlyWithImage, setOnlyWithImage] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [supported, setSupported] = useState<Set<string>>(() => { try { return new Set<string>(JSON.parse(localStorage.getItem('anb-supported') || '[]')); } catch { return new Set<string>(); } });
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
  const [fOfficialProtocol, setFOfficialProtocol] = useState('');
  const [fOfficialStatus, setFOfficialStatus] = useState<OfficialProtocolStatus>('submitted');
  const [similarPosts, setSimilarPosts] = useState<SimilarPost[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);
  const [isFollowingNeighborhood, setIsFollowingNeighborhood] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [neighborhoodSummary, setNeighborhoodSummary] = useState<NeighborhoodWeeklySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [postDraftReady, setPostDraftReady] = useState(false);
  const [postDraftRestored, setPostDraftRestored] = useState(false);
  const [renderLimit, setRenderLimit] = useState(FEED_RENDER_BATCH);

  useEffect(() => { if (currentNeighborhood) setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude }); }, [currentNeighborhood]);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      if (sessionStorage.getItem(CREATE_POST_INTENT_KEY) === 'create-post') {
        sessionStorage.removeItem(CREATE_POST_INTENT_KEY);
        setShowCreate(true);
      }
    } catch {}
  }, [isAuthenticated, user]);

  useEffect(() => {
    setPostDraftReady(false);
    setPostDraftRestored(false);
    if (!user?.id) return;
    const key = `nmb-draft:post:${user.id}`;
    const draft = readLocalDraft<{ title?: string; category?: PostCategory; location?: string; description?: string; latitude?: number; longitude?: number }>(key);
    if (draft) {
      setFt(draft.title || '');
      setFc(draft.category || 'buraco');
      setFl(draft.location || '');
      setFd(draft.description || '');
      setFLat(typeof draft.latitude === 'number' ? draft.latitude : undefined);
      setFLng(typeof draft.longitude === 'number' ? draft.longitude : undefined);
      if (draft.title || draft.location || draft.description) setPostDraftRestored(true);
    }
    setPostDraftReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !postDraftReady) return;
    const key = `nmb-draft:post:${user.id}`;
    const hasContent = Boolean(ft.trim() || fl.trim() || fd.trim() || fLat != null || fLng != null);
    if (!hasContent) {
      clearLocalDraft(key);
      return;
    }
    const timer = window.setTimeout(() => {
      saveLocalDraft(key, { title: ft, category: fc, location: fl, description: fd, latitude: fLat, longitude: fLng });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [user?.id, postDraftReady, ft, fc, fl, fd, fLat, fLng]);

  const discardPostDraft = useCallback(() => {
    if (user?.id) clearLocalDraft(`nmb-draft:post:${user.id}`);
    setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi(''); setFLat(undefined); setFLng(undefined); setFOfficialProtocol(''); setFOfficialStatus('submitted'); setSimilarPosts([]);
    setPostDraftRestored(false);
    toast('Rascunho descartado.', 'info');
  }, [user?.id, toast]);

  useEffect(() => {
    let active = true;
    if (!user?.id || !isNeighborhoodSelected || !currentNeighborhood.name) {
      setIsFollowingNeighborhood(false);
      setFollowLoading(false);
      return () => { active = false; };
    }
    setFollowLoading(true);
    const kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';
    void supabase.from('neighborhood_follows')
      .select('area')
      .eq('user_id', user.id)
      .eq('area', currentNeighborhood.name)
      .eq('kind', kind)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn('Não foi possível verificar o bairro seguido:', error);
        setIsFollowingNeighborhood(Boolean(data));
        setFollowLoading(false);
      });
    return () => { active = false; };
  }, [user?.id, isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind]);

  useEffect(() => {
    let active = true;
    if (!isNeighborhoodSelected || !currentNeighborhood.name) {
      setNeighborhoodSummary(null);
      setSummaryLoading(false);
      return () => { active = false; };
    }
    setSummaryLoading(true);
    const p_kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';
    void supabase.rpc('get_neighborhood_weekly_summary', { p_area: currentNeighborhood.name, p_kind })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Não foi possível carregar o resumo do bairro:', error);
          setNeighborhoodSummary(null);
        } else {
          setNeighborhoodSummary(data as NeighborhoodWeeklySummary);
        }
        setSummaryLoading(false);
      });
    return () => { active = false; };
  }, [isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind]);

  const openCreate = useCallback(() => {
    if (!isAuthenticated || !user) {
      try { sessionStorage.setItem(CREATE_POST_INTENT_KEY, 'create-post'); } catch {}
      toast('Entre ou crie uma conta para publicar um relato.', 'info');
      navigate('/login');
      return;
    }
    setShowCreate(true);
  }, [isAuthenticated, user, navigate, toast]);
  const toggleDescription = useCallback((postId: string) => { setExpandedDescriptions(prev => { const next = new Set(prev); next.has(postId) ? next.delete(postId) : next.add(postId); return next; }); }, []);
  const statusCounts = useMemo(() => { const c: Record<string, number> = { all: posts.length }; for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1; return c; }, [posts]);
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => { const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };

  const filtered = useMemo(() => {
    const q = normalizeNeighborhoodText(searchQuery);
    return posts.filter(p => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (activeStatus !== 'all' && p.status !== activeStatus) return false;
      if (onlyMine && user && p.authorId !== user.id) return false;
      if (onlyMine && !user) return false;
      if (onlyWithImage && !p.imageUrl) return false;

      if (q) {
        const searchable = normalizeNeighborhoodText([
          p.title, p.description, p.location, p.authorName,
          p.neighborhood || '', p.locality || '', neighborhoodSearchText(p.neighborhood), neighborhoodSearchText(p.locality),
        ].join(' '));
        if (!searchable.includes(q)) return false;
      }

      // GPS proximity takes precedence over the selected neighborhood. This makes
      // "Perto de mim" useful even when the global filter is set to another area.
      if (nearMe) {
        if (!userLocation || p.latitude == null || p.longitude == null) return false;
        if (calculateDistance(userLocation.lat, userLocation.lng, Number(p.latitude), Number(p.longitude)) > nearRadius) return false;
      } else if (isNeighborhoodSelected && currentNeighborhood.name) {
        if (!neighborhoodMatches(currentNeighborhood.name, p.neighborhood, p.locality, p.location)) return false;
      }

      return true;
    });
  }, [posts, activeCategory, activeStatus, searchQuery, onlyMine, onlyWithImage, nearMe, nearRadius, userLocation, user, currentNeighborhood, isNeighborhoodSelected]);

  const visiblePosts = useMemo(() => {
    const next = [...filtered];
    if (sortMode === 'supported') return next.sort((a, b) => b.supports - a.supports || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortMode === 'discussed') return next.sort((a, b) => ((commentsByPost[b.id]?.length ?? b.commentsCount) - (commentsByPost[a.id]?.length ?? a.commentsCount)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortMode === 'nearest' && userLocation) {
      return next.sort((a, b) => {
        const da = a.latitude != null && a.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude)) : Number.POSITIVE_INFINITY;
        const db = b.latitude != null && b.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude)) : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }
    return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filtered, sortMode, userLocation, commentsByPost]);

  const renderedPosts = useMemo(() => visiblePosts.slice(0, renderLimit), [visiblePosts, renderLimit]);
  const remainingPosts = Math.max(0, visiblePosts.length - renderedPosts.length);

  useEffect(() => {
    setRenderLimit(FEED_RENDER_BATCH);
  }, [activeCategory, activeStatus, searchQuery, onlyMine, onlyWithImage, nearMe, nearRadius, sortMode, currentNeighborhood.name, isNeighborhoodSelected]);

  const toggleNearMe = useCallback(async () => {
    if (!nearMe) {
      toast('Obtendo sua localização GPS...', 'info');
      if (!navigator.geolocation) { toast('Navegador sem suporte a GPS. Usando localização do bairro.', 'info'); setNearMe(true); return; }
      navigator.geolocation.getCurrentPosition((pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearMe(true); toast('Localização GPS obtida!'); }, () => { toast('GPS falhou. Usando localização do bairro.', 'info'); setNearMe(true); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    } else { setNearMe(false); setUserLocation({ lat: currentNeighborhood.latitude, lng: currentNeighborhood.longitude }); }
  }, [nearMe, currentNeighborhood, toast]);

  const handleCreate = useCallback(async (allowDuplicate = false) => {
    if (!ft.trim() || !fd.trim() || !fl.trim()) return;
    setCreatingPost(true);
    try {
      const result = await addPost({
        title: ft,
        description: fd,
        category: fc,
        location: fl,
        imageUrl: fi || undefined,
        latitude: fLat,
        longitude: fLng,
        officialAgency: getPublicServiceContact(fc).authority,
        officialProtocol: fOfficialProtocol || undefined,
        officialStatus: fOfficialStatus,
        allowDuplicate,
      });
      if (result.duplicates?.length) {
        setSimilarPosts(result.duplicates);
        toast('Encontramos relatos parecidos perto desse local.', 'info');
        return;
      }
      if (result.error) {
        toast(result.error?.message || 'Não foi possível publicar o relato.', 'error');
        return;
      }
      if (user?.id) clearLocalDraft(`nmb-draft:post:${user.id}`);
      setPostDraftRestored(false);
      setShowCreate(false);
      setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi(''); setFLat(undefined); setFLng(undefined); setFOfficialProtocol(''); setFOfficialStatus('submitted'); setSimilarPosts([]);
      toast('Relato publicado com bairro identificado!');
    } finally {
      setCreatingPost(false);
    }
  }, [ft, fd, fl, fc, fi, fLat, fLng, fOfficialProtocol, fOfficialStatus, addPost, toast, user?.id]);

  const handlePostCepSearch = async (cep: string) => { const clean = cep.replace(/\D/g, ''); if (clean.length === 8) { try { const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`); const data = await res.json(); if (!data.erro) { setFl(data.bairro ? `${data.logradouro} — ${data.bairro}` : data.logradouro); toast('Rua e bairro localizados pelo CEP!'); } } catch {} } };
  const handleSupport = useCallback(async (id: string) => { if (!isAuthenticated || !user) { toast('Entre ou crie uma conta para apoiar um relato.', 'info'); navigate('/login'); return; } const isSupported = supported.has(id); const result = await supportPost(id); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o apoio.', 'error'); return; } const next = new Set(supported); if (isSupported) next.delete(id); else { next.add(id); setHeartsAnimating(prev => { const n = new Set(prev); n.add(id); return n; }); setTimeout(() => setHeartsAnimating(prev => { const n = new Set(prev); n.delete(id); return n; }), 500); } setSupported(next); try { localStorage.setItem('anb-supported', JSON.stringify([...next])); } catch {} }, [supported, supportPost, isAuthenticated, user, toast, navigate]);
  const toggleComments = useCallback((postId: string) => { setExpandedPosts(prev => { const n = new Set(prev); n.has(postId) ? n.delete(postId) : n.add(postId); return n; }); }, []);
  const handleSubmitComment = useCallback(async (postId: string) => { const text = (commentTexts[postId] ?? '').trim(); if (!text || !user) return; const result = await addComment(postId, text, replyingTo[postId] ?? undefined); if (!result.ok) { toast(result.error || 'Não foi possível adicionar o comentário.', 'error'); return; } setCommentTexts(prev => ({ ...prev, [postId]: '' })); setReplyingTo(prev => ({ ...prev, [postId]: null })); toast('Comentário adicionado!'); }, [commentTexts, replyingTo, user, addComment, toast]);
  const handleReplyClick = useCallback((postId: string, comment: Comment) => { setReplyingTo(prev => ({ ...prev, [postId]: prev[postId] === comment.id ? null : comment.id })); }, []);
  const handleDeletePost = useCallback(async (postId: string) => { const result = await deletePost(postId); if (!result.ok) { toast(result.error || 'Não foi possível excluir o relato.', 'error'); return; } setConfirmDeleteId(null); toast('Relato excluído.', 'info'); }, [deletePost, toast]);
  const handleDeleteComment = useCallback(async (commentId: string) => { const result = await deleteComment(commentId); if (!result.ok) { toast(result.error || 'Não foi possível excluir o comentário.', 'error'); return; } toast('Comentário excluído.', 'info'); }, [deleteComment, toast]);
  const handleStatusChange = useCallback(async (postId: string, status: PostStatus) => { const result = await updatePostStatus(postId, status); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o status.', 'error'); return; } const labels: Record<string, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \"${labels[status]}\".`); }, [updatePostStatus, toast]);
  const handleSharePost = useCallback(async (post: { id: string; title: string; description: string }) => { const result = await shareContent({ title: `${post.title} · No Meu Bairro`, text: post.description.slice(0, 180), url: postShareUrl(post.id) }); if (result === 'copied') toast('Link do relato copiado!'); else if (result === 'failed') toast('Não foi possível compartilhar este relato.', 'error'); }, [toast]);
  const toggleNeighborhoodFollow = useCallback(async () => {
    if (!isNeighborhoodSelected || !currentNeighborhood.name) { toast('Selecione um bairro para acompanhá-lo.', 'info'); return; }
    if (!user?.id) { toast('Entre ou crie uma conta para seguir bairros.', 'info'); navigate('/login'); return; }
    if (followLoading) return;
    setFollowLoading(true);
    const area = currentNeighborhood.name;
    const kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';
    try {
      const request = isFollowingNeighborhood
        ? supabase.from('neighborhood_follows').delete().eq('user_id', user.id).eq('area', area).eq('kind', kind)
        : supabase.from('neighborhood_follows').insert({ user_id: user.id, area, kind });
      const { error } = await request;
      if (error) { toast(error.message || 'Não foi possível atualizar o bairro seguido.', 'error'); return; }
      setIsFollowingNeighborhood(!isFollowingNeighborhood);
      toast(isFollowingNeighborhood ? `Você deixou de seguir ${area}.` : `Agora você segue ${area}.`);
    } finally {
      setFollowLoading(false);
    }
  }, [isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind, user?.id, followLoading, isFollowingNeighborhood, navigate, toast]);
  const handleSendReport = async () => { if (!reportReason.trim()) return; if (!isAuthenticated || !user) { toast('Entre ou crie uma conta para denunciar conteúdo.', 'info'); navigate('/login'); return; } const finalReason = reportDetail.trim() ? `${reportReason}: ${reportDetail}` : reportReason; const result = await reportContent({ ...showReport, reason: finalReason }); if (!result.ok) { toast(result.error || 'Não foi possível enviar a denúncia.', 'error'); return; } setShowReport(null); setReportReason(''); setReportDetail(''); toast('Denúncia enviada para análise do administrador.'); };
  const displayNeighborhood = currentNeighborhood.name || 'Todos os bairros';
  const reportDelta = neighborhoodSummary ? neighborhoodSummary.newReports - neighborhoodSummary.previousReports : 0;
  const topSummaryCategory = neighborhoodSummary?.topCategory ? postCategories[neighborhoodSummary.topCategory] : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 sm:gap-4"><div className="min-w-0"><h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Relatos Comunitários</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{isNeighborhoodSelected ? <>Bairro selecionado: <strong className="text-emerald-600 dark:text-emerald-400">{displayNeighborhood}</strong></> : <>Mostrando relatos de <strong className="text-emerald-600 dark:text-emerald-400">todos os bairros</strong></>}</p>{isNeighborhoodSelected && <p className="text-sm font-medium text-slate-500 dark:text-slate-300 mt-1.5">Siga este bairro para receber novidades no No Meu Bairro.</p>}</div><div className="flex items-center gap-2 shrink-0">{isNeighborhoodSelected && <button type="button" onClick={() => void toggleNeighborhoodFollow()} disabled={followLoading} className={cn('min-h-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold ring-1 transition-all disabled:opacity-60', isFollowingNeighborhood ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' : 'bg-white text-slate-600 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')} aria-pressed={isFollowingNeighborhood} title={isFollowingNeighborhood ? `Deixar de seguir ${displayNeighborhood}` : `Seguir ${displayNeighborhood}`}><Bell className={cn('w-4 h-4', isFollowingNeighborhood && 'fill-current')} /><span className="hidden sm:inline">{followLoading ? 'Salvando...' : isFollowingNeighborhood ? 'Seguindo' : 'Seguir bairro'}</span></button>}<button onClick={() => { fetchData(); toast('Atualizando relatos...', 'info'); }} disabled={loading} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50" aria-label="Atualizar relatos"><RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} /></button></div></div>
      {isNeighborhoodSelected && (
        <Card className="!p-4 sm:!p-5 !bg-gradient-to-br !from-emerald-50/80 !to-white dark:!from-emerald-500/5 dark:!to-slate-900 !ring-emerald-100 dark:!ring-emerald-500/15">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">O que mudou no seu bairro</p><h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">{displayNeighborhood} · últimos 7 dias</h2></div>
            {!summaryLoading && neighborhoodSummary && <span className={cn('shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold', reportDelta > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : reportDelta < 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>{reportDelta === 0 ? 'volume estável' : `${reportDelta > 0 ? '+' : ''}${reportDelta} relato${Math.abs(reportDelta) === 1 ? '' : 's'} vs. semana anterior`}</span>}
          </div>
          {summaryLoading ? (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">{[0,1,2,3].map(item => <div key={item} className="h-16 rounded-xl bg-white/70 dark:bg-slate-800/60 animate-pulse" />)}</div>
          ) : neighborhoodSummary ? (
            <>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Novos relatos', value: neighborhoodSummary.newReports, icon: MessageSquare, cls: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
                  { label: 'Resolvidos', value: neighborhoodSummary.resolvedReports, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
                  { label: 'Eventos próximos', value: neighborhoodSummary.upcomingEvents, icon: CalendarDays, cls: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
                  { label: 'Novas vagas', value: neighborhoodSummary.newJobs, icon: Briefcase, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
                ].map(item => <div key={item.label} className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-3 ring-1 ring-slate-100 dark:ring-slate-800"><div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.cls)}><item.icon className="w-4 h-4" /></div><p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{item.value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p></div>)}
              </div>
              {topSummaryCategory && neighborhoodSummary.topCategoryCount > 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Tema mais relatado na semana: <strong className="text-slate-700 dark:text-slate-200">{topSummaryCategory.emoji} {topSummaryCategory.label}</strong> ({neighborhoodSummary.topCategoryCount}).</p>}
            </>
          ) : <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-300">O resumo deste bairro está temporariamente indisponível.</p>}
        </Card>
      )}
      {isAuthenticated && user && posts.length === 0 && <Card className="!bg-gradient-to-br !from-emerald-50 !to-teal-50 dark:!from-emerald-500/5 dark:!to-teal-500/5 !ring-emerald-200 dark:!ring-emerald-500/20 animate-fade-in"><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm"><span className="text-2xl" role="img" aria-hidden="true">👋</span></div><div className="flex-1 min-w-0"><h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Olá, {user.name.split(' ')[0]}! Bem-vindo ao No Meu Bairro.</h3><p className="text-xs text-emerald-700/70 dark:text-emerald-400/60 mt-1 leading-relaxed">Este é o espaço onde moradores compartilham problemas e notícias de toda Curitiba. 🌿</p><Button size="sm" className="mt-3" onClick={openCreate}><Sparkles className="w-3.5 h-3.5" /> Criar meu primeiro relato</Button></div></div></Card>}
      <div className="space-y-2"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar por título, bairro, CIC ou CEP..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter') { const clean = searchQuery.replace(/\D/g, ''); if (clean.length === 8) { toast('Buscando CEP...', 'info'); try { const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`); const data = await res.json(); if (!data.erro) { const ok = await setNeighborhoodByCep(clean); if (ok) { toast('Bairro localizado: ' + data.bairro); setSearchQuery(''); } } else toast('CEP não encontrado.', 'error'); } catch { toast('Erro ao buscar CEP.', 'error'); } } } }} className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" aria-label="Buscar relatos ou selecionar bairro por CEP" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10" aria-label="Limpar busca"><X className="w-4 h-4" /></button>}</div></div>
      <Card className="!p-3"><div className="flex items-center gap-2"><div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1" role="tablist">{statusOpts.map(s => { const count = statusCounts[s.id] ?? 0; return <button key={s.id} role="tab" aria-selected={activeStatus === s.id} onClick={() => setActiveStatus(s.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all', activeStatus === s.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')}>{s.label}{count > 0 && <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none', activeStatus === s.id ? 'bg-white/20' : 'bg-slate-200/80 dark:bg-slate-700')}>{count}</span>}</button>; })}</div>{isAuthenticated && <button onClick={() => setOnlyMine(!onlyMine)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0', onlyMine ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')} aria-pressed={onlyMine} title="Mostrar apenas meus relatos"><UserCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Meus</span></button>}<button onClick={toggleNearMe} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0', nearMe ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700')} aria-pressed={nearMe} title="Mostrar relatos perto de mim"><MapPin className="w-3.5 h-3.5" /><span className="hidden sm:inline">{nearMe ? `Até ${nearRadius} km` : 'Perto de mim'}</span></button><button onClick={() => setShowFilters(!showFilters)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0', showFilters ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400')}><Filter className="w-3.5 h-3.5" /><span className="hidden sm:inline">Filtros</span><ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} /></button></div>{showFilters && <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Categoria</p><div className="flex flex-wrap gap-1.5">{Object.entries(postCategories).map(([key, def]) => { const Icon = catIcons[key] ?? HelpCircle; return <button key={key} onClick={() => setActiveCategory(activeCategory === key ? null : key as PostCategory)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', activeCategory === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')}><Icon className="w-3.5 h-3.5" />{def.label}</button>; })}</div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ordenar por</span><select value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)} className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"><option value="recent">Mais recentes</option><option value="supported">Mais apoiados</option><option value="discussed">Mais comentados</option><option value="nearest">Mais próximos</option></select></label><button type="button" onClick={() => setOnlyWithImage(!onlyWithImage)} className={cn('mt-4 sm:mt-[18px] min-h-10 rounded-xl px-3 text-xs font-bold ring-1 transition-all', onlyWithImage ? 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20' : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')} aria-pressed={onlyWithImage}>📷 {onlyWithImage ? 'Somente com imagem' : 'Filtrar com imagem'}</button></div>{nearMe && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Distância máxima</p><div className="flex gap-1.5">{([1,3,5,10] as const).map(radius => <button type="button" key={radius} onClick={() => { setNearRadius(radius); if (sortMode === 'recent') setSortMode('nearest'); }} className={cn('min-h-9 flex-1 rounded-lg text-xs font-bold transition-all', nearRadius === radius ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>{radius} km</button>)}</div></div>}<button type="button" onClick={() => { setActiveCategory(null); setOnlyWithImage(false); setSortMode('recent'); setNearRadius(5); }} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Limpar filtros avançados</button></div>}</Card>
      {visiblePosts.length === 0 ? <EmptyState icon={MessageSquare} title={searchQuery ? 'Nenhum resultado encontrado' : 'Nenhum relato por enquanto'} description={searchQuery ? `Nenhum relato corresponde a "${searchQuery}".` : isNeighborhoodSelected ? `Nenhum relato identificado exatamente em ${displayNeighborhood}.` : 'Seja o primeiro a registrar um relato em Curitiba!'} action={searchQuery ? { label: 'Limpar busca', onClick: () => setSearchQuery('') } : { label: 'Criar relato', onClick: openCreate }} /> : <>
        {searchQuery && <p className="text-xs text-slate-400 -mt-2">{visiblePosts.length} resultado{filtered.length !== 1 ? 's' : ''} para "{searchQuery}"</p>}
        <div className="space-y-3 stagger">
          {renderedPosts.map(post => {
            const isAnon = post.authorId === 'anonymous';
            const isExpanded = expandedPosts.has(post.id);
            const isDescriptionExpanded = expandedDescriptions.has(post.id);
            const shouldShowReadMore = post.description.length > 200;
            const postComments = commentsByPost[post.id] ?? [];
            const rootComments = postComments.filter((c: Comment) => !c.parentId);
            const curReply = replyingTo[post.id] ?? null;
            const replyTarget = curReply ? postComments.find((c: Comment) => c.id === curReply) : null;
            const resolvedArea = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;
            const canManageStatus = isMyPost(post) || canModerate;
            const distanceFromUser = userLocation && post.latitude != null && post.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(post.latitude), Number(post.longitude)) : null;
            return <Card key={post.id} id={`post-${post.id}`} className={cn(isAnon && 'ring-red-200 dark:ring-red-500/20', 'feed-card-optimized animate-card-enter active:scale-[0.99] md:active:scale-100 transition-transform')}>
              <div className="flex items-center gap-3 mb-4"><div className="flex items-center gap-3 flex-1 min-w-0">{isAnon ? <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><ShieldAlert className="w-5 h-5" /></div> : <Link to={`/perfil/${post.authorId}`} className="relative group shrink-0"><div className="w-10 h-10 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all">{post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt={post.authorName} className="w-full h-full object-cover" /> : post.authorName.charAt(0).toUpperCase()}</div></Link>}<div className="min-w-0 flex-1">{isAnon ? <p className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">{post.authorName}</p> : <Link to={`/perfil/${post.authorId}`} className="text-sm font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block">{post.authorName}</Link>}<p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p></div></div><StatusBadge status={post.status} />{isMyPost(post) && (confirmDeleteId === post.id ? <div className="flex items-center gap-1.5 animate-fade-in"><button onClick={() => handleDeletePost(post.id)} className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors">Confirmar</button><button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button></div> : <button onClick={() => setConfirmDeleteId(post.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all" aria-label="Excluir relato"><Trash2 className="w-4 h-4" /></button>)}</div>
              <Link to={`/post/${post.id}`} className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40"><h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">{post.title}</h3></Link>
              <div className="relative"><p className={cn('text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line break-words transition-all', !isDescriptionExpanded && 'line-clamp-4')}>{post.description}</p>{shouldShowReadMore && <button onClick={() => toggleDescription(post.id)} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline underline-offset-2">{isDescriptionExpanded ? 'Ver menos' : 'Ler descrição completa'}</button>}</div>
              {post.imageUrl && <div className="mt-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(post.imageUrl!)}><img src={post.imageUrl} alt="" className="w-full max-h-72 object-cover" loading="lazy" decoding="async" /></div>}
              {post.latitude != null && post.longitude != null && <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-3 py-2.5"><MapPin className="w-4 h-4 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">Localização no mapa</p><p className="text-[10px] text-slate-400 truncate">{post.location}</p></div><button type="button" onClick={() => navigate('/mapa')} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 shrink-0">Ver mapa</button></div>}
              <div className="flex items-center gap-2 mt-3 flex-wrap"><CategoryBadge category={post.category} />{resolvedArea && <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[11px] font-bold text-orange-800 dark:text-orange-300"><MapPin className="w-3 h-3" />{resolvedArea}</span>}{nearMe && distanceFromUser != null && <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300"><LocateFixed className="w-3 h-3" />{distanceFromUser < 1 ? `${Math.round(distanceFromUser * 1000)} m` : `${distanceFromUser.toFixed(1)} km`}</span>}{post.location && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" />{post.location}</span>}</div>
              <PublicServiceContact category={post.category} compact />
              {post.officialProtocol && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">Protocolo oficial: {post.officialProtocol}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/20">
                      {post.officialStatus === 'resolved' ? 'Resolvido pelo órgão' : post.officialStatus === 'in_progress' ? 'Em atendimento' : 'Protocolado'}
                    </span>
                  </div>
                  {post.officialAgency && <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">{post.officialAgency}</p>}
                </div>
              )}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800"><button onClick={() => handleSupport(post.id)} className={cn('flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95', supported.has(post.id) ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400')} aria-label="Apoiar"><Heart className={cn('w-4 h-4', supported.has(post.id) && 'fill-current', heartsAnimating.has(post.id) && 'animate-heart-pop')} /><span>{post.supports > 0 ? post.supports : ''} Apoio{post.supports !== 1 ? 's' : ''}</span></button><button onClick={() => toggleComments(post.id)} className={cn('flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95', isExpanded ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400')} aria-expanded={isExpanded}><MessageSquare className="w-4 h-4" /><span>{postComments.length > 0 ? postComments.length : ''} Comentário{postComments.length !== 1 ? 's' : ''}</span></button></div>
              <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap"><button onClick={() => setShowReport({ postId: post.id })} className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 active:bg-red-50 dark:active:bg-red-500/10 transition-all"><AlertTriangle className="w-3.5 h-3.5" />Denunciar</button><Link to={`/post/${post.id}`} className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all"><ExternalLink className="w-3.5 h-3.5" />Abrir</Link><button type="button" onClick={() => void handleSharePost(post)} className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"><Share2 className="w-3.5 h-3.5" />Compartilhar</button><button type="button" onClick={() => void toggleSavedPost(post.id)} className={cn('flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold transition-all', isPostSaved(post.id) ? 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/10' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10')} aria-pressed={isPostSaved(post.id)}><Bookmark className={cn('w-3.5 h-3.5', isPostSaved(post.id) && 'fill-current')} />{isPostSaved(post.id) ? 'Salvo' : 'Salvar'}</button>{canManageStatus && <div className="flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar pb-1">{post.status !== 'pending' && <button onClick={() => handleStatusChange(post.id, 'pending')} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 active:scale-95 transition-all">Aberto</button>}{post.status !== 'in_progress' && <button onClick={() => handleStatusChange(post.id, 'in_progress')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 ring-1 ring-blue-200 dark:ring-blue-500/20 transition-all">Em andamento</button>}{post.status !== 'resolved' && <button onClick={() => handleStatusChange(post.id, 'resolved')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 ring-1 ring-blue-200 dark:ring-emerald-500/20 transition-all">Resolvido</button>}</div>}</div>
              {isExpanded && <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-fade-in">{rootComments.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p> : <div className="space-y-3">{rootComments.map((rc: Comment) => { const replies = postComments.filter((c: Comment) => c.parentId === rc.id); return <CommentItem key={rc.id} comment={rc} replies={replies} allComments={postComments} onReply={(c) => handleReplyClick(post.id, c)} replyingTo={curReply} onDelete={handleDeleteComment} onReport={(id) => setShowReport({ commentId: id })} currentUser={user} isPostOwner={user?.id === post.authorId} />; })}</div>}{curReply && replyTarget && <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400 animate-slide-down"><CornerDownRight className="w-3.5 h-3.5 shrink-0" /><span className="truncate">Respondendo a <strong>{replyTarget.authorName}</strong></span><button onClick={() => setReplyingTo(prev => ({ ...prev, [post.id]: null }))} className="ml-auto p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors" aria-label="Cancelar resposta"><X className="w-3.5 h-3.5" /></button></div>}{isAuthenticated ? <div className="flex items-start gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">{user?.name.charAt(0).toUpperCase()}</div><div className="flex-1 relative"><textarea value={commentTexts[post.id] ?? ''} onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(post.id); } }} placeholder={curReply ? `Responder a ${replyTarget?.authorName ?? ''}...` : 'Escreva um comentário...'} rows={2} className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none" /><button onClick={() => handleSubmitComment(post.id)} disabled={!(commentTexts[post.id] ?? '').trim()} className={cn('absolute right-2 bottom-2 p-1.5 rounded-lg transition-all', (commentTexts[post.id] ?? '').trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'text-slate-300 dark:text-slate-600')} aria-label="Enviar"><Send className="w-4 h-4" /></button></div></div> : <button onClick={() => navigate('/login')} className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-400 hover:text-emerald-600 hover:border-emerald-300 dark:hover:text-emerald-400 transition-colors">Entre na sua conta para comentar</button>}</div>}
            </Card>;
          })}
        </div>
        {remainingPosts > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="secondary" onClick={() => setRenderLimit(limit => limit + FEED_RENDER_BATCH)}>
              Mostrar mais relatos ({remainingPosts} restantes)
            </Button>
          </div>
        )}
      </>}
      <button onClick={openCreate} className="fixed bottom-24 lg:bottom-8 right-4 sm:right-6 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center active:scale-95 group" aria-label="Criar novo relato" title={isAuthenticated ? 'Criar novo relato' : 'Entre ou crie uma conta para publicar'}><Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" /></button>
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setSimilarPosts([]); }}
        title="Novo Relato"
      >
        <form onSubmit={e => { e.preventDefault(); void handleCreate(false); }} className="space-y-4">
          {postDraftRestored && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Rascunho recuperado automaticamente</p>
                <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Salvo neste dispositivo para você não perder o que estava escrevendo.</p>
              </div>
              <button type="button" onClick={discardPostDraft} className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline shrink-0">Descartar</button>
            </div>
          )}
          <Input label="Título" placeholder="Ex: Buraco na Rua das Flores" value={ft} onChange={e => { setFt(e.target.value); setSimilarPosts([]); }} required />
          <Select label="Categoria" options={catOpts} value={fc} onChange={e => { setFc(e.target.value as PostCategory); setSimilarPosts([]); }} required />
          <PublicServiceContact category={fc} />
          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <summary className="cursor-pointer text-sm font-bold text-slate-800 dark:text-slate-100">Já tenho um protocolo oficial</summary>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Se você já falou com {getPublicServiceContact(fc).authority}, informe o número para a comunidade acompanhar.</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Número do protocolo (opcional)" placeholder="Ex: 2026-123456" value={fOfficialProtocol} onChange={e => setFOfficialProtocol(e.target.value.slice(0, 80))} />
              <Select
                label="Situação no órgão"
                value={fOfficialStatus}
                onChange={e => setFOfficialStatus(e.target.value as OfficialProtocolStatus)}
                options={[
                  { value: 'submitted', label: 'Protocolado' },
                  { value: 'in_progress', label: 'Em atendimento' },
                  { value: 'resolved', label: 'Resolvido pelo órgão' },
                ]}
              />
            </div>
          </details>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Localização (Rua/Bairro)" placeholder="Ex: Rua das Flores, 123" value={fl} onChange={e => { setFl(e.target.value); setSimilarPosts([]); }} required />
            <Input label="Buscar por CEP" placeholder="Ex: 81460296" maxLength={8} onChange={e => handlePostCepSearch(e.target.value)} />
          </div>
          <MapPicker onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); setSimilarPosts([]); }} address={fl} />
          <Textarea label="Descrição" placeholder="Descreva o problema com detalhes..." value={fd} onChange={e => setFd(e.target.value)} required />
          <ImageUpload value={fi} onChange={setFi} />
          {similarPosts.length > 0 && (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-amber-900 dark:text-amber-100">Talvez este problema já tenha sido relatado</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">Abrir e apoiar um relato existente concentra a força da comunidade. Se for outro ponto, você ainda pode publicar.</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {similarPosts.map(similar => (
                  <button
                    key={similar.id}
                    type="button"
                    onClick={() => { setShowCreate(false); navigate('/post/' + similar.id); }}
                    className="w-full rounded-xl bg-white p-3 text-left ring-1 ring-amber-200 transition hover:ring-amber-400 dark:bg-slate-900 dark:ring-amber-500/20"
                  >
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{similar.title}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{similar.location} · {similar.distanceM < 1000 ? Math.round(similar.distanceM) + ' m' : (similar.distanceM / 1000).toFixed(1) + ' km'}</span>
                  </button>
                ))}
              </div>
              <Button type="button" variant="secondary" className="mt-3 w-full" disabled={creatingPost} onClick={() => void handleCreate(true)}>
                {creatingPost ? 'Publicando...' : 'É outro problema — publicar mesmo assim'}
              </Button>
            </div>
          )}
          <p className="text-[10px] text-slate-400">Título, categoria, localização e descrição são salvos automaticamente neste dispositivo por até 30 dias. Imagens não entram no rascunho.</p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowCreate(false); setSimilarPosts([]); }}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!ft.trim() || !fd.trim() || !fl.trim() || creatingPost}>
              {creatingPost ? 'Verificando...' : similarPosts.length > 0 ? 'Verificar novamente' : 'Publicar relato'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!showReport} onClose={() => setShowReport(null)} title="Denunciar Conteúdo"><div className="space-y-4"><p className="text-sm text-slate-500">Ajude-nos a manter o bairro seguro. Por que você está denunciando este conteúdo?</p><Select label="Categoria da Denúncia" options={[{ value: '', label: 'Selecione uma categoria...' }, { value: 'Conteúdo ofensivo ou ódio', label: 'Conteúdo ofensivo ou ódio' }, { value: 'Informação falsa (Spam)', label: 'Informação falsa (Spam)' }, { value: 'Assédio ou perseguição', label: 'Assédio ou perseguição' }, { value: 'Conteúdo inadequado ou ilegal', label: 'Conteúdo inadequado ou ilegal' }, { value: 'Outros', label: 'Outros' }]} value={reportReason} onChange={e => setReportReason(e.target.value)} /><Textarea label="Detalhes da denúncia (opcional)" placeholder="Descreva melhor o problema para ajudar o administrador..." value={reportDetail} onChange={e => setReportDetail(e.target.value)} rows={3} /><div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1" onClick={() => setShowReport(null)}>Cancelar</Button><Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleSendReport} disabled={!reportReason}>Enviar Denúncia</Button></div></div></Modal>
      <ImageViewer src={zoomedImage || ''} open={!!zoomedImage} onClose={() => setZoomedImage(null)} />
    </div>
  );
}
