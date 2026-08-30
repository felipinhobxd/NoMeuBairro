import { Award, CalendarDays, CheckCircle2, ChevronDown, Heart, MessageSquare } from 'lucide-react';
import { Card } from './UI';
import { cn } from '../utils/cn';
import { communityBadges, getCommunityBadgeProgress, type CommunityContributionSummary } from '../utils/communityBadges';

export function ContributionStats({ summary, owner = false }: { summary: CommunityContributionSummary; owner?: boolean }) {
  const stats = [
    { icon: MessageSquare, value: summary.postsCount, label: 'Relatos', color: 'text-emerald-600 dark:text-emerald-400' },
    { icon: CheckCircle2, value: summary.resolvedCount, label: 'Resolvidos', color: 'text-teal-600 dark:text-teal-400' },
    { icon: Heart, value: owner ? summary.supportsGiven : summary.supportsReceived, label: owner ? 'Apoios dados' : 'Apoios recebidos', color: 'text-rose-600 dark:text-rose-400' },
    { icon: CalendarDays, value: owner ? summary.eventsAttended : summary.eventsCount, label: owner ? 'Participações' : 'Eventos', color: 'text-blue-600 dark:text-blue-400' },
  ];
  return (
    <dl className="nmb-profile-stats" aria-label="Contribuições na comunidade">
      {stats.map(({ icon: Icon, value, label, color }) => (
        <div key={label} className="nmb-profile-stat">
          <Icon className={cn('w-5 h-5', color)} aria-hidden="true" />
          <dt>{label}</dt><dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContributionBadges({ summary, earnedBadges, owner = false }: {
  summary: CommunityContributionSummary;
  earnedBadges: readonly string[];
  owner?: boolean;
}) {
  const badges = communityBadges.filter(badge => owner || earnedBadges.includes(badge.key));
  const renderBadge = (badge: typeof communityBadges[number]) => {
    const earned = earnedBadges.includes(badge.key);
    const progress = getCommunityBadgeProgress(badge, summary);
    return (
      <li key={badge.key} className={cn('nmb-profile-badge', earned && 'nmb-profile-badge-earned')}>
        <span className={cn('nmb-profile-badge-icon', !earned && 'grayscale opacity-60')} aria-hidden="true">{badge.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">{badge.name}</p>
          <p className="nmb-profile-badge-description">{badge.desc}</p>
          {owner && !earned && <div className="nmb-profile-badge-progress"><progress max={1} value={progress.ratio} aria-label={`Progresso do selo ${badge.name}`} /><span>{progress.text}</span></div>}
        </div>
        {earned && <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Conquistado" />}
      </li>
    );
  };

  return (
    <Card className="nmb-profile-badges">
      <div className="flex items-center justify-between gap-2">
        <h2 className="nmb-profile-section-title"><Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />Selos de contribuição</h2>
        <span className="text-xs text-slate-500">{earnedBadges.length}{owner ? `/${communityBadges.length}` : ''}</span>
      </div>
      <p className="nmb-profile-section-description">Reconhecimentos pela participação comunitária, sem ranking entre moradores.</p>
      {badges.length ? <ul className="nmb-profile-badge-list">{badges.slice(0, 3).map(renderBadge)}</ul> : <p className="text-xs mt-3 text-slate-500">Ainda não possui selos públicos.</p>}
      {badges.length > 3 && <details className="nmb-profile-more-badges"><summary>Ver todos os selos ({badges.length})<ChevronDown className="w-4 h-4 nmb-disclosure-arrow" /></summary><ul className="nmb-profile-badge-list">{badges.slice(3).map(renderBadge)}</ul></details>}
    </Card>
  );
}
