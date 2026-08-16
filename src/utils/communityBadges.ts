export const communityBadges = [
  { key: 'primeiro_relato', name: 'Primeira Voz', desc: 'Publicou o primeiro relato', emoji: '📍' },
  { key: 'vizinho_engajado', name: 'Vizinho Engajado', desc: 'Publicou 5 relatos', emoji: '🏅' },
  { key: 'voz_ativa', name: 'Voz Ativa', desc: 'Recebeu 5 apoios', emoji: '📢' },
  { key: 'construtor', name: 'Construtor', desc: 'Teve um relato resolvido', emoji: '🏗️' },
  { key: 'organizador', name: 'Organizador', desc: 'Publicou um evento', emoji: '📅' },
] as const;

export function getEarnedCommunityBadges(input: {
  posts: Array<{ status?: string }>;
  supportsReceived: number;
  eventsCount: number;
}) {
  const earned: string[] = [];
  if (input.posts.length >= 1) earned.push('primeiro_relato');
  if (input.posts.length >= 5) earned.push('vizinho_engajado');
  if (input.supportsReceived >= 5) earned.push('voz_ativa');
  if (input.posts.some((post) => post.status === 'resolved')) earned.push('construtor');
  if (input.eventsCount >= 1) earned.push('organizador');
  return earned;
}
