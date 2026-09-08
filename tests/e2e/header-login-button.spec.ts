import { expect, test } from '@playwright/test';

test('Entrar mantém ícone e texto dentro do botão no cabeçalho desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('anb-theme', 'light');
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
  });

  await page.routeWebSocket('**/supabase-mock/realtime/**', socket => { socket.onMessage(() => {}); });
  await page.route('**/supabase-mock/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.includes('/auth/v1/')
      ? { user: null, session: null }
      : path.endsWith('/get_neighborhood_weekly_summary')
        ? null
        : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://vlibras.gov.br/**', route => route.abort());

  await page.goto('/');
  const button = page.locator('header[role="banner"] button[aria-label="Entrar"]');
  await expect(button).toBeVisible();
  await expect(button.getByText('Entrar', { exact: true })).toBeVisible();

  const geometry = await button.evaluate((element) => {
    const buttonRect = element.getBoundingClientRect();
    const children = Array.from(element.children).map(child => child.getBoundingClientRect());
    return {
      width: buttonRect.width,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      childrenInside: children.every(rect =>
        rect.left >= buttonRect.left - 0.5 &&
        rect.right <= buttonRect.right + 0.5 &&
        rect.top >= buttonRect.top - 0.5 &&
        rect.bottom <= buttonRect.bottom + 0.5
      ),
    };
  });

  expect(geometry.width).toBeGreaterThan(38);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.childrenInside).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
