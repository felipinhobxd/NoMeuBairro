export type CommunityContributionSummary = {
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
