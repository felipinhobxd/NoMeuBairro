import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2, Share2, Bookmark } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, StatusBadge, CategoryBadge, EmptyState, timeAgo, useToast } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase } from '../utils/supabase';
import { shareContent } from '../utils/share';
import { useSavedItems } from '../hooks/useSavedItems';
import { cn } from '../utils/cn';
import type { Comment, Post, PostStatus } from '../types';

type StatusHistoryItem = { id: string; old_status?: PostStatus | null; new_status: PostStatus; source: string; changed_at: string };
const lifecycleLabels: Record<PostStatus, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' };
const lifecycleClasses: Record<PostStatus, string> = {
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  resolved: 'bg-emerald-600',
};

function ThreadComment({
  comment,
  allComments,
  replyingTo,
  onReply,
  onDelete,
  deletingComment,
  currentUserId,
  postAuthorId,
  depth = 0,
}: {
  comment: Comment;
  allComments: Comment[];
  replyingTo: string | null;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  deletingComment: string | null;
  currentUserId?: string;
  postAuthorId: string;
  depth?: number;
}) {
  const children = allComments.filter(item => item.parentId === comment.id);
  const canDelete = currentUserId === comment.authorId || currentUserId === postAuthorId;
  const nested = depth > 0;

  return (
    <div className={nested ? 'ml-4 sm:ml-7 border-l-2 border-slate-100 dark:border-slate-700 pl-3 sm:pl-4' : ''}>
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{comment.authorName}</span>
              <span className="text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line break-words">{comment.content}</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onReply(comment)}
                className={replyingTo === comment.id
                  ? 'text-[11px] font-bold text-emerald-700 dark:text-emerald-400'
                  : 'text-[11px] font-bold text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400'}
              >
                Responder
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  disabled={deletingComment === comment.id}
                  className="text-[11px] font-bold text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingComment === comment.id ? 'Excluindo...' : 'Excluir'}
                </button>
              )}
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              disabled={deletingComment === comment.id}
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
              title="Excluir comentário"
              aria-label="Excluir comentário"
            >
              {deletingComment === comment.id
                ? <span className="block w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map(child => (
            <ThreadComment
              key={child.id}
              comment={child}
              allComments={allComments}
              replyingTo={replyingTo}
              onReply={onReply}
              onDelete={onDelete}
              deletingComment={deletingComment}
              currentUserId={currentUserId}
              postAuthorId={postAuthorId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { isSaved: isPostSaved, toggleSaved: toggleSavedPost } = useSavedItems('post');
  const { supportPost, addComment, commentsByPost, loadComments, deleteComment, updatePostStatus, isMyPost } = useData();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<PostStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!postId) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      setCommentsLoading(true);

      const postPromise = supabase
        .from('posts')
        .select('id,author_id,category,status,title,description,image_url,location,neighborhood,locality,location_precision,latitude,longitude,is_anonymous,created_at,updated_at,comments_count,users(name,avatar_url),post_supports(count)')
        .eq('id', postId)
        .maybeSingle();
      const commentsPromise = loadComments(postId);
      const supportPromise = user?.id
        ? supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null } as any);
      const historyPromise = supabase
        .from('post_status_history')
        .select('id,old_status,new_status,source,changed_at')
        .eq('post_id', postId)
        .order('changed_at', { ascending: false })
        .limit(30);

      const [postResult, , supportResult, historyResult] = await Promise.all([postPromise, commentsPromise, supportPromise, historyPromise]);
      if (!mounted) return;

      const data = postResult.data;
      if (data) {
        setPost({
          id: data.id,
          authorId: data.author_id || 'anonymous',
          authorName: data.is_anonymous ? 'Denúncia Anônima' : (data.users?.name || 'Morador'),
          authorAvatarUrl: data.is_anonymous ? undefined : data.users?.avatar_url,
          category: data.category,
          status: data.status,
          title: data.title,
          description: data.description,
          imageUrl: data.image_url || undefined,
          location: data.location || '',
          neighborhood: data.neighborhood || undefined,
          locality: data.locality || undefined,
          locationPrecision: data.location_precision || undefined,
          latitude: data.latitude == null ? undefined : Number(data.latitude),
          longitude: data.longitude == null ? undefined : Number(data.longitude),
          supports: data.post_supports?.[0]?.count ?? 0,
          commentsCount: data.comments_count ?? 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } else setPost(null);
      setSupported(Boolean(supportResult?.data));
      setStatusHistory((historyResult?.data || []) as StatusHistoryItem[]);
      setCommentsLoading(false);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [postId, user?.id, loadComments]);

  useEffect(() => {
    let active = true;
    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }
    void supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      setCanModerate(data?.role === 'admin' || data?.role === 'moderator');
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!post) return;
    const previousTitle = document.title;
    document.title = `${post.title} | No Meu Bairro`;
    return () => { document.title = previousTitle; };
  }, [post?.id, post?.title]);

  const postComments = post ? (commentsByPost[post.id] ?? []) : [];
  const rootComments = useMemo(() => postComments.filter(comment => !comment.parentId), [postComments]);
  const replyTarget = replyingTo ? postComments.find(comment => comment.id === replyingTo) : undefined;

  const handleSupport = async () => {
    if (!postId) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    const wasSupported = supported;
    await supportPost(postId);
    setSupported(!wasSupported);
    setPost(prev => prev ? { ...prev, supports: Math.max(0, prev.supports + (wasSupported ? -1 : 1)) } : prev);
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!postId || !text) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    await addComment(postId, text, replyingTo || undefined);
    setPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev);
    setCommentText('');
    setReplyingTo(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!postId || deletingComment) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!confirm('Excluir este comentário?')) return;
    setDeletingComment(commentId);
    try {
      await deleteComment(commentId);
      setPost(prev => prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : prev);
      if (replyingTo === commentId) setReplyingTo(null);
    } finally {
      setDeletingComment(null);
    }
  };

  const handleStatusChange = async (status: PostStatus) => {
    if (!postId || !post || updatingStatus || post.status === status) return;
    setUpdatingStatus(status);
    try {
      const result = await updatePostStatus(postId, status);
      if (!result.ok) return;
      setPost(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : prev);
      const { data } = await supabase.from('post_status_history').select('id,old_status,new_status,source,changed_at').eq('post_id', postId).order('changed_at', { ascending: false }).limit(30);
      if (data) setStatusHistory(data as StatusHistoryItem[]);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const result = await shareContent({ title: `${post.title} · No Meu Bairro`, text: post.description.slice(0, 180), url: `/post/${post.id}` });
    if (result === 'copied') toast('Link do relato copiado!');
    else if (result === 'failed') toast('Não foi possível compartilhar este relato.', 'error');
  };

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando post...</div>;
  if (!post) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card><EmptyState icon={MessageSquare} title="Post não encontrado" description="Esse post pode ter sido excluído ou não está mais disponível." /></Card>
    </div>
  );

  const anonymous = post.authorId === 'anonymous';
  const area = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;
  const canManageStatus = isMyPost(post) || canModerate;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden">
            {anonymous ? <ShieldAlert className="w-5 h-5 text-red-500" /> : post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" decoding="async" /> : <span className="font-bold text-emerald-600">{post.authorName.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className={anonymous ? 'text-sm font-semibold text-red-600 dark:text-red-400' : 'text-sm font-semibold text-slate-900 dark:text-white'}>{post.authorName}</p>
            <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
          </div>
          <StatusBadge status={post.status} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-5">{post.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line leading-relaxed">{post.description}</p>
        {post.imageUrl && (
          <button type="button" onClick={() => setSelectedImage(post.imageUrl || null)} className="group relative mt-4 block w-full overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <img src={post.imageUrl} alt="Imagem do relato" className="block w-full max-h-[620px] object-contain bg-slate-100 dark:bg-slate-800" loading="lazy" decoding="async" />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/65 text-white text-xs font-semibold opacity-90 group-hover:opacity-100">
              <Maximize2 className="w-4 h-4" /> Ampliar imagem
            </span>
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <CategoryBadge category={post.category} />
          {area && <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-300"><MapPin className="w-3 h-3" /> {area}</span>}
          {post.location && <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" /> {post.location}</span>}
        </div>

        {canManageStatus && (
          <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"><Settings2 className="w-4 h-4 text-slate-500" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Atualizar andamento</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mantenha a comunidade informada sobre a situação deste relato.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(['pending', 'in_progress', 'resolved'] as PostStatus[]).map(status => (
                <button key={status} type="button" onClick={() => void handleStatusChange(status)} disabled={post.status === status || updatingStatus !== null} className={`min-h-11 rounded-xl px-2 py-2 text-[11px] sm:text-xs font-bold transition-all ${post.status === status ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-emerald-400'} disabled:opacity-70`}>
                  {updatingStatus === status ? 'Salvando...' : lifecycleLabels[status]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleSupport} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${supported ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            <Heart className={supported ? 'w-5 h-5 fill-current' : 'w-5 h-5'} /> Apoiar {post.supports > 0 ? `(${post.supports})` : ''}
          </button>
          <button onClick={() => document.getElementById('post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs sm:text-sm font-bold transition-all">
            <MessageSquare className="w-5 h-5" /> <span>Comentar <span className="hidden sm:inline">{post.commentsCount > 0 ? `(${post.commentsCount})` : ''}</span></span>
          </button>
          <button type="button" onClick={() => void handleShare()} className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs sm:text-sm font-bold transition-all hover:bg-blue-100 dark:hover:bg-blue-500/20">
            <Share2 className="w-5 h-5" /> Compartilhar
          </button>
          <button type="button" onClick={() => post && void toggleSavedPost(post.id)} className={cn('flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all', post && isPostSaved(post.id) ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300')} aria-pressed={post ? isPostSaved(post.id) : false}>
            <Bookmark className={cn('w-5 h-5', post && isPostSaved(post.id) && 'fill-current')} /> {post && isPostSaved(post.id) ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2"><Clock3 className="w-5 h-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Histórico do relato</h2></div>
            <p className="text-xs text-slate-500 mt-1">As mudanças de situação ficam registradas para dar mais transparência ao acompanhamento.</p>
          </div>
        </div>
        {statusHistory.length === 0 ? (
          <p className="text-sm text-slate-400">Ainda não há mudanças registradas.</p>
        ) : (
          <div className="space-y-0">
            {statusHistory.map((item, index) => (
              <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < statusHistory.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />}
                <span className={`relative mt-1 w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-slate-900 shrink-0 ${lifecycleClasses[item.new_status]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{lifecycleLabels[item.new_status]}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(item.changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card id="post-comments" className="scroll-mt-24">
        <div className="flex items-center gap-2 mb-4"><MessageSquare className="w-5 h-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Comentários</h2></div>
        <div className="space-y-3">
          {commentsLoading ? (
            <p className="text-sm text-slate-400">Carregando comentários...</p>
          ) : rootComments.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum comentário ainda.</p>
          ) : (
            rootComments.map(comment => (
              <ThreadComment
                key={comment.id}
                comment={comment}
                allComments={postComments}
                replyingTo={replyingTo}
                onReply={selected => {
                  if (!isAuthenticated) { navigate('/login'); return; }
                  setReplyingTo(current => current === selected.id ? null : selected.id);
                }}
                onDelete={commentId => void handleDeleteComment(commentId)}
                deletingComment={deletingComment}
                currentUserId={user?.id}
                postAuthorId={post.authorId}
              />
            ))
          )}
        </div>

        {replyingTo && replyTarget && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CornerDownRight className="w-4 h-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Respondendo a <strong>{replyTarget.authorName}</strong></span>
            <button type="button" onClick={() => setReplyingTo(null)} className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20" aria-label="Cancelar resposta"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleComment(); } }}
            placeholder={!isAuthenticated ? 'Entre na sua conta para comentar' : replyingTo && replyTarget ? `Responder a ${replyTarget.authorName}...` : 'Escreva um comentário...'}
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <button onClick={() => void handleComment()} disabled={!commentText.trim()} className="p-2.5 rounded-xl bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700"><Send className="w-5 h-5" /></button>
        </div>
      </Card>

      {selectedImage && (
        <div className="fixed inset-0 z-[120] bg-black/90 p-4 sm:p-8 flex items-center justify-center" onClick={() => setSelectedImage(null)}>
          <button type="button" onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white" aria-label="Fechar imagem"><X className="w-6 h-6" /></button>
          <img src={selectedImage} alt="Imagem ampliada do relato" className="max-w-full max-h-full object-contain rounded-xl" decoding="async" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
