import { supabase } from './supabase';

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  try {
    const mime = match[1] || 'image/jpeg';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function createStorageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function postImageStoragePath(url: string | undefined | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/post-images/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const raw = url.slice(index + marker.length).split('?')[0].split('#')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function deleteStoredPostImage(url: string | undefined | null) {
  const path = postImageStoragePath(url);
  if (!path || !url) return;

  // Denúncias anônimas não concedem DELETE público no bucket. O endpoint só remove
  // o arquivo quando confirma que nenhum relato do banco ainda referencia a URL.
  if (path.startsWith('anonymous/')) {
    const { error } = await supabase.functions.invoke('cleanup-anonymous-post-image', { body: { url } });
    if (error) console.warn('Não foi possível limpar a imagem anônima do relato:', error.message);
    return;
  }

  const { error } = await supabase.storage.from('post-images').remove([path]);
  if (error) console.warn('Não foi possível remover a imagem antiga do relato:', error.message);
}

/**
 * Converts the temporary data URL created by ImageUpload into a real Storage object.
 * The database stores only the short public URL, never the base64 payload.
 */
export async function storePostImage(dataUrlOrUrl: string | undefined, folder: string): Promise<{ url?: string; error?: string }> {
  if (!dataUrlOrUrl) return {};
  if (!dataUrlOrUrl.startsWith('data:image/')) return { url: dataUrlOrUrl };

  const blob = dataUrlToBlob(dataUrlOrUrl);
  if (!blob) return { error: 'Não foi possível processar a imagem.' };
  if (blob.size > 3 * 1024 * 1024) return { error: 'A imagem ficou maior que 3 MB. Escolha outra foto.' };

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `${createStorageId()}.${extensionForMime(blob.type)}`;
  const path = `${safeFolder}/${filename}`;
  const { error } = await supabase.storage.from('post-images').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from('post-images').getPublicUrl(path);
  return { url: data.publicUrl };
}
