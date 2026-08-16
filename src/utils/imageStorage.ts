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
  const filename = `${crypto.randomUUID()}.${extensionForMime(blob.type)}`;
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
