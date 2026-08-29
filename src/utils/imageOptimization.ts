export const POST_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const POST_IMAGE_MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
export const POST_IMAGE_MAX_DIMENSION = 1600;
export const POST_IMAGE_THUMBNAIL_MAX_DIMENSION = 640;

const FULL_QUALITY = 0.82;
const THUMBNAIL_QUALITY = 0.72;

type EncodedCanvas = {
  blob: Blob;
  dataUrl: string;
  extension: 'webp' | 'jpg';
  mime: 'image/webp' | 'image/jpeg';
};

export type OptimizedPostImage = EncodedCanvas & {
  width: number;
  height: number;
  originalBytes: number;
};

function calculateSize(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  }
  try {
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL(mime, quality)));
  } catch {
    return Promise.resolve(null);
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível preparar a foto.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(blob: Blob) {
  return new Promise<{ image: HTMLImageElement; release: () => void }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    const release = () => URL.revokeObjectURL(objectUrl);
    image.decoding = 'async';
    image.onload = () => resolve({ image, release });
    image.onerror = () => {
      release();
      reject(new Error('Este formato de foto não é compatível com este aparelho. Tente JPG, PNG ou WebP.'));
    };
    image.src = objectUrl;
  });
}

function drawImage(image: HTMLImageElement, maxDimension: number) {
  const size = calculateSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Não foi possível otimizar a foto neste aparelho.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  return { canvas, ...size };
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<EncodedCanvas> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp?.type === 'image/webp') {
    return { blob: webp, mime: 'image/webp', extension: 'webp', dataUrl: await blobToDataUrl(webp) };
  }

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) throw new Error('Não foi possível compactar a foto neste aparelho.');
  return { blob: jpeg, mime: 'image/jpeg', extension: 'jpg', dataUrl: await blobToDataUrl(jpeg) };
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  try {
    const mime = match[1] || 'image/jpeg';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export async function optimizePostImageFile(file: File): Promise<OptimizedPostImage> {
  const hasImageExtension = /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if ((!file.type.startsWith('image/') && !hasImageExtension) || file.type === 'image/svg+xml') throw new Error('Escolha um arquivo de imagem JPG, PNG, WebP ou HEIC.');
  if (file.size > POST_IMAGE_MAX_SOURCE_BYTES) throw new Error('A foto deve ter no máximo 10 MB.');

  const loaded = await loadImage(file);
  try {
    const { canvas, width, height } = drawImage(loaded.image, POST_IMAGE_MAX_DIMENSION);
    let encoded = await encodeCanvas(canvas, FULL_QUALITY);
    if (encoded.blob.size > POST_IMAGE_MAX_OUTPUT_BYTES) encoded = await encodeCanvas(canvas, 0.68);
    if (encoded.blob.size > POST_IMAGE_MAX_OUTPUT_BYTES) throw new Error('A foto ficou maior que 3 MB mesmo após a otimização. Escolha outra foto.');
    return { ...encoded, width, height, originalBytes: file.size };
  } finally {
    loaded.release();
  }
}

export async function createPostThumbnailDataUrl(dataUrl: string): Promise<string | undefined> {
  if (!dataUrl.startsWith('data:image/')) return undefined;
  const source = dataUrlToBlob(dataUrl);
  if (!source) throw new Error('Não foi possível preparar a miniatura da foto.');
  const loaded = await loadImage(source);
  try {
    const { canvas } = drawImage(loaded.image, POST_IMAGE_THUMBNAIL_MAX_DIMENSION);
    const encoded = await encodeCanvas(canvas, THUMBNAIL_QUALITY);
    return encoded.dataUrl;
  } finally {
    loaded.release();
  }
}

export function formatImageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
