import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const OFFICIAL_NEIGHBORHOODS = [
  'Centro','São Francisco','Centro Cívico','Alto da Glória','Alto da XV','Cristo Rei','Jardim Botânico','Rebouças','Água Verde','Batel','Bigorrilho','Mercês','Bom Retiro','Ahú','Juvevê','Cabral','Hugo Lange','Jardim Social','Tarumã','Capão da Imbuia','Cajuru','Jardim das Américas','Guabirotuba','Prado Velho','Parolin','Guaíra','Portão','Vila Izabel','Seminário','Campina do Siqueira','Vista Alegre','Pilarzinho','São Lourenço','Boa Vista','Bacacheri','Bairro Alto','Uberaba','Hauer','Fanny','Lindóia','Novo Mundo','Fazendinha','Santa Quitéria','Campo Comprido','Mossunguê','Santo Inácio','Cascatinha','São João','Taboão','Abranches','Cachoeira','Barreirinha','Santa Cândida','Tingui','Atuba','Boqueirão','Xaxim','Capão Raso','Órleans','São Braz','Butiatuvinha','Lamenha Pequena','Santa Felicidade','Alto Boqueirão','Sítio Cercado','Pinheirinho','São Miguel','Augusta','Riviera','Caximba','Campo do Santana','Ganchinho','Umbará','Tatuquara','Cidade Industrial de Curitiba',
];

const ALIASES: Record<string, string> = {
  cic: 'Cidade Industrial de Curitiba',
  'cidade industrial': 'Cidade Industrial de Curitiba',
  'cidade industrial de curitiba': 'Cidade Industrial de Curitiba',
  'alto da rua xv': 'Alto da XV',
  'alto da xv': 'Alto da XV',
  'campo de santana': 'Campo do Santana',
  'campo do santana': 'Campo do Santana',
  orleans: 'Órleans',
  parolini: 'Parolin',
  barrerinha: 'Barreirinha',
};

function normalize(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalNeighborhood(value: unknown) {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (ALIASES[normalized]) return ALIASES[normalized];
  return OFFICIAL_NEIGHBORHOODS.find((name) => normalize(name) === normalized) || null;
}

function neighborhoodFromFreeText(value: unknown) {
  const normalized = ` ${normalize(value)} `;
  if (!normalized.trim()) return null;
  const candidates = [
    ...Object.entries(ALIASES).map(([alias, name]) => ({ key: alias, name })),
    ...OFFICIAL_NEIGHBORHOODS.map((name) => ({ key: normalize(name), name })),
  ].sort((a, b) => b.key.length - a.key.length);
  return candidates.find(({ key }) => key.length >= 3 && normalized.includes(` ${key} `))?.name || null;
}

function canonicalLocality(value: unknown) {
  const normalized = normalize(value);
  if (normalized === 'vitoria regia' || normalized.includes('vitoria regia')) return 'Vitória Régia';
  return null;
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function callerUserId(req: Request) {
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function canManage(postId: string, editToken: string, userId: string | null) {
  const { data: control, error } = await admin
    .from('anonymous_post_controls')
    .select('post_id,owner_user_id,token_hash')
    .eq('post_id', postId)
    .maybeSingle();
  if (error || !control) return { allowed: false, legacy: true };
  if (userId && control.owner_user_id === userId) return { allowed: true, legacy: false };
  if (editToken && control.token_hash) {
    const tokenHash = await sha256(editToken);
    if (tokenHash === control.token_hash) return { allowed: true, legacy: false };
  }
  return { allowed: false, legacy: !control.owner_user_id && !control.token_hash };
}

type ResolvedLocation = {
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  locality: string | null;
  precision: 'exact' | 'reverse' | 'neighborhood' | null;
  displayAddress: string | null;
};

async function officialNeighborhoodAt(latitude: number, longitude: number) {
  try {
    const params = new URLSearchParams({
      f: 'json', geometry: `${longitude},${latitude}`, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'nome', returnGeometry: 'false',
    });
    const response = await fetch(`https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer/2/query?${params.toString()}`);
    if (!response.ok) return null;
    const json = await response.json();
    return canonicalNeighborhood(json?.features?.[0]?.attributes?.nome);
  } catch {
    return null;
  }
}

async function reversePoint(latitude: number, longitude: number) {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '18', addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'NoMeuBairro/1.0' },
    });
    if (!response.ok) return null;
    const json = await response.json();
    const address = json?.address || {};
    const localityCandidates = [address.neighbourhood, address.quarter, address.residential, address.suburb];
    const locality = localityCandidates.map(canonicalLocality).find(Boolean) || null;
    const neighborhood = [address.suburb, address.city_district, address.neighbourhood]
      .map(canonicalNeighborhood).find(Boolean) || null;
    return {
      neighborhood, locality,
      displayAddress: typeof json?.display_name === 'string' ? json.display_name : null,
    };
  } catch {
    return null;
  }
}

function normalizeGeocodingAddress(value: string) {
  return value
    .trim()
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/^,\s*|,\s*$/g, '');
}

function insideCuritiba(latitude: number, longitude: number) {
  return latitude >= -25.66 && latitude <= -25.31 && longitude >= -49.43 && longitude <= -49.15;
}

async function geocodeAddressWithPhoton(query: string) {
  try {
    const photonQuery = normalizeGeocodingAddress(query.replace(/\bCEP\s*:?[\s-]*\d{5}-?\d{3}\b/gi, ''));
    const wantedName = normalize(photonQuery.split(',')[0].replace(/\b\d+[a-z]?\b/gi, ''));
    const params = new URLSearchParams({
      q: photonQuery, limit: '5', lat: '-25.50', lon: '-49.30',
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { 'User-Agent': 'NoMeuBairro/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const features = Array.isArray(json?.features) ? json.features : [];
    let best: { score: number; latitude: number; longitude: number; displayAddress: string | null } | null = null;
    for (const feature of features) {
      const coordinates = feature?.geometry?.coordinates;
      const longitude = Number(coordinates?.[0]);
      const latitude = Number(coordinates?.[1]);
      const properties = feature?.properties || {};
      const city = normalize(properties.city || properties.county);
      const countryCode = normalize(properties.countrycode);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !insideCuritiba(latitude, longitude)) continue;
      if (city && city !== 'curitiba') continue;
      if (countryCode && countryCode !== 'br') continue;
      const resultName = normalize(properties.name);
      const score = wantedName && resultName === wantedName ? 2
        : wantedName && (resultName.includes(wantedName) || wantedName.includes(resultName)) ? 1 : 0;
      if (wantedName.length >= 4 && score === 0) continue;
      const candidate = {
        score, latitude, longitude,
        displayAddress: [properties.name, properties.locality, properties.district, properties.city, properties.state, properties.country]
          .filter(Boolean).join(', ') || null,
      };
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (best) return { latitude: best.latitude, longitude: best.longitude, displayAddress: best.displayAddress };
  } catch {
    // O Nominatim continua sendo a fonte principal; o Photon é apenas a
    // alternativa para ruas brasileiras que não aparecem na primeira busca.
  }
  return null;
}

async function geocodeAddress(location: string, fallbackNeighborhood: string | null) {
  const cleanedLocation = normalizeGeocodingAddress(location);
  const normalizedLocation = normalize(cleanedLocation);
  const queryParts = [cleanedLocation];
  for (const part of [fallbackNeighborhood, 'Curitiba', 'Paraná', 'Brasil']) {
    if (part && !normalizedLocation.includes(normalize(part))) queryParts.push(part);
  }
  const query = queryParts.join(', ');
  try {
    const params = new URLSearchParams({
      format: 'jsonv2', limit: '1', countrycodes: 'br', addressdetails: '1',
      viewbox: '-49.43,-25.31,-49.15,-25.66', bounded: '1', q: query,
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'NoMeuBairro/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const json = await response.json();
      const first = Array.isArray(json) ? json[0] : null;
      const latitude = Number(first?.lat);
      const longitude = Number(first?.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && insideCuritiba(latitude, longitude)) {
        return {
          latitude, longitude,
          displayAddress: typeof first?.display_name === 'string' ? first.display_name : null,
        };
      }
    }
  } catch {}

  return geocodeAddressWithPhoton(cleanedLocation);
}

async function resolveLocation(input: { location?: unknown; neighborhood?: unknown; latitude?: unknown; longitude?: unknown }): Promise<ResolvedLocation> {
  const location = String(input.location || '').trim().slice(0, 255);
  const fallbackNeighborhood = canonicalNeighborhood(input.neighborhood) || neighborhoodFromFreeText(location);
  let latitude = input.latitude == null ? null : Number(input.latitude);
  let longitude = input.longitude == null ? null : Number(input.longitude);
  const coordinatesProvided = Number.isFinite(latitude) && Number.isFinite(longitude);
  let displayAddress: string | null = null;

  if (!coordinatesProvided) {
    latitude = null;
    longitude = null;
    if (location && normalize(location) !== 'local privado') {
      const geocoded = await geocodeAddress(location, fallbackNeighborhood);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        displayAddress = geocoded.displayAddress;
      }
    }
  }

  if (latitude != null && longitude != null) {
    const [official, reverse] = await Promise.all([
      officialNeighborhoodAt(latitude, longitude), reversePoint(latitude, longitude),
    ]);
    return {
      latitude, longitude,
      neighborhood: official || reverse?.neighborhood || fallbackNeighborhood,
      locality: reverse?.locality || canonicalLocality(location),
      precision: coordinatesProvided || Boolean(location) ? 'exact' : 'reverse',
      displayAddress: displayAddress || reverse?.displayAddress || null,
    };
  }

  return {
    latitude: null, longitude: null,
    neighborhood: fallbackNeighborhood,
    locality: canonicalLocality(location),
    precision: fallbackNeighborhood ? 'neighborhood' : null,
    displayAddress: null,
  };
}

function decodeAnonymousImage(value: unknown, label = 'imagem', maxBytes = 3 * 1024 * 1024) {
  if (value == null || value === '') return { bytes: null as Uint8Array | null, mime: null as string | null, extension: null as string | null };
  if (typeof value !== 'string') throw new Error(`${label} inválida.`);
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error(`Use ${label.toLowerCase()} JPEG, PNG ou WebP.`);
  const mime = match[1].toLowerCase();
  let binary: string;
  try { binary = atob(match[2]); } catch { throw new Error(`${label} inválida.`); }
  if (binary.length === 0 || binary.length > maxBytes) throw new Error(`${label} deve ter no máximo ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { bytes, mime, extension };
}

async function uploadAnonymousImages(imageValue: unknown, thumbnailValue: unknown) {
  const image = decodeAnonymousImage(imageValue, 'A imagem');
  const thumbnail = decodeAnonymousImage(thumbnailValue, 'A miniatura', 1024 * 1024);
  if (!image.bytes || !image.mime || !image.extension) {
    return { url: null as string | null, path: null as string | null, thumbnailUrl: null as string | null, thumbnailPath: null as string | null };
  }

  const storageId = crypto.randomUUID();
  const path = `anonymous/${storageId}.${image.extension}`;
  const thumbnailPath = thumbnail.bytes && thumbnail.mime && thumbnail.extension
    ? `anonymous/${storageId}-thumb.${thumbnail.extension}`
    : null;
  const imageUpload = admin.storage.from('post-images').upload(path, image.bytes, {
    contentType: image.mime, cacheControl: '31536000', upsert: false,
  });
  const thumbnailUpload = thumbnailPath && thumbnail.bytes && thumbnail.mime
    ? admin.storage.from('post-images').upload(thumbnailPath, thumbnail.bytes, {
      contentType: thumbnail.mime, cacheControl: '31536000', upsert: false,
    })
    : Promise.resolve({ error: null });
  const [imageResult, thumbnailResult] = await Promise.all([imageUpload, thumbnailUpload]);
  if (imageResult.error || thumbnailResult.error) {
    await removeAnonymousImages(path, thumbnailPath);
    throw new Error(imageResult.error
      ? 'Não foi possível salvar a imagem da denúncia.'
      : 'Não foi possível salvar a miniatura da denúncia.');
  }

  const { data } = admin.storage.from('post-images').getPublicUrl(path);
  const thumbnailUrl = thumbnailPath
    ? admin.storage.from('post-images').getPublicUrl(thumbnailPath).data.publicUrl
    : null;
  return { url: data.publicUrl, path, thumbnailUrl, thumbnailPath };
}

async function removeAnonymousImages(...paths: Array<string | null>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (uniquePaths.length === 0) return;
  await admin.storage.from('post-images').remove(uniquePaths).catch(() => {});
}

function anonymousImagePath(url: unknown) {
  if (typeof url !== 'string') return null;
  const marker = '/storage/v1/object/public/post-images/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const raw = url.slice(index + marker.length).split('?')[0].split('#')[0];
  let path = raw;
  try { path = decodeURIComponent(raw); } catch {}
  return /^anonymous\/[a-zA-Z0-9._-]+$/.test(path) ? path : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Método não permitido.' });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'Requisição inválida.' }); }

  const action = String(body?.action || '');
  const userId = await callerUserId(req);

  if (action === 'resolve_location') {
    const resolved = await resolveLocation(body || {});
    return reply(200, { ok: true, ...resolved });
  }

  if (action === 'repair_missing_locations') {
    return reply(403, { ok: false, error: 'Ação administrativa indisponível neste endpoint.' });
  }

  if (action === 'create') {
    const tipo = String(body?.tipo || '').trim().slice(0, 120);
    const description = String(body?.description || '').trim().slice(0, 10000);
    const location = String(body?.location || '').trim().slice(0, 255) || 'Local Privado';
    const editToken = String(body?.editToken || '');
    if (!tipo || !description) return reply(400, { ok: false, error: 'Tipo e descrição são obrigatórios.' });
    if (editToken.length < 32) return reply(400, { ok: false, error: 'Token de controle inválido.' });

    const resolved = await resolveLocation({
      location, neighborhood: body?.neighborhood, latitude: body?.latitude, longitude: body?.longitude,
    });

    if (body?.allowDuplicate !== true && resolved.latitude != null && resolved.longitude != null) {
      const { data: similarRows, error: similarError } = await admin.rpc('find_similar_posts', {
        p_category: 'seguranca',
        p_latitude: resolved.latitude,
        p_longitude: resolved.longitude,
        p_radius_m: 600,
        p_limit: 5,
      });
      if (!similarError && Array.isArray(similarRows) && similarRows.length > 0) {
        return reply(200, {
          ok: false,
          duplicateCheck: true,
          duplicates: similarRows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            location: row.location,
            neighborhood: row.neighborhood,
            locality: row.locality,
            latitude: row.latitude,
            longitude: row.longitude,
            distanceM: row.distance_m,
            createdAt: row.created_at,
          })),
        });
      }
    }

    // A imagem só é enviada depois da verificação de duplicados.
    let uploaded: { url: string | null; path: string | null; thumbnailUrl: string | null; thumbnailPath: string | null } = {
      url: null, path: null, thumbnailUrl: null, thumbnailPath: null,
    };
    try {
      uploaded = await uploadAnonymousImages(body?.imageData, body?.imageThumbnailData);
    } catch (error) {
      return reply(400, { ok: false, error: error instanceof Error ? error.message : 'Imagem inválida.' });
    }

    const { data: post, error: postError } = await admin
      .from('posts')
      .insert({
        author_id: null,
        category: 'seguranca',
        status: 'pending',
        title: `Denúncia: ${tipo}`,
        description,
        image_url: uploaded.url,
        image_thumbnail_url: uploaded.thumbnailUrl,
        location,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        neighborhood: resolved.neighborhood,
        locality: resolved.locality,
        location_precision: resolved.precision,
        is_anonymous: true,
      })
      .select('id')
      .single();

    if (postError || !post) {
      await removeAnonymousImages(uploaded.path, uploaded.thumbnailPath);
      return reply(postError?.code === 'P0001' ? 429 : 500, { ok: false, error: postError?.message || 'Não foi possível publicar a denúncia.' });
    }

    const { error: controlError } = await admin
      .from('anonymous_post_controls')
      .upsert({ post_id: post.id, owner_user_id: userId, token_hash: await sha256(editToken) }, { onConflict: 'post_id' });

    if (controlError) {
      await admin.from('posts').delete().eq('id', post.id);
      await removeAnonymousImages(uploaded.path, uploaded.thumbnailPath);
      return reply(500, { ok: false, error: 'Não foi possível criar o controle privado da denúncia.' });
    }

    return reply(200, {
      ok: true,
      postId: post.id,
      neighborhood: resolved.neighborhood,
      locality: resolved.locality,
    });
  }

  if (action === 'list_owned') {
    if (!userId) return reply(200, { ok: true, postIds: [] });
    const { data, error } = await admin.from('anonymous_post_controls').select('post_id').eq('owner_user_id', userId).limit(100);
    if (error) return reply(500, { ok: false, error: 'Não foi possível carregar os controles das denúncias.' });
    return reply(200, { ok: true, postIds: (data || []).map((row) => row.post_id) });
  }

  const postId = body?.postId;
  const editToken = String(body?.editToken || '');
  if (!validUuid(postId)) return reply(400, { ok: false, error: 'Denúncia inválida.' });

  const permission = await canManage(postId, editToken, userId);
  if (!permission.allowed) {
    return reply(403, {
      ok: false,
      legacy: permission.legacy,
      error: permission.legacy
        ? 'Esta denúncia antiga foi criada antes do controle seguro de status e não pode ser atribuída retroativamente sem quebrar o anonimato.'
        : 'Você não tem permissão para gerenciar esta denúncia.',
    });
  }

  if (action === 'update_status') {
    const status = String(body?.status || '');
    if (!['pending', 'in_progress', 'resolved'].includes(status)) return reply(400, { ok: false, error: 'Status inválido.' });
    const { error } = await admin.from('posts').update({ status }).eq('id', postId).eq('is_anonymous', true);
    if (error) return reply(500, { ok: false, error: 'Não foi possível atualizar o status.' });
    return reply(200, { ok: true });
  }

  if (action === 'delete') {
    const { data: post } = await admin.from('posts').select('image_url,image_thumbnail_url').eq('id', postId).eq('is_anonymous', true).maybeSingle();
    const path = anonymousImagePath(post?.image_url);
    const thumbnailPath = anonymousImagePath(post?.image_thumbnail_url);
    const { error } = await admin.from('posts').delete().eq('id', postId).eq('is_anonymous', true);
    if (error) return reply(500, { ok: false, error: 'Não foi possível excluir a denúncia.' });
    await removeAnonymousImages(path, thumbnailPath);
    return reply(200, { ok: true });
  }

  return reply(400, { ok: false, error: 'Ação inválida.' });
});
