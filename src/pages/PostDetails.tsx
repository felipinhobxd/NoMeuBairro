import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, StatusBadge, CategoryBadge, EmptyState, timeAgo } from '../components/UI';
import { supabase } from '../utils/supabase';
import type { Post } from '../types';

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!postId) return;
      const { data } = await supabase
        .from('posts')
        .select('*, users(name, avatar_url)')
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
    };
    void load();
    return () => { mounted = false; };
  }, [postId]);

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando post...</div>;
  if (!post) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card><EmptyState title="Post não encontrado" description="Esse post pode ter sido excluído ou não está mais disponível." /></Card>
    </div>
  );

  const anonymous = post.authorId === 'anonymous';
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
      </Card>
    </div>
  );
}
