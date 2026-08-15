import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, StatusBadge, CategoryBadge, EmptyState, timeAgo } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase } from '../utils/supabase';
import type { Post } from '../types';

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { supportPost, addComment, commentsByPost, fetchData } = useData();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!postId) return;
      const { data } = await supabase
        .from('posts')
        .select('*, users(name, avatar_url), post_supports(count)')
        .eq('id', postId)
        .maybeSingle();
      if (!mounted) return;
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
          imageUrl: data.image_url,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          supports: data.post_supports?.[0]?.count ?? 0,
          commentsCount: data.comments_count ?? 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
      setLoading(false);
      await fetchData();
      if (user && postId) {
        const { data: mine } = await supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
        if (mounted) setSupported(!!mine);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [postId, user, fetchData]);

  const handleSupport = async () => {
    if (!postId) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    await supportPost(postId);
    setSupported(v => !v);
    setPost(prev => prev ? { ...prev, supports: Math.max(0, prev.supports + (supported ? -1 : 1)) } : prev);
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!postId || !text) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    await addComment(postId, text);
    setCommentText('');
    await fetchData();
  };

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando post...</div>;
  if (!post) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card><EmptyState title="Post não encontrado" description="Esse post pode ter sido excluído ou não está mais disponível." /></Card>
    </div>
  );

  const anonymous = post.authorId === 'anonymous';
  const postComments = commentsByPost[post.id] ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden">
            {anonymous ? <ShieldAlert className="w-5 h-5 text-red-500" /> : post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-emerald-600">{post.authorName.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className={anonymous ? 'text-sm font-semibold text-red-600 dark:text-red-400' : 'text-sm font-semibold text-slate-900 dark:text-white'}>{post.authorName}</p>
            <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
          </div>
          <StatusBadge status={post.status} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-5">{post.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line leading-relaxed">{post.description}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="" className="mt-4 w-full max-h-[520px] object-cover rounded-2xl" />}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <CategoryBadge category={post.category} />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" /> {post.location}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleSupport} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${supported ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            <Heart className={supported ? 'w-5 h-5 fill-current' : 'w-5 h-5'} /> Apoiar {post.supports > 0 ? `(${post.supports})` : ''}
          </button>
          <button onClick={() => document.getElementById('post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-sm font-bold transition-all">
            <MessageSquare className="w-5 h-5" /> Comentar {postComments.length > 0 ? `(${postComments.length})` : ''}
          </button>
        </div>
      </Card>

      <Card id="post-comments" className="scroll-mt-24">
        <div className="flex items-center gap-2 mb-4"><MessageSquare className="w-5 h-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Comentários</h2></div>
        <div className="space-y-3">
          {postComments.length === 0 ? <p className="text-sm text-slate-400">Nenhum comentário ainda.</p> : postComments.map(comment => <div key={comment.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-900 dark:text-white">{comment.authorName}</span><span className="text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span></div><p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{comment.content}</p></div>)}
        </div>
        <div className="mt-4 flex items-start gap-2">
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleComment(); } }} placeholder={isAuthenticated ? 'Escreva um comentário...' : 'Entre na sua conta para comentar'} rows={2} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          <button onClick={() => void handleComment()} disabled={!commentText.trim()} className="p-2.5 rounded-xl bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700"><Send className="w-5 h-5" /></button>
        </div>
      </Card>
    </div>
  );
}
