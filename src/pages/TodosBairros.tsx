import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Search, ShieldAlert, MessageSquare, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, EmptyState, StatusBadge, CategoryBadge } from '../components/UI';
import { supabase } from '../utils/supabase';
import { curitibaNeighborhoods } from '../contexts/NeighborhoodContext';
import type { Post } from '../types';

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPostNeighborhood(post: Post) {
  if (typeof post.latitude === 'number' && typeof post.longitude === 'number') {
    return curitibaNeighborhoods.reduce((nearest, neighborhood) => {
      if (!nearest) return neighborhood;
      const currentDistance = distanceKm(post.latitude!, post.longitude!, neighborhood.latitude, neighborhood.longitude);
      const nearestDistance = distanceKm(post.latitude!, post.longitude!, nearest.latitude, nearest.longitude);
      return currentDistance < nearestDistance ? neighborhood : nearest;
    }, curitibaNeighborhoods[0])?.name;
  }

  const normalizedLocation = (post.location || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return curitibaNeighborhoods.find(n => {
    const normalizedName = n.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalizedLocation.includes(normalizedName);
  })?.name;
}

export default function TodosBairros() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('posts')
        .select('*, users(name, avatar_url)')
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setPosts((data || []).map((p: any) => ({
        id: p.id,
        authorId: p.author_id || 'anonymous',
        authorName: p.is_anonymous ? 'Denúncia Anônima' : (p.users?.name || 'Morador'),
        authorAvatarUrl: p.is_anonymous ? undefined : p.users?.avatar_url,
        category: p.category,
        status: p.status,
        title: p.title,
        description: p.description,
        imageUrl: p.image_url,
        location: p.location,
        latitude: p.latitude,
        longitude: p.longitude,
        supports: p.post_supports?.[0]?.count ?? 0,
        commentsCount: p.comments_count ?? 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })));
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => `${p.title} ${p.description} ${p.location} ${p.authorName} ${getPostNeighborhood(p) || ''}`.toLowerCase().includes(q));
  }, [posts, query]);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 transition-colors" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Todos os bairros</h1>
          <p className="text-sm text-slate-500 mt-1">Problemas, notícias e relatos publicados em Curitiba.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar em todos os bairros..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando relatos...</div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={MessageSquare} title="Nenhum relato encontrado" description={query ? 'Tente outra busca.' : 'Ainda não há relatos disponíveis para todos os bairros.'} /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const anonymous = post.authorId === 'anonymous';
            const neighborhood = getPostNeighborhood(post);
            return (
              <Card key={post.id}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {anonymous ? <ShieldAlert className="w-5 h-5 text-red-500" /> : post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-slate-900 dark:text-white">{post.title}</h2>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-1">{post.authorName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line">{post.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <CategoryBadge category={post.category} />
                      {neighborhood && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <MapPin className="w-3 h-3" /> {neighborhood}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3 h-3" />{post.location}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                      >
                        Ver post <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
