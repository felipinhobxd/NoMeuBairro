/**
 * Small, DOM-only accessibility adapter for the official VLibras loader.
 * It never replaces the widget, its handlers, consent or translation requests.
 * Selectors follow spbgovbr-vlibras/vlibras-web-browsers/src/loader/index.js.
 */
const installations = new WeakMap<Document, () => void>();
const accessStyleId = 'nmb-vlibras-access-focus';
const controlsStyleId = 'nmb-vlibras-controls-focus';

function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function addStyle(scope: ShadowRoot | HTMLElement, id: string, css: string) {
  if (scope.querySelector(`#${id}`)) return;
  const style = scope.ownerDocument.createElement('style');
  style.id = id;
  style.textContent = css;
  scope.appendChild(style);
}

function enhanceAccess(scope: ShadowRoot | HTMLElement) {
  const button = scope.querySelector<HTMLButtonElement>('#vlibras-button');
  if (!button) return;
  setAttribute(button, 'aria-label', 'Abrir tradutor de Libras (VLibras)');
  setAttribute(button, 'title', 'Abrir tradutor de Libras (VLibras)');
  // Both images repeat the button's purpose; avoid duplicate screen-reader output.
  for (const image of scope.querySelectorAll('#vlibras-button img, img#vlibras-popup')) {
    setAttribute(image, 'alt', '');
    setAttribute(image, 'aria-hidden', 'true');
  }
  addStyle(scope, accessStyleId, `
    #vlibras-access { width:44px; height:44px; top:calc(50vh - 22px); }
    #vlibras-access:focus-within { width:200px; }
    #vlibras-button { width:44px; height:44px; min-width:44px; min-height:44px; touch-action:manipulation; }
    #vlibras-button img { display:block; width:100%; height:100%; }
    #vlibras-button:focus-visible { outline:3px solid #111827; outline-offset:2px; box-shadow:0 0 0 5px #fff; }
    @media (prefers-reduced-motion:reduce) { #vlibras-access { transition:none; } }
  `);
}

function labelIfUnnamed(element: Element | null, label: string) {
  if (!element || element.getAttribute('aria-label')?.trim()
    || element.getAttribute('aria-labelledby')?.trim()
    || element.getAttribute('title')?.trim()) return;
  if (element instanceof HTMLInputElement && element.labels?.length) return;
  if (element.tagName === 'BUTTON' && element.textContent?.trim()) return;
  setAttribute(element, 'aria-label', label);
  for (const icon of element.querySelectorAll('i')) setAttribute(icon, 'aria-hidden', 'true');
}

function enhanceSettings(scope: ShadowRoot | HTMLElement) {
  // Scope these labels to the official settings dialog and its visible captions.
  // Native checkbox/range state and the provider's event handlers stay untouched.
  for (const title of scope.querySelectorAll('[data-slot="dialog-title"]')) {
    if (title.textContent?.trim() !== 'Configurações') continue;
    const dialog = title.closest('[data-slot="dialog-content"]');
    if (!dialog) continue;
    labelIfUnnamed(dialog.querySelector('[data-slot="dialog-close"]'), 'Fechar configurações do VLibras');
    for (const input of dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="range"]')) {
      const caption = input.parentElement?.querySelector('p')?.textContent?.trim();
      if (input.type === 'checkbox' && caption === 'Tema escuro') labelIfUnnamed(input, 'Tema escuro do VLibras');
      if (input.type === 'range' && caption === 'Opacidade') labelIfUnnamed(input, 'Opacidade do VLibras');
    }
    for (const icon of dialog.querySelectorAll<HTMLElement>('button > i[style]')) {
      if (/\/rotate-left\.webp(?:["')]|$)/.test(icon.style.getPropertyValue('--icon'))) {
        labelIfUnnamed(icon.parentElement, 'Redefinir configurações do VLibras');
      }
    }
  }
}

function enhanceControls(scope: ShadowRoot | HTMLElement) {
  // The current official widget omits names on the subtitles/settings buttons.
  // Only enhance those known icons, and respect names supplied by future versions.
  for (const icon of scope.querySelectorAll<HTMLElement>('button > i[style]')) {
    const match = icon.style.getPropertyValue('--icon').match(/\/(subtitle(?:-off)?|settings)\.webp(?:["')]|$)/);
    if (!match) continue;
    const button = icon.parentElement;
    if (!button || button.tagName !== 'BUTTON') continue;
    const previousLabel = button.getAttribute('data-nmb-vlibras-label');
    const currentLabel = button.getAttribute('aria-label');
    if (currentLabel && currentLabel !== previousLabel) continue;

    const name = match[1];
    const label = name === 'settings' ? 'Configurações do VLibras' : 'Legendas do VLibras';
    setAttribute(button, 'data-nmb-vlibras-label', label);
    setAttribute(button, 'aria-label', label);
    setAttribute(icon, 'aria-hidden', 'true');
    if (name !== 'settings') {
      setAttribute(button, 'aria-pressed', String(name === 'subtitle'));
      setAttribute(button, 'title', name === 'subtitle' ? 'Desativar legendas' : 'Ativar legendas');
    }
  }
  enhanceSettings(scope);
  const prefix = scope instanceof ShadowRoot ? ':host' : '#vlibras-app-root';
  addStyle(scope, controlsStyleId, `
    ${prefix} button:focus-visible, ${prefix} input:focus-visible { outline:3px solid #111827; outline-offset:2px; box-shadow:0 0 0 5px #fff; }
  `);
}

export function startVLibrasAccessibility(doc: Document = document): () => void {
  const existing = installations.get(doc);
  if (existing) return existing;
  if (!doc.body || typeof MutationObserver === 'undefined') return () => {};

  const hosts = new Map<HTMLElement, MutationObserver>();
  const connectHosts = () => {
    for (const [host, observer] of hosts) {
      if (!host.isConnected) { observer.disconnect(); hosts.delete(host); }
    }
    for (const id of ['vlibras-access-wrapper', 'vlibras-app-root']) {
      const host = doc.getElementById(id);
      if (!host || hosts.has(host)) continue;
      const scope = host.shadowRoot || host;
      const enhance = id === 'vlibras-access-wrapper' ? enhanceAccess : enhanceControls;
      enhance(scope);
      const observer = new MutationObserver(records => {
        // Ignore player progress/animation style changes. Only icon changes matter.
        if (records.some(record => record.type === 'childList'
          || (record.target instanceof Element && record.target.matches('button > i[style]')))) {
          enhance(scope);
        }
      });
      observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      hosts.set(host, observer);
    }
  };

  // The official loader appends its hosts directly to body, sometimes asynchronously.
  // Do not observe the React feed subtree or use recurring timers/network requests.
  const bodyObserver = new MutationObserver(connectHosts);
  bodyObserver.observe(doc.body, { childList: true });
  connectHosts();
  const stop = () => {
    bodyObserver.disconnect();
    hosts.forEach(observer => observer.disconnect());
    hosts.clear();
    installations.delete(doc);
  };
  installations.set(doc, stop);
  return stop;
}
