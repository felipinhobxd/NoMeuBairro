type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type SharePayload = {
  title: string;
  text?: string;
  url: string;
};

function absoluteUrl(url: string) {
  if (typeof window === 'undefined') return url;
  try { return new URL(url, window.location.origin).toString(); }
  catch { return url; }
}

async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') throw new Error('Clipboard indisponível');
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(input);
  if (!ok) throw new Error('Não foi possível copiar');
}

export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const url = absoluteUrl(payload.url);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to clipboard when native sharing is unavailable or fails.
    }
  }
  try {
    await copyText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
