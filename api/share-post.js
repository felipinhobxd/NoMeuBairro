import { startRequestLog } from '../server/structuredLog.js';

const categoryLabels = {
  buraco: 'Buraco e pavimentação',
  iluminacao: 'Iluminação pública',
  fios: 'Fios e energia',
  saneamento: 'Água e saneamento',
  limpeza: 'Limpeza urbana',
  transporte: 'Transporte',
  seguranca: 'Segurança',
  outros: 'Relato comunitário',
};

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function requestOrigin(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'nomeubairro.vercel.app').split(',')[0].trim();
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) ? forwardedHost : 'nomeubairro.vercel.app';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const protocol = forwardedProto === 'http' ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  startRequestLog(req, res, '/api/share-post');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) return res.status(503).end();

  try {
    const params = new URLSearchParams({
      id: `eq.${id}`,
      select: 'id,title,description,image_url,location,neighborhood,category',
      limit: '1',
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/posts?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return res.status(502).end();
    const rows = await response.json();
    const post = rows?.[0];
    if (!post) return res.status(404).end();

    const origin = requestOrigin(req);
    const shareUrl = `${origin}/relato/${id}`;
    const appUrl = `${origin}/#/post/${id}`;
    const title = cleanText(post.title, 90) || 'Relato comunitário';
    const area = cleanText(post.neighborhood || post.location, 80);
    const category = categoryLabels[post.category] || categoryLabels.outros;
    const summary = cleanText(post.description, 220) || `${category}${area ? ` em ${area}` : ''}.`;
    const imageUrl = post.image_url ? `${origin}/api/post-image?id=${encodeURIComponent(id)}` : `${origin}/logo.png`;
    const pageTitle = `${title} · No Meu Bairro`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    return res.status(200).send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(summary)}">
    <link rel="canonical" href="${escapeHtml(shareUrl)}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="No Meu Bairro">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(summary)}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:alt" content="Imagem do relato ${escapeHtml(title)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(summary)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}">
    <style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:1.5rem;color:#0f172a}a{color:#047857;font-weight:700}</style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(summary)}</p>
    <p><a href="${escapeHtml(appUrl)}">Abrir relato no No Meu Bairro</a></p>
  </body>
</html>`);
  } catch {
    return res.status(500).end();
  }
}
