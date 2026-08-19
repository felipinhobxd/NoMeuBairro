export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) return res.status(503).end();

  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=image_url&limit=1`, { headers });
    if (!response.ok) return res.status(502).end();
    const rows = await response.json();
    const imageUrl = rows?.[0]?.image_url;
    if (!imageUrl) return res.status(404).end();

    if (/^https?:\/\//i.test(imageUrl)) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
      return res.redirect(307, imageUrl);
    }

    let imageData = String(imageUrl);
    if (imageData.startsWith('/api/post-image')) {
      const legacyResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_legacy_post_image`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_post_id: id }),
      });
      if (!legacyResponse.ok) return res.status(404).end();
      imageData = await legacyResponse.json();
      if (!imageData) return res.status(404).end();
    }

    const match = imageData.match(/^data:([^;,]+)?;base64,(.+)$/);
    if (!match) return res.status(404).end();
    const mime = String(match[1] || 'image/jpeg').toLowerCase();
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMimes.has(mime)) return res.status(415).end();
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 5 * 1024 * 1024) return res.status(413).end();
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    return res.status(200).send(bytes);
  } catch {
    return res.status(500).end();
  }
}
