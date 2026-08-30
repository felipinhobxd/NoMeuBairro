import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const ownerId = '20000000-0000-4000-8000-000000000001';
const publicId = '20000000-0000-4000-8000-000000000002';
const userName = 'Marina Oliveira da Comunidade';
const longDescription = 'A iluminação da praça precisa de manutenção para melhorar a circulação dos moradores. '.repeat(6);
const photos = [
  { name: 'vertical', width: 640, height: 1280 },
  { name: 'horizontal', width: 1280, height: 640 },
  { name: 'panoramica', width: 1800, height: 300 },
];
const posts = [...photos.map((photo, index) => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`,
  author_id: ownerId,
  category: 'iluminacao',
  status: index === 1 ? 'resolved' : 'pending',
  title: `Iluminação na praça · foto ${photo.name}`,
  description: index === 0 ? longDescription : 'Lâmpada apagada na praça. Moradores pedem manutenção.',
  image_url: `/__fixtures__/${photo.name}.svg`,
  image_thumbnail_url: `/__fixtures__/${photo.name}.svg`,
  location: 'Praça da Comunidade, Curitiba',
  neighborhood: 'Centro',
  locality: null,
  latitude: -25.43,
  longitude: -49.27,
  is_anonymous: false,
  created_at: '2026-08-29T12:00:00.000Z',
  comments_count: 0,
  comments: [{ count: 0 }],
  post_supports: [{ count: 2 }],
  users: { name: userName, avatar_url: null },
})), {
  id: '10000000-0000-4000-8000-000000000004',
  author_id: ownerId,
  category: 'limpeza', status: 'pending', title: 'Relato sem foto',
  description: 'Primeira linha\nSegunda linha\nTerceira linha\nQuarta linha\nQuinta linha',
  image_url: null, image_thumbnail_url: null,
  location: 'Rua de teste, Curitiba', neighborhood: 'Centro', locality: null,
  latitude: -25.43, longitude: -49.27, is_anonymous: false,
  created_at: '2026-08-28T12:00:00.000Z', comments_count: 0,
  comments: [{ count: 0 }],
  post_supports: [{ count: 0 }], users: { name: userName, avatar_url: null },
}];

async function prepare(page: Page, options: { authenticated?: boolean; font?: 'medium' | 'giant'; dark?: boolean } = {}) {
  const state = {
    profile: { id: ownerId, name: userName, avatar_url: null as string | null, reputation: 5, created_at: '2026-01-01T12:00:00Z' },
    profileWrites: 0,
    avatarUploads: 0,
  };
  await page.addInitScript(({ id, name, authenticated, font, dark }) => {
    localStorage.setItem('nmb-font-size-v1', font || 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    localStorage.setItem('anb-theme', dark ? 'dark' : 'light');
    if (authenticated) {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      // Sessão exclusivamente fictícia; todas as chamadas são interceptadas abaixo.
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: expires, role: 'authenticated' })}.fixture`,
        refresh_token: 'fixture-only', expires_at: expires, expires_in: 3600, token_type: 'bearer',
        user: { id, email: 'moradora@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { name, account_type: 'resident' }, created_at: '2026-01-01T12:00:00Z' },
      }));
    }
  }, { id: ownerId, name: userName, ...options });

  await page.route('**/__fixtures__/*.svg', async route => {
    const photo = photos.find(item => route.request().url().includes(`/${item.name}.svg`))!;
    await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${photo.width}" height="${photo.height}"><rect width="100%" height="100%" fill="#e7c6a1"/><rect x="0" y="0" width="100%" height="30%" fill="#a8c2c8"/><rect x="0" y="80%" width="100%" height="20%" fill="#5b715c"/></svg>` });
  });
  await page.route('**/supabase-mock/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.endsWith('/users') || url.pathname.endsWith('/public_user_profiles')) {
      if (request.method() === 'PATCH') {
        expect(url.searchParams.get('id')).toBe(`eq.${ownerId}`);
        state.profileWrites++;
        Object.assign(state.profile, request.postDataJSON());
      }
      body = { ...state.profile, id: url.pathname.endsWith('/public_user_profiles') ? publicId : ownerId };
    } else if (url.pathname.includes('/storage/v1/object/avatars/') && request.method() === 'POST') {
      state.avatarUploads++;
      body = { Key: url.pathname.split('/object/')[1] };
    } else if (url.pathname.includes('/storage/v1/object/public/avatars/')) {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#c2410c"/></svg>' });
      return;
    } else if (url.pathname.endsWith('/posts')) {
      const idFilter = url.searchParams.get('id');
      body = idFilter?.startsWith('eq.') ? posts.find(post => post.id === idFilter.slice(3)) || null : posts;
    } else if (url.pathname.endsWith('/rpc/get_community_contribution_summary')) {
      body = { postsCount: 4, resolvedCount: 1, supportsGiven: 12, supportsReceived: 8, eventsCount: 1, eventsAttended: 3, commentsCount: 6, repliesCount: 3 };
    } else if (url.pathname.endsWith('/rpc/get_neighborhood_weekly_summary')) {
      body = { newReports: 4, previousReports: 2, resolvedReports: 1, upcomingEvents: 2, newJobs: 1, topCategory: 'iluminacao', topCategoryCount: 3 };
    } else if (url.pathname.endsWith('/app_roles') || url.pathname.endsWith('/account_deletion_requests')) {
      body = null;
    } else if (url.pathname.includes('/auth/v1/')) {
      body = { user: null, session: null };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-3/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
  });
  return state;
}

async function noHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
}

async function clickProfileControl(control: Locator) {
  await control.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await control.click();
}

test('fotos inteiras têm altura limitada e proporção preservada em cada tela', async ({ page }, info) => {
  await prepare(page);
  await page.goto('/');
  await expect(page.locator('.nmb-post-media')).toHaveCount(3);
  for (const photo of photos) {
    const image = page.locator(`.nmb-post-media img[src$="/${photo.name}.svg"]`);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(photo.width);
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(Math.max(160, Math.min(340, page.viewportSize()!.height * .32)) + 2);
    expect(box!.width / box!.height).toBeCloseTo(photo.width / photo.height, 1);
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await noHorizontalOverflow(page);
  await page.locator('.nmb-post-card').first().scrollIntoViewIfNeeded();
  const cardWidth = (await page.locator('.nmb-post-card').first().boundingBox())!.width;
  expect(cardWidth).toBeLessThanOrEqual(780);
  await expect(page.locator('.nmb-post-contact').first()).not.toHaveAttribute('open');
  await capture(page, info, 'feed-com-foto');
});

test('texto longo ou com quebras pode expandir e a foto abre pelo teclado', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  const first = page.locator('.nmb-post-card').first();
  const readMore = first.getByRole('button', { name: 'Ler descrição completa' });
  await expect(readMore).toBeVisible();
  const collapsed = (await first.locator('.nmb-post-description').boundingBox())!.height;
  await readMore.click();
  await expect(first.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
  expect((await first.locator('.nmb-post-description').boundingBox())!.height).toBeGreaterThan(collapsed);
  await first.getByRole('button', { name: 'Ver menos' }).click();
  await first.getByRole('button', { name: /Ampliar foto do relato/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fechar imagem' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fechar imagem' })).toHaveCount(0);
  const multiline = page.getByRole('article', { name: 'Relato sem foto' });
  await multiline.scrollIntoViewIfNeeded();
  await expect(multiline.getByRole('button', { name: 'Ler descrição completa' })).toBeVisible();
  await multiline.getByRole('button', { name: 'Ler descrição completa' }).click();
  await expect(multiline.locator('.nmb-post-description')).toHaveAttribute('data-expanded', 'true');
});

test('filtros, atendimento oficial, comentários e localização continuam disponíveis', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Buscar e filtrar relatos' }).click();
  await page.getByRole('tab', { name: /Resolvido/ }).click();
  await expect(page.locator('.nmb-post-card')).toHaveCount(1);
  const card = page.locator('.nmb-post-card');
  await card.locator('.nmb-post-contact > summary').click();
  await expect(card.getByRole('link', { name: /Ligar para Central 156/ })).toBeVisible();
  await card.getByRole('button', { name: /^Comentar — / }).click();
  await expect(card.getByRole('button', { name: 'Entre na sua conta para comentar' })).toBeVisible();
  await card.getByRole('button', { name: 'Ver mapa', exact: true }).click();
  await expect(page).toHaveURL(/#\/mapa$/);
  expect(await page.evaluate(() => sessionStorage.getItem('anb-map-focus-post'))).toBe(posts[1].id);
});

test('perfil público mostra relatos cedo, reorganiza as colunas e não expõe e-mail', async ({ page }, info) => {
  await prepare(page);
  await page.goto(`/#/perfil/${publicId}`);
  await expect(page.getByRole('heading', { name: userName, exact: true })).toBeVisible();
  await expect(page.locator('.nmb-profile-post')).toHaveCount(4);
  await expect(page.getByText('moradora@example.test')).toHaveCount(0);
  await noHorizontalOverflow(page);
  const content = await page.locator('.nmb-profile-content').boundingBox();
  expect(content!.y).toBeLessThan(page.viewportSize()!.height * .8);
  if (page.viewportSize()!.width >= 1024) {
    await expect(page.locator('.nmb-profile-sidebar')).toBeVisible();
    const sidebar = (await page.locator('.nmb-profile-sidebar').boundingBox())!;
    expect(sidebar.x + sidebar.width).toBeLessThan(content!.x);
    expect(Math.abs(sidebar.y - content!.y)).toBeLessThan(2);
  } else {
    await page.getByRole('button', { name: 'Informações e selos' }).click();
    await expect(page.locator('.nmb-profile-sidebar')).toBeVisible();
    await expect(page.locator('.nmb-profile-content')).toBeHidden();
    await page.getByRole('button', { name: 'Relatos públicos', exact: true }).click();
  }
  await capture(page, info, 'perfil-publico');
  await page.getByRole('link', { name: `Abrir relato: ${posts[0].title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/post/${posts[0].id}$`));
});

test('perfil próprio prioriza atividade e mantém edição e conta acessíveis', async ({ page }, info) => {
  await prepare(page, { authenticated: true });
  await page.goto('/#/perfil');
  await expect(page.getByRole('heading', { name: userName, exact: true })).toBeVisible();
  await expect(page.locator('.nmb-profile-activity-item')).toHaveCount(4);
  await expect(page.getByRole('tab', { name: /Relatos/ })).toBeVisible();
  await noHorizontalOverflow(page);
  await capture(page, info, 'perfil-proprio');
  await page.locator('.nmb-profile-header').getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Editar perfil' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Editar perfil' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  if (page.viewportSize()!.width < 1024) await page.getByRole('button', { name: 'Informações e selos' }).click();
  await expect(page.getByRole('button', { name: 'Alterar senha', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar meus dados', exact: true })).toBeVisible();
  await page.locator('.nmb-profile-more-badges > summary').click();
  await expect(page.locator('.nmb-profile-badge:visible')).toHaveCount(10);
});

test('recorte exibe só suas três ações e restaura o salvamento do perfil', async ({ page }, info) => {
  const state = await prepare(page, { authenticated: true });
  await page.goto('/#/perfil');
  await page.locator('.nmb-profile-header').getByRole('button', { name: 'Editar perfil', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar perfil' });
  const updatedName = 'Marina Oliveira de teste';
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(updatedName);
  // Synthetic image and mocked uploads only: never changes production photos.
  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#047857'; context.fillRect(0, 0, 640, 480);
    context.fillStyle = '#f97316'; context.fillRect(240, 100, 160, 280);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const image = { name: 'avatar-fixture.png', mimeType: 'image/png', buffer: Buffer.from(imageBase64, 'base64') };
  const choosePhoto = async () => {
    await dialog.locator('input[type="file"]').setInputFiles(image);
    await expect(dialog.getByRole('img', { name: 'Recorte da foto de perfil' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Recentrar', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Usar foto', exact: true })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Finalize o recorte acima', { exact: true })).toHaveCount(0);
  };

  await choosePhoto();
  const zoom = dialog.getByRole('slider', { name: 'Zoom da foto' });
  await zoom.press('ArrowRight');
  await expect(zoom).toHaveValue('1.01');
  await clickProfileControl(dialog.getByRole('button', { name: 'Recentrar', exact: true }));
  await expect(zoom).toHaveValue('1');
  await noHorizontalOverflow(page);
  await capture(page, info, 'perfil-recorte-sem-botoes-duplicados');
  await clickProfileControl(dialog.getByRole('button', { name: 'Cancelar', exact: true }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Escolher foto' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue(updatedName);

  await choosePhoto();
  await clickProfileControl(dialog.getByRole('button', { name: 'Usar foto', exact: true }));
  const preview = dialog.getByRole('img', { name: 'Foto de perfil', exact: true });
  await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await expect(preview).toHaveJSProperty('naturalWidth', 512);
  await expect(preview).toHaveJSProperty('naturalHeight', 512);
  const croppedPhoto = await preview.getAttribute('src');
  await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(1);

  await choosePhoto();
  await clickProfileControl(dialog.getByRole('button', { name: 'Cancelar', exact: true }));
  await expect(preview).toHaveAttribute('src', croppedPhoto!);
  expect(state.avatarUploads).toBe(0);
  expect(state.profileWrites).toBe(0);
  await clickProfileControl(dialog.getByRole('button', { name: 'Salvar', exact: true }));
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: updatedName, exact: true })).toBeVisible();
  expect(state.avatarUploads).toBe(1);
  expect(state.profileWrites).toBe(1);
  expect(state.profile.avatar_url).toContain(`/storage/v1/object/public/avatars/${ownerId}/avatar-`);
});

test('fonte gigante e tema escuro preservam reflow no feed e perfil', async ({ page }, info) => {
  await prepare(page, { authenticated: true, font: 'giant', dark: true });
  await page.goto('/');
  await expect(page.locator('.nmb-post-card')).toHaveCount(4);
  await noHorizontalOverflow(page);
  await page.goto('/#/perfil');
  await expect(page.getByRole('heading', { name: userName, exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  if (page.viewportSize()!.width < 1280) {
    await page.getByRole('button', { name: 'Informações e selos' }).click();
    await expect(page.locator('.nmb-profile-sidebar')).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await capture(page, info, 'perfil-fonte-gigante-escuro');
});

test('feed e perfil não têm violações graves de acessibilidade', async ({ page }) => {
  await prepare(page, { authenticated: true });
  const violations: Array<{ page: string; id: string; help: string; targets: unknown[] }> = [];
  for (const [url, selector] of [['/', '.nmb-feed'], ['/#/perfil', '.nmb-profile']] as const) {
    await page.goto(url);
    await expect(page.locator(selector)).toBeVisible();
    if (url.includes('perfil')) await expect(page.locator('.nmb-profile-activity-item')).toHaveCount(4);
    else await expect(page.locator('.nmb-post-card')).toHaveCount(4);
    // Mede as cores finais, não a opacidade intermediária do fade de entrada.
    // Animações contínuas de seleção não devem bloquear a auditoria.
    await page.locator(selector).evaluate(async root => {
      await document.fonts.ready;
      const entranceAnimations = root.getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(entranceAnimations.map(animation => animation.finished.catch(() => undefined)));
    });
    const results = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    violations.push(...results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ page: url, id: v.id, help: v.help, targets: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) })));
  }
  expect(violations).toEqual([]);
});
