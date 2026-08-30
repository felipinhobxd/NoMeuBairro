import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function mockSupabase(page: Page) {
  await page.route('**/supabase-mock/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isAuth = url.pathname.includes('/auth/v1/');
    const isPosts = url.pathname.endsWith('/rest/v1/posts');
    const body = isAuth ? { user: null, session: null } : isPosts ? [{
      id: '10000000-0000-4000-8000-000000000001',
      author_id: '20000000-0000-4000-8000-000000000001',
      category: 'iluminacao',
      status: 'pending',
      title: 'Lâmpada apagada na praça',
      description: 'Poste sem iluminação há vários dias.',
      image_url: null,
      image_thumbnail_url: null,
      location: 'Praça de teste, Curitiba',
      neighborhood: 'Centro',
      locality: null,
      location_precision: 'exact',
      latitude: -25.4297,
      longitude: -49.2711,
      official_agency: null,
      official_protocol: null,
      official_status: null,
      official_contacted_at: null,
      is_anonymous: false,
      created_at: '2026-08-19T12:00:00.000Z',
      updated_at: '2026-08-19T12:00:00.000Z',
      comments_count: 0,
      comments: [{ count: 0 }],
      post_supports: [{ count: 0 }],
      users: { name: 'Morador de teste', avatar_url: null },
    }] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });
}

async function prepareReturningVisitor(page: Page, fontSize: 'medium' | 'giant' = 'medium') {
  await page.addInitScript((preferredFontSize) => {
    localStorage.setItem('nmb-font-size-v1', preferredFontSize);
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
  }, fontSize);
}

function seriousViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map(({ id, impact, help, nodes }) => ({ id, impact, help, targets: nodes.map((node) => node.target) }));
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
});

test('primeira visita respeita fonte, cookies e guia nessa ordem', async ({ page }) => {
  await page.goto('/');

  const fontDialog = page.getByRole('dialog', { name: 'Como você prefere ler o site?' });
  await expect(fontDialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: /cookies/i })).toHaveCount(0);

  await fontDialog.getByRole('radio', { name: /Grande/ }).click();
  await fontDialog.getByRole('button', { name: 'Continuar com fonte grande' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
  const cookieDialog = page.getByRole('dialog', { name: 'Antes do guia: escolha os cookies' });
  await expect(cookieDialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Guia interativo/ })).toHaveCount(0);

  await cookieDialog.getByRole('button', { name: 'Somente essenciais' }).click();
  await expect(cookieDialog).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Guia interativo do No Meu Bairro' })).toBeVisible();
  await expect(page.getByText(/Aprenda (clicando|tocando)/)).toBeVisible();
});

test('navegação principal funciona em desktop e celular', async ({ page }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', {
    name: (page.viewportSize()?.width ?? 0) < 1024 ? 'Navegação mobile' : 'Navegação principal',
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page).toHaveURL(/#\/mapa$/);
  await expect(page.getByRole('heading', { name: 'Mapa Comunitário' })).toBeVisible();
});

test('feed mostra claramente a categoria escolhida no relato', async ({ page }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  await expect(page.getByLabel('Categoria: Iluminação').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lâmpada apagada na praça' })).toBeVisible();
});

test('otimização de fotos cria versões leves para detalhe e feed', async ({ page }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const { optimizePostImageFile, createPostThumbnailDataUrl } = await import('/src/utils/imageOptimization.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível');
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f97316');
    gradient.addColorStop(1, '#047857');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const originalBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG indisponível')), 'image/png'));
    const optimized = await optimizePostImageFile(new File([originalBlob], 'foto-grande.png', { type: 'image/png' }));
    const thumbnailDataUrl = await createPostThumbnailDataUrl(optimized.dataUrl);
    if (!thumbnailDataUrl) throw new Error('Miniatura não criada');

    const dimensions = async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    };

    return {
      full: await dimensions(optimized.dataUrl),
      thumbnail: await dimensions(thumbnailDataUrl),
      fullBytes: optimized.blob.size,
      fullType: optimized.mime,
      thumbnailType: thumbnailDataUrl.slice(0, thumbnailDataUrl.indexOf(';')),
    };
  });

  expect(Math.max(result.full.width, result.full.height)).toBeLessThanOrEqual(1600);
  expect(Math.max(result.thumbnail.width, result.thumbnail.height)).toBeLessThanOrEqual(640);
  expect(result.fullBytes).toBeLessThanOrEqual(3 * 1024 * 1024);
  expect(result.fullType).toBe('image/webp');
  expect(result.thumbnailType).toBe('data:image/webp');
});

test('interface se reorganiza sem rolagem horizontal', async ({ page }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  const viewport = page.viewportSize();
  const pageMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(pageMetrics.documentWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 1);

  if (viewport && viewport.width >= 1024) {
    const desktopNav = page.getByRole('navigation', { name: 'Navegação principal' });
    const navSizing = await desktopNav.evaluate((element) => {
      const navBox = element.getBoundingClientRect();
      const controls = Array.from(element.children) as HTMLElement[];
      const firstControl = controls[0]?.getBoundingClientRect();
      const lastControl = controls[controls.length - 1]?.getBoundingClientRect();
      const controlsWidth = firstControl && lastControl ? lastControl.right - firstControl.left : 0;

      return {
        navWidth: navBox.width,
        controlsWidth,
      };
    });

    // A moldura deve abraçar os controles; ela só atinge o limite da tela
    // quando os próprios botões precisam de mais espaço.
    const unusedWidth = navSizing.navWidth - Math.min(navSizing.controlsWidth, navSizing.navWidth);
    expect(unusedWidth).toBeLessThanOrEqual(16);

    if (viewport.width >= 1440 && viewport.width < 1650) {
      expect(navSizing.navWidth).toBeLessThan(520);
    }
  }

  if (viewport && viewport.width >= 1024 && viewport.width < 1440) {
    const header = page.locator('.nmb-header-row');
    const desktopNav = page.getByRole('navigation', { name: 'Navegação principal' });
    const [headerBox, navBox] = await Promise.all([header.boundingBox(), desktopNav.boundingBox()]);
    expect(headerBox?.height ?? 0).toBeGreaterThanOrEqual(viewport.height <= 760 ? 88 : 98);
    expect(navBox?.y ?? 0).toBeGreaterThan((headerBox?.y ?? 0) + 40);
    await expect(desktopNav.getByText('Empregos', { exact: true })).toBeVisible();
  }

  await page.getByRole('navigation', { name: viewport && viewport.width < 1024 ? 'Navegação mobile' : 'Navegação principal' })
    .getByRole('button', { name: 'Mapa', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Mapa Comunitário' })).toBeVisible();
  await expect(page.locator('.nmb-map-canvas')).toBeVisible();

  const mapMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mapMetrics.documentWidth).toBeLessThanOrEqual(mapMetrics.viewportWidth + 1);
});

test('fonte gigante continua utilizável em telas estreitas', async ({ page }) => {
  await prepareReturningVisitor(page, 'giant');
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'giant');
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 1024 && viewport.width < 1440) {
    const filter = page.locator('.nmb-neighborhood-filter');
    const filterMetrics = await filter.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(filterMetrics.scrollWidth).toBeLessThanOrEqual(filterMetrics.clientWidth + 1);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Denúncias', { exact: true })).toBeVisible();
  }
});

test('fluxos críticos não têm violações graves de acessibilidade', async ({ page }) => {
  await page.goto('/');
  const firstVisitResults = await new AxeBuilder({ page })
    .include('[aria-labelledby="font-size-picker-title"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(seriousViolations(firstVisitResults.violations)).toEqual([]);

  await page.getByRole('button', { name: 'Continuar com fonte média' }).click();
  await page.getByRole('button', { name: 'Somente essenciais' }).click();
  await page.evaluate(() => localStorage.setItem('nmb-onboarding-v6', 'done'));
  await page.goto('/#/privacidade');

  const privacyResults = await new AxeBuilder({ page })
    .include('#main-content')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(seriousViolations(privacyResults.violations)).toEqual([]);
});

test('manifesto do PWA expõe ícones válidos e atalhos úteis', async ({ page, request }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.shortcuts.map((shortcut: { short_name: string }) => shortcut.short_name)).toEqual(['Relatar', 'Mapa']);

  for (const iconPath of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']) {
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, iconPath);
    expect(dimensions.width).toBeGreaterThanOrEqual(192);
    expect(dimensions.height).toBe(dimensions.width);
  }
});
