import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare, Heart, Award, CheckCircle2,
  Store, CalendarDays, ArrowLeft, ShieldAlert,
  MapPin, Clock
} from 'lucide-react';
import { Card, Button, StatusBadge, CategoryBadge, timeAgo } from '../components/UI';
import { cn } from '../utils/cn';

const allBadges = [
  { key: 'vizinho_engajado', name: 'Vizinho Engajado', desc: '10 relatos criados', emoji: '🏅' },
  { key: 'guardiao', name: 'Guardião do Bairro', desc: '25 relatos criados', emoji: '🛡️' },
  { key: 'voz_ativa', name: 'Voz Ativa', desc: '50 apoios recebidos', emoji: '📢' },
  { key: 'construtor', name: 'Construtor', desc: 'Primeiro relato resolvido', emoji: '🏗️' },
  { key: 'embaixador', name: 'Embaixador', desc: '100 interações', emoji: '⭐' },
];

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { posts, businesses, events } = useData();
  const { user: currentUser } = useAuth();

  // In a real Supabase app, we would fetch the user by ID.
  // Here we simulate it by finding the user in the posts or businesses they created.
  // Or we could have a list of users in DataContext.
  const profileUser = useMemo(() => {
    // If it's the current user, we already have their data
    if (currentUser?.id === userId) return currentUser;

    // Otherwise find an item they created to extract their name
    const post = posts.find(p => p.authorId === userId);
    if (post) return { id: post.authorId, name: post.authorName, avatarUrl: post.authorAvatarUrl, createdAt: post.createdAt };

    return null;
  }, [userId, posts, currentUser]);

  const stats = useMemo(() => {
    const userPosts = posts.filter(p => p.authorId === userId);
    const userBiz = businesses.filter(b => b.createdBy === userId);
    const userEvents = events.filter(e => e.createdBy === userId);
    const supportsReceived = userPosts.reduce((sum, p) => sum + p.supports, 0);
    const totalComments = userPosts.reduce((sum, p) => sum + p.commentsCount, 0);

    const earned: string[] = [];
    if (userPosts.length >= 10) earned.push('vizinho_engajado');
    if (userPosts.length >= 25) earned.push('guardiao');
    if (supportsReceived >= 50) earned.push('voz_ativa');
    if (userPosts.some(p => p.status === 'resolved')) earned.push('construtor');
    if (userPosts.length + totalComments >= 100) earned.push('embaixador');

    return {
      posts: userPosts,
      count: userPosts.length,
      bizCount: userBiz.length,
      evCount: userEvents.length,
      supportsReceived,
      earnedBadges: earned
    };
  }, [userId, posts, businesses, events]);

  if (!profileUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Usuário não encontrado</h2>
        <p className="text-sm text-slate-500 mt-2">Este perfil pode ser privado ou não existe.</p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-600/20">
            {profileUser.avatarUrl ? (
              <img src={profileUser.avatarUrl} alt={profileUser.name} className="w-full h-full object-cover" />
            ) : (
              profileUser.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{profileUser.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-400">
                Morador do Vitória Régia
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-400">
                Ativo há {timeAgo(profileUser.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MessageSquare, value: stats.count, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { icon: Heart, value: stats.supportsReceived, label: 'Apoios', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' },
          { icon: Store, value: stats.bizCount, label: 'Negócios', iconCls: 'text-violet-600 dark:text-violet-400', bgCls: 'bg-violet-50 dark:bg-violet-500/10' },
          { icon: CalendarDays, value: stats.evCount, label: 'Eventos', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' },
        ].map(({ icon: Icon, value, label, iconCls, bgCls }) => (
          <Card key={label} className="text-center !p-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', bgCls)}>
              <Icon className={cn('w-5 h-5', iconCls)} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-[11px] text-slate-500 font-medium">{label}</p>
          </Card>
        ))}
      </div>

      {/* Badges */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" /> Conquistas de {profileUser.name.split(' ')[0]}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allBadges.map(badge => {
            const earned = stats.earnedBadges.includes(badge.key);
            if (!earned) return null;
            return (
              <div key={badge.key} className="flex flex-col items-center gap-2 p-3 rounded-xl text-center bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20">
                <span className="text-2xl">{badge.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{badge.name}</p>
                  <p className="text-[10px] text-slate-500">{badge.desc}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-amber-500" />
              </div>
            );
          })}
          {stats.earnedBadges.length === 0 && (
            <p className="col-span-full text-xs text-slate-400 text-center py-4 italic">Ainda não possui selos públicos.</p>
          )}
        </div>
      </Card>

      {/* Public Posts */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 px-1">
          <MessageSquare className="w-4 h-4 text-emerald-500" /> Relatos Públicos
        </h3>
        {stats.posts.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-sm text-slate-400 italic">Nenhum relato publicado ainda.</p>
          </Card>
        ) : (
          stats.posts.map(post => (
            <Card key={post.id} className="animate-card-enter">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={post.category} />
                  <span className="text-[10px] text-slate-400">{timeAgo(post.createdAt)}</span>
                </div>
                <StatusBadge status={post.status} />
              </div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{post.title}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">{post.description}</p>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{post.location}</span>
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500 fill-rose-500" />{post.supports} apoios</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
