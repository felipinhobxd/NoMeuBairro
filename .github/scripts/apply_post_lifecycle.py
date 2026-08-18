from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


# Shared, non-competitive contribution badges.
badges = r'''export type CommunityContributionSummary = {
  postsCount: number;
  resolvedCount: number;
  supportsReceived: number;
  supportsGiven: number;
  commentsCount: number;
  repliesCount: number;
  eventsCount: number;
  eventsAttended: number;
};

export const EMPTY_COMMUNITY_CONTRIBUTION: CommunityContributionSummary = {
  postsCount: 0,
  resolvedCount: 0,
  supportsReceived: 0,
  supportsGiven: 0,
  commentsCount: 0,
  repliesCount: 0,
  eventsCount: 0,
  eventsAttended: 0,
};

export const communityBadges = [
  { key: 'primeiro_relato', name: 'Primeira Voz', desc: 'Publicou o primeiro relato', emoji: '📍', target: 1, metric: 'postsCount' },
  { key: 'vizinho_engajado', name: 'Vizinho Engajado', desc: 'Publicou 5 relatos comunitários', emoji: '🏅', target: 5, metric: 'postsCount' },
  { key: 'voz_ativa', name: 'Voz Ativa', desc: 'Recebeu 5 apoios em relatos', emoji: '📢', target: 5, metric: 'supportsReceived' },
  { key: 'construtor', name: 'Construtor', desc: 'Teve um relato marcado como resolvido', emoji: '🏗️', target: 1, metric: 'resolvedCount' },
  { key: 'solucionador', name: 'Transformação Local', desc: 'Chegou a 3 relatos resolvidos', emoji: '🌱', target: 3, metric: 'resolvedCount' },
  { key: 'organizador', name: 'Organizador', desc: 'Publicou um evento comunitário', emoji: '📅', target: 1, metric: 'eventsCount' },
  { key: 'mao_amiga', name: 'Mão Amiga', desc: 'Contribuiu em 5 comentários', emoji: '🤝', target: 5, metric: 'commentsCount' },
  { key: 'boa_conversa', name: 'Boa Conversa', desc: 'Respondeu vizinhos em 3 conversas', emoji: '💬', target: 3, metric: 'repliesCount' },
  { key: 'apoio_comunitario', name: 'Apoio Comunitário', desc: 'Apoiou 10 relatos de outras pessoas', emoji: '❤️', target: 10, metric: 'supportsGiven' },
  { key: 'presenca_local', name: 'Presença Local', desc: 'Confirmou presença em 3 eventos', emoji: '🙌', target: 3, metric: 'eventsAttended' },
] as const;

export type CommunityBadgeKey = typeof communityBadges[number]['key'];

export function normalizeCommunityContribution(value: any): CommunityContributionSummary {
  return {
    postsCount: Number(value?.postsCount ?? value?.postscount ?? 0),
    resolvedCount: Number(value?.resolvedCount ?? value?.resolvedcount ?? 0),
    supportsReceived: Number(value?.supportsReceived ?? value?.supportsreceived ?? 0),
    supportsGiven: Number(value?.supportsGiven ?? value?.supportsgiven ?? 0),
    commentsCount: Number(value?.commentsCount ?? value?.commentscount ?? 0),
    repliesCount: Number(value?.repliesCount ?? value?.repliescount ?? 0),
    eventsCount: Number(value?.eventsCount ?? value?.eventscount ?? 0),
    eventsAttended: Number(value?.eventsAttended ?? value?.eventsattended ?? 0),
  };
}

export function getEarnedCommunityBadges(summary: CommunityContributionSummary) {
  return communityBadges
    .filter((badge) => Number(summary[badge.metric]) >= badge.target)
    .map((badge) => badge.key);
}

export function getCommunityBadgeProgress(
  badge: typeof communityBadges[number],
  summary: CommunityContributionSummary,
) {
  const current = Number(summary[badge.metric]);
  const complete = current >= badge.target;
  return {
    current,
    target: badge.target,
    complete,
    ratio: Math.min(1, badge.target > 0 ? current / badge.target : 1),
    text: complete ? 'Conquistado' : `${Math.min(current, badge.target)}/${badge.target}`,
  };
}
'''
write('src/utils/communityBadges.ts', badges)

# Own profile.
path = 'src/pages/Profile.tsx'
text = read(path)
text = replace_once(
    text,
    "import { communityBadges, getEarnedCommunityBadges } from '../utils/communityBadges';",
    "import { communityBadges, EMPTY_COMMUNITY_CONTRIBUTION, getCommunityBadgeProgress, getEarnedCommunityBadges, normalizeCommunityContribution, type CommunityContributionSummary } from '../utils/communityBadges';",
    'Profile badge imports',
)
text = replace_once(
    text,
    "type ProfileStats = { myPosts: number; myEvents: number; supportsReceived: number; earnedBadges: string[] };",
    "type ProfileStats = CommunityContributionSummary & { earnedBadges: string[] };",
    'Profile stats type',
)
text = replace_once(
    text,
    "  const [stats, setStats] = useState<ProfileStats>({ myPosts: 0, myEvents: 0, supportsReceived: 0, earnedBadges: [] });",
    "  const [stats, setStats] = useState<ProfileStats>({ ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [] });",
    'Profile initial stats',
)
old_effect = re.compile(r"  useEffect\(\(\) => \{\n    let active = true;\n    if \(!user\?\.id\) \{\n      setStats\(\{ myPosts: 0, myEvents: 0, supportsReceived: 0, earnedBadges: \[\] \}\);.*?\n  \}, \[user\?\.id\]\);", re.S)
new_effect = """  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setStats({ ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [] });
      return () => { active = false; };
    }

    void supabase.rpc('get_community_contribution_summary', { p_user_id: user.id }).then(({ data, error }) => {
      if (!active || error || !data) return;
      const summary = normalizeCommunityContribution(data);
      setStats({ ...summary, earnedBadges: getEarnedCommunityBadges(summary) });
    });

    return () => { active = false; };
  }, [user?.id]);"""
text, count = old_effect.subn(new_effect, text, count=1)
if count != 1:
    raise RuntimeError(f'Profile stats effect: expected 1 block, found {count}')
text = replace_once(
    text,
    "      <div className=\"grid grid-cols-1 sm:grid-cols-3 gap-3\">\n        {[{ icon: MessageSquare, value: stats.myPosts, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' }, { icon: Heart, value: stats.supportsReceived, label: 'Apoios recebidos', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' }, { icon: CalendarDays, value: stats.myEvents, label: 'Eventos', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' }].map(({ icon: Icon, value, label, iconCls, bgCls }) => (",
    "      <div className=\"grid grid-cols-2 sm:grid-cols-4 gap-3\">\n        {[{ icon: MessageSquare, value: stats.postsCount, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' }, { icon: CheckCircle2, value: stats.resolvedCount, label: 'Resolvidos', iconCls: 'text-teal-600 dark:text-teal-400', bgCls: 'bg-teal-50 dark:bg-teal-500/10' }, { icon: Heart, value: stats.supportsGiven, label: 'Apoios dados', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' }, { icon: CalendarDays, value: stats.eventsAttended, label: 'Participações', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' }].map(({ icon: Icon, value, label, iconCls, bgCls }) => (",
    'Profile contribution cards',
)
old_badge_map = """          {communityBadges.map(badge => { const earned = stats.earnedBadges.includes(badge.key); return <div key={badge.key} className={cn('flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all', earned ? 'bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-800 opacity-50')}><span className=\"text-2xl\">{earned ? badge.emoji : '🔒'}</span><div><p className=\"text-xs font-semibold text-slate-900 dark:text-white\">{badge.name}</p><p className=\"text-[10px] text-slate-500\">{badge.desc}</p></div>{earned && <CheckCircle2 className=\"w-4 h-4 text-amber-500\" />}</div>; })}"""
new_badge_map = """          {communityBadges.map(badge => { const earned = stats.earnedBadges.includes(badge.key); const progress = getCommunityBadgeProgress(badge, stats); return <div key={badge.key} className={cn('flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all', earned ? 'bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-800/70 ring-1 ring-slate-100 dark:ring-slate-700')}><span className={cn('text-2xl', !earned && 'grayscale opacity-45')}>{badge.emoji}</span><div><p className=\"text-xs font-semibold text-slate-900 dark:text-white\">{badge.name}</p><p className=\"text-[10px] text-slate-500 min-h-7\">{badge.desc}</p></div>{earned ? <span className=\"inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400\"><CheckCircle2 className=\"w-3.5 h-3.5\" /> Conquistado</span> : <div className=\"w-full\"><div className=\"h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden\"><div className=\"h-full rounded-full bg-emerald-500 transition-all\" style={{ width: `${Math.round(progress.ratio * 100)}%` }} /></div><p className=\"mt-1 text-[9px] font-bold text-slate-400\">Progresso {progress.text}</p></div>}</div>; })}"""
text = replace_once(text, old_badge_map, new_badge_map, 'Profile badge progress')
text = replace_once(
    text,
    "        <div className=\"flex items-center justify-between mb-4\"><h3 className=\"text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2\"><Award className=\"w-4 h-4 text-amber-500\" /> Selos e Conquistas</h3><span className=\"text-xs text-slate-400\">{stats.earnedBadges.length}/{communityBadges.length}</span></div>",
    "        <div className=\"flex items-start justify-between gap-3 mb-4\"><div><h3 className=\"text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2\"><Award className=\"w-4 h-4 text-amber-500\" /> Selos de contribuição</h3><p className=\"text-[11px] text-slate-500 mt-1\">Reconhecimentos por ações comunitárias — sem ranking entre moradores.</p></div><span className=\"text-xs text-slate-400 shrink-0\">{stats.earnedBadges.length}/{communityBadges.length}</span></div>",
    'Profile badge heading',
)
write(path, text)

# Public profile.
path = 'src/pages/PublicProfile.tsx'
text = read(path)
text = replace_once(
    text,
    "import { communityBadges, getEarnedCommunityBadges } from '../utils/communityBadges';",
    "import { communityBadges, EMPTY_COMMUNITY_CONTRIBUTION, getEarnedCommunityBadges, normalizeCommunityContribution, type CommunityContributionSummary } from '../utils/communityBadges';",
    'PublicProfile badge imports',
)
text = replace_once(
    text,
    "type PublicStats = {\n  count: number;\n  evCount: number;\n  supportsReceived: number;\n  earnedBadges: string[];\n  posts: PublicPost[];\n};\n\nconst EMPTY_STATS: PublicStats = { count: 0, evCount: 0, supportsReceived: 0, earnedBadges: [], posts: [] };",
    "type PublicStats = CommunityContributionSummary & { earnedBadges: string[]; posts: PublicPost[] };\n\nconst EMPTY_STATS: PublicStats = { ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [], posts: [] };",
    'PublicProfile stats type',
)
text = replace_once(
    text,
    "          supabase.rpc('get_community_profile_summary', { p_user_id: userId }).maybeSingle(),",
    "          supabase.rpc('get_community_contribution_summary', { p_user_id: userId }),",
    'PublicProfile contribution RPC',
)
old_summary = """        const summary = summaryResult.data;
        const count = Number(summary?.posts_count || 0);
        const evCount = Number(summary?.events_count || 0);
        const supportsReceived = Number(summary?.supports_received || 0);
        const badgePosts = Array.from({ length: count }, (_, index) => ({ status: index === 0 && summary?.has_resolved ? 'resolved' : 'pending' }));
        const earnedBadges = getEarnedCommunityBadges({ posts: badgePosts, supportsReceived, eventsCount: evCount });"""
new_summary = """        const summary = normalizeCommunityContribution(summaryResult.data);
        const earnedBadges = getEarnedCommunityBadges(summary);"""
text = replace_once(text, old_summary, new_summary, 'PublicProfile summary normalization')
text = replace_once(
    text,
    "        setStats({ count, evCount, supportsReceived, earnedBadges, posts });",
    "        setStats({ ...summary, earnedBadges, posts });",
    'PublicProfile stats assignment',
)
text = replace_once(
    text,
    "      <div className=\"grid grid-cols-1 sm:grid-cols-3 gap-3\">\n        {[\n          { icon: MessageSquare, value: stats.count, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' },\n          { icon: Heart, value: stats.supportsReceived, label: 'Apoios', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' },\n          { icon: CalendarDays, value: stats.evCount, label: 'Eventos', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' },\n        ].map(({ icon: Icon, value, label, iconCls, bgCls }) => (",
    "      <div className=\"grid grid-cols-2 sm:grid-cols-4 gap-3\">\n        {[\n          { icon: MessageSquare, value: stats.postsCount, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' },\n          { icon: CheckCircle2, value: stats.resolvedCount, label: 'Resolvidos', iconCls: 'text-teal-600 dark:text-teal-400', bgCls: 'bg-teal-50 dark:bg-teal-500/10' },\n          { icon: Heart, value: stats.supportsReceived, label: 'Apoios recebidos', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' },\n          { icon: CalendarDays, value: stats.eventsCount, label: 'Eventos', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' },\n        ].map(({ icon: Icon, value, label, iconCls, bgCls }) => (",
    'PublicProfile contribution cards',
)
text = replace_once(
    text,
    "        <h3 className=\"text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2\"><Award className=\"w-4 h-4 text-amber-500\" /> Conquistas de {displayName.split(' ')[0]}</h3>",
    "        <div className=\"mb-4\"><h3 className=\"text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2\"><Award className=\"w-4 h-4 text-amber-500\" /> Selos de contribuição de {displayName.split(' ')[0]}</h3><p className=\"text-[11px] text-slate-500 mt-1\">Reconhecimentos por participação comunitária; não formam um ranking.</p></div>",
    'PublicProfile badge heading',
)
write(path, text)

migration = r'''create or replace function public.get_community_contribution_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select jsonb_build_object(
    'postsCount', (select count(*) from public.posts p where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false),
    'resolvedCount', (select count(*) from public.posts p where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false and p.status = 'resolved'),
    'supportsReceived', (select count(*) from public.post_supports s join public.posts p on p.id = s.post_id where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false),
    'supportsGiven', (select count(*) from public.post_supports s where s.user_id = p_user_id),
    'commentsCount', (select count(*) from public.comments c where c.author_id = p_user_id),
    'repliesCount', (select count(*) from public.comments c where c.author_id = p_user_id and c.parent_id is not null),
    'eventsCount', (select count(*) from public.events e where e.created_by = p_user_id),
    'eventsAttended', (select count(*) from public.event_attendance a where a.user_id = p_user_id)
  );
$$;
revoke all on function public.get_community_contribution_summary(uuid) from public;
grant execute on function public.get_community_contribution_summary(uuid) to anon, authenticated;
'''
write('database/20260817_community_contribution_badges.sql', migration)

print('Community contribution badge upgrade applied successfully.')
