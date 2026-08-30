import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import {
  MessageSquare, Heart,
  ArrowLeft, ShieldAlert,
  MapPin, Loader2,
} from 'lucide-react';
import { Card, Button, StatusBadge, CategoryBadge, timeAgo } from '../components/UI';
import ProfileSections from '../components/ProfileSections';
import { ContributionBadges, ContributionStats } from '../components/ProfileContribution';
import { EMPTY_COMMUNITY_CONTRIBUTION, getEarnedCommunityBadges, normalizeCommunityContribution, type CommunityContributionSummary } from '../utils/communityBadges';

type PublicPost = {
  id: string;
  category: string;
  status: string;
  title: string;
  description: string;
  location: string;
  neighborhood?: string;
  locality?: string;
  supports: number;
  createdAt: string;
};

type PublicStats = CommunityContributionSummary & { earnedBadges: string[]; posts: PublicPost[] };

const EMPTY_STATS: PublicStats = { ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [], posts: [] };

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [stats, setStats] = useState<PublicStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [profileResult, summaryResult, postsResult] = await Promise.all([
          supabase.from('public_user_profiles').select('id,name,avatar_url,reputation,created_at').eq('id', userId).maybeSingle(),
          supabase.rpc('get_community_contribution_summary', { p_user_id: userId }),
          supabase
            .from('posts')
            .select('id,category,status,title,description,location,neighborhood,locality,created_at,post_supports(count)')
            .eq('author_id', userId)
            .eq('is_anonymous', false)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);

        if (!active) return;
        if (profileResult.error || !profileResult.data) {
          setProfileUser(null);
          setStats(EMPTY_STATS);
          return;
        }

        setProfileUser(profileResult.data);
        const summary = normalizeCommunityContribution(summaryResult.data);
        const earnedBadges = getEarnedCommunityBadges(summary);
        const posts: PublicPost[] = (postsResult.data || []).map((post: any) => ({
          id: post.id,
          category: post.category,
          status: post.status,
          title: post.title,
          description: post.description,
          location: post.location || '',
          neighborhood: post.neighborhood || undefined,
          locality: post.locality || undefined,
          supports: post.post_supports?.[0]?.count ?? 0,
          createdAt: post.created_at,
        }));
        setStats({ ...summary, earnedBadges, posts });
      } catch (err) {
        console.error('Erro ao carregar perfil público:', err);
        if (active) {
          setProfileUser(null);
          setStats(EMPTY_STATS);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando perfil...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Usuário não encontrado</h2>
        <p className="text-sm text-slate-500 mt-2">Este perfil não está disponível.</p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const displayName = typeof profileUser.name === 'string' && profileUser.name.trim() ? profileUser.name.trim() : 'Morador';

  return (
    <div className="nmb-profile animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>

      <Card className="nmb-profile-header">
        <div className="nmb-profile-identity">
          <div className="nmb-profile-avatar w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-600/20">
            {profileUser.avatar_url ? <img src={profileUser.avatar_url} alt={displayName} className="w-full h-full object-cover" decoding="async" /> : displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="nmb-profile-name text-lg font-bold text-slate-900 dark:text-white">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span className="text-xs text-slate-400">Morador do bairro</span><span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-400">Ativo desde {profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : 'recentemente'}</span>
            </div>
          </div>
        </div>
      </Card>

      <ContributionStats summary={stats} />
      <ProfileSections
        activityLabel="Relatos públicos"
        information={<ContributionBadges summary={stats} earnedBadges={stats.earnedBadges} />}
        activity={
      <div className="nmb-profile-posts space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 px-1"><MessageSquare className="w-4 h-4 text-emerald-500" /> Relatos Públicos</h2>
        {stats.posts.length === 0 ? <Card className="text-center py-12"><p className="text-sm text-slate-400 italic">Nenhum relato publicado ainda.</p></Card> : stats.posts.map(post => {
          const area = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;
          return (
            <Link key={post.id} to={`/post/${post.id}`} className="nmb-profile-post-link" aria-label={`Abrir relato: ${post.title}`}>
            <Card className="nmb-profile-post animate-card-enter">
              <div className="nmb-profile-post-meta"><div className="flex flex-wrap items-center gap-2"><CategoryBadge category={post.category} /><span className="text-[10px] text-slate-400">{timeAgo(post.createdAt)}</span></div><StatusBadge status={post.status} /></div>
              <h3 className="nmb-profile-post-title text-base font-semibold text-slate-900 dark:text-white mb-1">{post.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{post.description}</p>
              <div className="nmb-profile-post-footer flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {area && <span className="flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-300"><MapPin className="w-3 h-3" />{area}</span>}
                {post.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{post.location}</span>}
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500 fill-rose-500" />{post.supports} apoios</span>
              </div>
            </Card>
            </Link>
          );
        })}
      </div>}
      />
    </div>
  );
}
