import { expect, test, type Page } from '@playwright/test';

async function mockSupabase(page: Page) {
  await page.route('**/supabase-mock/**', async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.includes('/auth/v1/')
      ? { user: null, session: null }
      : [];

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

async function expectLoginContained(page: Page) {
  const viewport = page.viewportSize();
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

  const card = page.getByTestId('login-card');
  const captcha = page.getByTestId('login-captcha');
  await expect(card).toBeVisible();
  await expect(captcha).toBeVisible();

  const [cardBox, captchaBox] = await Promise.all([card.boundingBox(), captcha.boundingBox()]);
  expect(cardBox).not.toBeNull();
  expect(captchaBox).not.toBeNull();

  if (cardBox && captchaBox && viewport) {
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(captchaBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(captchaBox.x + captchaBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  }

  await expect(captcha).toHaveAttribute('data-size', (viewport?.width ?? 999) <= 374 ? 'compact' : 'normal');
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
  await prepareReturningVisitor(page);
});

test('login, cadastro e acesso empresarial permanecem dentro do card', async ({ page }) => {
  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await expectLoginContained(page);

  await page.getByRole('button', { name: 'Criar uma conta' }).click();
  await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  await expectLoginContained(page);

  await page.getByRole('button', { name: 'Sou uma empresa' }).click();
  await expect(page.getByRole('heading', { name: 'Área da Empresa' })).toBeVisible();
  await expectLoginContained(page);
});

test('login continua sem overflow com fonte gigante', async ({ page }) => {
  await prepareReturningVisitor(page, 'giant');
  await page.goto('/#/login');

  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'giant');
  await expectLoginContained(page);
});
