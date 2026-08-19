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

async function prepareReturningVisitor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
  });
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

test('navegação principal funciona em desktop e celular', async ({ page, isMobile }) => {
  await prepareReturningVisitor(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', {
    name: isMobile ? 'Navegação mobile' : 'Navegação principal',
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
