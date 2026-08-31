import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Minimal DOM contract of the official loader/controls. No translation requests,
// real sessions, third-party telemetry or dependency on the government CDN in CI.
const widgetFixture = `
window.VLibras = { Widget: function () {
  if (document.getElementById('vlibras-access-wrapper')) return;
  var host = document.createElement('div');
  host.id = 'vlibras-access-wrapper';
  var shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = '<div id="vlibras-access"><img id="vlibras-popup" src="/logo.png"><button id="vlibras-button" type="button" aria-label="Conteúdo acessível em Libras usando o VLibras Widget"><img src="/logo.png"></button></div><style>#vlibras-access{position:fixed;right:10px;top:calc(50vh - 20px);width:40px;height:40px;z-index:2147483639;display:flex}#vlibras-popup{display:none}#vlibras-button{position:absolute;right:0;width:40px;height:40px;padding:0;border:0;background:#1351b4;border-radius:8px}#vlibras-button img{width:40px;height:40px}</style>';
  document.body.appendChild(host);
  shadow.getElementById('vlibras-button').onclick = function () {
    host.dataset.clicks = String(Number(host.dataset.clicks || 0) + 1);
    var app = document.getElementById('vlibras-app-root');
    if (!app) {
      app = document.createElement('div'); app.id = 'vlibras-app-root';
      var root = app.attachShadow({mode:'open'});
      root.innerHTML = '<section aria-label="Tradutor de Libras"><button type="button" aria-label="Fechar">Fechar</button><button type="button" data-control="subtitles"><i style="--icon:url(https://vlibras.gov.br/app/assets/icons/subtitle.webp)"></i></button><button type="button" data-control="settings"><i style="--icon:url(https://vlibras.gov.br/app/assets/icons/settings.webp)"></i></button><button type="button" aria-label="Ajuda oficial"><i style="--icon:url(https://vlibras.gov.br/app/assets/icons/settings.webp)"></i></button></section><style>:host{position:fixed;right:10px;top:20%;z-index:2147483640;background:#fff;color:#111827;padding:12px;border:1px solid #111827;border-radius:8px}section{display:flex;flex-direction:column;gap:12px}button{min-width:44px;min-height:44px;color:#111827;background:#fff;border:1px solid #111827}i{display:block;width:20px;height:20px;background:#1351b4}</style>';
      root.querySelector('[aria-label="Fechar"]').onclick = function () {
        app.hidden = true;
        shadow.getElementById('vlibras-access').style.display = 'flex';
      };
      root.querySelector('[data-control="subtitles"]').onclick = function () {
        var icon = this.querySelector('i');
        var wasEnabled = !icon.style.getPropertyValue('--icon').includes('subtitle-off');
        icon.style.setProperty('--icon', 'url(https://vlibras.gov.br/app/assets/icons/' + (wasEnabled ? 'subtitle-off' : 'subtitle') + '.webp)');
      };
      root.querySelector('[data-control="settings"]').onclick = function () { this.dataset.opened = 'true'; };
      document.body.appendChild(app);
    }
    app.hidden = false;
    shadow.getElementById('vlibras-access').style.display = 'none';
  };
} };
`;

async function setup(page: Page, { theme = 'light', admin = false, widget = true } = {}) {
  await page.addInitScript(({ theme, admin }) => {
    localStorage.setItem('anb-theme', theme);
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    if (admin) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const id = '20000000-0000-4000-8000-000000000051';
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: encode({ alg: 'HS256' }) + '.' + encode({ sub: id, exp, role: 'authenticated' }) + '.fixture',
        refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer',
        user: { id, email: 'a11y@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Administrador de teste', account_type: 'resident' }, created_at: '2026-01-01T12:00:00Z' },
      }));
    }
  }, { theme, admin });
  await page.routeWebSocket('**/supabase-mock/realtime/**', socket => { socket.onMessage(() => {}); });
  await page.route('**/supabase-mock/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/is_moderator')) body = admin;
    else if (path.endsWith('/app_roles')) body = admin ? { role: 'admin' } : null;
    else if (path.endsWith('/users')) body = { id: '20000000-0000-4000-8000-000000000051', name: 'Administrador de teste', avatar_url: null, reputation: 1, created_at: '2026-01-01T12:00:00Z' };
    else if (path.includes('/auth/v1/')) body = { user: null, session: null };
    else if (path.endsWith('/get_neighborhood_weekly_summary')) body = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', route => widget
    ? route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: widgetFixture })
    : route.abort());
}

async function auditNavigation(page: Page) {
  const result = await new AxeBuilder({ page })
    .include('header[role="banner"]')
    .include('nav[aria-label="Navegação mobile"]')
    .include('#vlibras-access-wrapper')
    .analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
}

for (const theme of ['light', 'dark']) {
  test(`menu e filtro mantêm nomes e contraste no tema ${theme}`, async ({ page }) => {
    await setup(page, { theme, admin: true });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abrir tradutor de Libras (VLibras)', exact: true })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: /Filtro de bairro: Todos os bairros/ })).toBeVisible();
    await auditNavigation(page);

    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
      await nav.getByRole('button', { name: 'Admin', exact: true }).press('Enter');
      await expect(nav.getByRole('button', { name: 'Admin', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(nav.getByRole('button', { name: 'Admin', exact: true })).toHaveAttribute('title', 'Admin');
      await auditNavigation(page);
    } else {
      await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Mais opções', exact: true });
      await menu.getByRole('button', { name: 'Admin', exact: true }).click();
      await expect(page).toHaveURL(/#\/admin$/);
      await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
      await expect(menu.getByRole('button', { name: 'Admin', exact: true })).toHaveAttribute('aria-current', 'page');
      const result = await new AxeBuilder({ page }).include('#mobile-more-dialog').analyze();
      expect(result.violations.map(({ id }) => id)).toEqual([]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}

test('atalho de conteúdo não altera a rota e Entrar tem nome no celular', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expect(page.locator('header').getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  const url = page.url();
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo', exact: true });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(page.url()).toBe(url);
});

test('menu Mais contém o foco, fecha com Esc e libera a tela ao redimensionar', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'Menu inferior somente em celular/tablet.');
  await setup(page);
  await page.goto('/');
  const trigger = page.locator('nav[aria-label="Navegação mobile"] button[aria-label="Mais opções"]');
  await trigger.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Mais opções', exact: true });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const close = menu.getByRole('button', { name: 'Fechar menu', exact: true });
  await expect(close).toBeFocused();
  await expect(close).toHaveCount(1);
  await page.keyboard.press('Shift+Tab');
  await expect(menu.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.press('Space');
  await expect(menu).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(menu).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.getByRole('navigation', { name: 'Navegação principal', exact: true }).getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page).toHaveURL(/#\/mapa$/);
});

test('menu Mais transfere o foco à escolha de fonte sem prender a interação', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'Menu inferior somente em celular/tablet.');
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('dialog', { name: 'Mais opções', exact: true }).getByRole('button', { name: 'Fonte: Média', exact: true }).press('Enter');
  await expect(page.getByRole('dialog', { name: 'Mais opções', exact: true })).toHaveCount(0);
  const picker = page.getByRole('dialog', { name: 'Alterar tamanho da fonte', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('heading')).toBeFocused();
  await picker.getByRole('radio', { name: /Gigante/ }).click();
  await picker.getByRole('button', { name: 'Salvar fonte gigante', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'giant');
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Mais opções', exact: true });
  await expect(menu.getByRole('button', { name: 'Fonte: Gigante', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('VLibras mantém teclado e handlers, com imagens decorativas e controles nomeados', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  const host = page.locator('#vlibras-access-wrapper');
  const button = host.getByRole('button', { name: 'Abrir tradutor de Libras (VLibras)', exact: true });
  await expect(button).toBeVisible();
  for (const image of await host.locator('img').all()) {
    await expect(image).toHaveAttribute('alt', '');
    await expect(image).toHaveAttribute('aria-hidden', 'true');
  }
  const size = await button.boundingBox();
  expect(size?.width).toBeGreaterThanOrEqual(44);
  expect(size?.height).toBeGreaterThanOrEqual(44);
  await button.press('Tab');
  await button.focus();
  await expect(button).toHaveCSS('outline-width', '3px');
  await button.press('Enter');
  const app = page.locator('#vlibras-app-root');
  const subtitles = app.getByRole('button', { name: 'Legendas do VLibras', exact: true });
  await expect(subtitles).toHaveAttribute('aria-pressed', 'true');
  await subtitles.press('Space');
  await expect(subtitles).toHaveAttribute('aria-pressed', 'false');
  await expect(subtitles).toHaveAttribute('title', 'Ativar legendas');
  await subtitles.press('Enter');
  await expect(subtitles).toHaveAttribute('aria-pressed', 'true');
  const settings = app.getByRole('button', { name: 'Configurações do VLibras', exact: true });
  await settings.press('Enter');
  await expect(settings).toHaveAttribute('data-opened', 'true');
  await expect(app.getByRole('button', { name: 'Ajuda oficial', exact: true })).toBeVisible();
  const audit = await new AxeBuilder({ page }).include('#vlibras-app-root').analyze();
  expect(audit.violations.map(({ id }) => id)).toEqual([]);
  await app.getByRole('button', { name: 'Fechar', exact: true }).press('Enter');
  await expect(button).toBeVisible();
  await button.press('Space');
  await expect(host).toHaveAttribute('data-clicks', '2');
});

test('adaptador tolera carregamento tardio e remontagem sem duplicar estilos', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir tradutor de Libras (VLibras)', exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.getElementById('vlibras-access-wrapper')?.remove();
  });
  await expect(page.locator('#vlibras-access-wrapper')).toHaveCount(0);
  await page.evaluate(() => {
    const widget = (window as unknown as { VLibras: { Widget: new () => unknown } }).VLibras;
    new widget.Widget();
  });
  const host = page.locator('#vlibras-access-wrapper');
  await expect(host.getByRole('button', { name: 'Abrir tradutor de Libras (VLibras)', exact: true })).toBeVisible();
  await expect(host.locator('#nmb-vlibras-access-focus')).toHaveCount(1);
  await page.evaluate(async () => {
    const modulePath = '/src/utils/vlibrasAccessibility.ts';
    const adapter = await import(modulePath);
    adapter.startVLibrasAccessibility();
    adapter.startVLibrasAccessibility();
    const shadow = document.getElementById('vlibras-access-wrapper')!.shadowRoot!;
    const img = document.createElement('img'); img.src = '/logo.png';
    shadow.getElementById('vlibras-button')!.replaceChildren(img);
  });
  await expect(host.locator('#vlibras-button img')).toHaveAttribute('alt', '');
  await expect(host.locator('#nmb-vlibras-access-focus')).toHaveCount(1);
});

test('indisponibilidade do VLibras não bloqueia a navegação do site', async ({ page }) => {
  await setup(page, { widget: false });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const nav = page.getByRole('navigation', {
    name: (page.viewportSize()?.width ?? 0) < 1024 ? 'Navegação mobile' : 'Navegação principal', exact: true,
  });
  await nav.getByRole('button', { name: 'Mapa', exact: true }).press('Enter');
  await expect(page).toHaveURL(/#\/mapa$/);
  await expect(page.getByRole('heading', { name: 'Mapa Comunitário', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
