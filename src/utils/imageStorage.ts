import { supabase } from './supabase';
import { createPostThumbnailDataUrl, dataUrlToBlob, POST_IMAGE_MAX_OUTPUT_BYTES } from './imageOptimization';

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

export async function deleteStoredPostImage(url: string | undefined | null, thumbnailUrl?: string | null) {
  const paths = [postImageStoragePath(url), postImageStoragePath(thumbnailUrl)].filter((path): path is string => Boolean(path));
  if (paths.length === 0 || !url) return;

  // Denúncias anônimas não concedem DELETE público no bucket. O endpoint só remove
  // o arquivo quando confirma que nenhum relato do banco ainda referencia a URL.
  if (paths.some((path) => path.startsWith('anonymous/'))) {
    const { error } = await supabase.functions.invoke('cleanup-anonymous-post-image', { body: { url, thumbnailUrl } });
    if (error) console.warn('Não foi possível limpar a imagem anônima do relato:', error.message);
    return;
  }

  const { error } = await supabase.storage.from('post-images').remove([...new Set(paths)]);
  if (error) console.warn('Não foi possível remover a imagem antiga do relato:', error.message);
}

/**
 * Converts the temporary data URL created by ImageUpload into a real Storage object.
 * The database stores only the short public URL, never the base64 payload.
 */
export async function storePostImage(
  dataUrlOrUrl: string | undefined,
  folder: string,
  thumbnailDataUrl?: string,
): Promise<{ url?: string; thumbnailUrl?: string; error?: string }> {
  if (!dataUrlOrUrl) return {};
  if (!dataUrlOrUrl.startsWith('data:image/')) return { url: dataUrlOrUrl };

  const blob = dataUrlToBlob(dataUrlOrUrl);
  if (!blob) return { error: 'Não foi possível processar a imagem.' };
  if (blob.size > POST_IMAGE_MAX_OUTPUT_BYTES) return { error: 'A imagem ficou maior que 3 MB. Escolha outra foto.' };

  let resolvedThumbnail = thumbnailDataUrl;
  try {
    resolvedThumbnail ||= await createPostThumbnailDataUrl(dataUrlOrUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível preparar a miniatura.' };
  }
  const thumbnailBlob = resolvedThumbnail ? dataUrlToBlob(resolvedThumbnail) : null;
  if (!thumbnailBlob) return { error: 'Não foi possível preparar a miniatura da imagem.' };
  if (thumbnailBlob.size > POST_IMAGE_MAX_OUTPUT_BYTES) return { error: 'A miniatura da imagem ficou muito grande.' };

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
  const storageId = createStorageId();
  const path = `${safeFolder}/${storageId}.${extensionForMime(blob.type)}`;
  const thumbnailPath = `${safeFolder}/${storageId}-thumb.${extensionForMime(thumbnailBlob.type)}`;
  const [imageUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from('post-images').upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    }),
    supabase.storage.from('post-images').upload(thumbnailPath, thumbnailBlob, {
      contentType: thumbnailBlob.type || 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    }),
  ]);
  const uploadError = imageUpload.error || thumbnailUpload.error;
  if (uploadError) {
    await supabase.storage.from('post-images').remove([path, thumbnailPath]);
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from('post-images').getPublicUrl(path);
  const { data: thumbnailData } = supabase.storage.from('post-images').getPublicUrl(thumbnailPath);
  return { url: data.publicUrl, thumbnailUrl: thumbnailData.publicUrl };
}
