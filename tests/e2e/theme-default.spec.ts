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

async function seedThemeAndWatch(page: Page, theme: 'light' | 'dark' | null) {
  await page.addInitScript((initialTheme) => {
    if (sessionStorage.getItem('__nmb-theme-seeded') !== '1') {
      if (initialTheme === null) localStorage.removeItem('anb-theme');
      else localStorage.setItem('anb-theme', initialTheme);
      sessionStorage.setItem('__nmb-theme-seeded', '1');
    }

    const history: string[] = [];
    (globalThis as typeof globalThis & { __nmbThemeClassHistory?: string[] }).__nmbThemeClassHistory = history;
    const capture = () => history.push(document.documentElement.className);
    capture();
    new MutationObserver(capture).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }, theme);
}

async function savedTheme(page: Page) {
  return page.evaluate(() => localStorage.getItem('anb-theme'));
}

async function classHistory(page: Page) {
  return page.evaluate(() =>
    (globalThis as typeof globalThis & { __nmbThemeClassHistory?: string[] }).__nmbThemeClassHistory ?? []
  );
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
});

test('primeira visita e sessão privada começam claras mesmo com sistema escuro, sem flash escuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedThemeAndWatch(page, null);

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await expect.poll(() => savedTheme(page)).toBe('light');
  expect((await classHistory(page)).some((classes) => classes.split(/\s+/).includes('dark'))).toBe(false);
});

test('preferência clara salva é respeitada e continua clara após reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedThemeAndWatch(page, 'light');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await savedTheme(page)).toBe('light');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await savedTheme(page)).toBe('light');
});

test('preferência escura salva é respeitada e continua escura após reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seedThemeAndWatch(page, 'dark');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await savedTheme(page)).toBe('dark');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await savedTheme(page)).toBe('dark');
});
