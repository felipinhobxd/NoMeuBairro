import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';

const authorId = '20000000-0000-4000-8000-000000000011';
const postId = '10000000-0000-4000-8000-000000000011';
const secondPostId = '10000000-0000-4000-8000-000000000012';
const rootId = '30000000-0000-4000-8000-000000000001';
const replyId = '30000000-0000-4000-8000-000000000002';
const otherId = '30000000-0000-4000-8000-000000000003';

const comment = (id: string, content: string, parentId: string | null = null) => ({
  id, post_id: postId, author_id: authorId, parent_id: parentId, content,
  created_at: '2026-08-30T12:00:00Z', users: { name: 'Moradora de teste', avatar_url: null },
});

async function setup(page: Page, options: { authenticated?: boolean; dark?: boolean; giant?: boolean } = {}) {
  const state = {
    comments: [comment(rootId, 'Comentário inicial'), comment(replyId, 'Resposta inicial', rootId), comment(otherId, 'Outra conversa')],
    countReads: 0, commentReads: 0, feedReads: 0, feedSelects: [] as string[],
    failInsert: false, deleteMode: 'ok' as 'ok' | 'denied' | 'empty',
    supported: false, supports: 2, saved: false, status: 'in_progress', nextId: 10,
    countReadIds: [] as string[],
  };
  await page.addInitScript(({ id, authenticated, dark, giant }) => {
    localStorage.setItem('nmb-font-size-v1', giant ? 'giant' : 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    localStorage.setItem('anb-theme', dark ? 'dark' : 'light');
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (payload: ShareData) => {
      document.documentElement.dataset.testSharedUrl = payload.url;
    } });
    if (authenticated) {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: expires, role: 'authenticated' })}.fixture`,
        refresh_token: 'fixture-only', expires_at: expires, expires_in: 3600, token_type: 'bearer',
        user: { id, email: 'moradora@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Moradora de teste', account_type: 'resident' }, created_at: '2026-01-01T12:00:00Z' },
      }));
    }
  }, { id: authorId, authenticated: options.authenticated ?? true, ...options });

  const makePost = (id = postId) => ({
    id, author_id: authorId, title: id === postId ? 'Buraco na rua da comunidade' : 'Iluminação recuperada',
    description: 'Os moradores estão acompanhando o atendimento. Obrigado por contribuir com o bairro.',
    category: id === postId ? 'buraco' : 'iluminacao', status: id === postId ? state.status : 'resolved',
    image_url: id === postId ? '/__fixtures__/feed-street.svg' : null,
    image_thumbnail_url: id === postId ? '/__fixtures__/feed-street.svg' : null,
    location: 'Rua da Comunidade, Curitiba', neighborhood: 'Centro', locality: null,
    latitude: -25.43, longitude: -49.27, is_anonymous: false,
    created_at: id === postId ? '2026-08-30T12:00:00Z' : '2026-08-29T12:00:00Z',
    comments_count: 0, // Deliberately stale: the actual aggregate must win.
    comments: [{ count: id === postId ? state.comments.length : 0 }],
    post_supports: [{ count: id === postId ? state.supports : 1 }],
    users: { name: 'Moradora de teste', avatar_url: null },
  });

  await page.route('**/__fixtures__/feed-street.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500"><rect width="1200" height="500" fill="#9ac4d3"/><path d="M0 200H1200V500H0Z" fill="#c6c9c3"/><path d="M520 200L230 500H1000L660 200Z" fill="#69717c"/><path d="M590 260L580 310M560 340L540 400M520 435L500 480" stroke="#f3dfa0" stroke-width="12"/><path d="M40 140H310V360H40ZM820 100H1120V350H820Z" fill="#d1a276"/></svg>' }));

  await page.route('**/supabase-mock/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const select = url.searchParams.get('select') || '';
    let body: unknown = [];
    let status = 200;
    if (url.pathname.endsWith('/users') || url.pathname.endsWith('/public_user_profiles')) {
      body = { id: authorId, name: 'Moradora de teste', avatar_url: null, reputation: 1, created_at: '2026-01-01T12:00:00Z' };
    } else if (url.pathname.endsWith('/posts')) {
      if (method === 'PATCH') {
        state.status = request.postDataJSON().status;
      } else if (!select.includes('title')) {
        state.countReads++;
        const filter = url.searchParams.get('id') || '';
        state.countReadIds.push(filter);
        body = [postId, secondPostId].filter(id => filter.includes(id)).map(id => ({ id, comments: [{ count: id === postId ? state.comments.length : 0 }] }));
      } else {
        state.feedReads++;
        state.feedSelects.push(select);
        body = url.searchParams.get('id')?.startsWith('eq.') ? makePost() : [makePost(), makePost(secondPostId)];
      }
    } else if (url.pathname.endsWith('/comments')) {
      if (method === 'POST') {
        if (state.failInsert) { status = 403; body = { message: 'Falha simulada ao comentar', code: '42501' }; }
        else {
          const input = request.postDataJSON();
          const next = comment(`30000000-0000-4000-8000-${String(state.nextId++).padStart(12, '0')}`, input.content, input.parent_id || null);
          state.comments.push(next);
          body = next;
        }
      } else if (method === 'DELETE') {
        if (state.deleteMode === 'denied') { status = 403; body = { message: 'Exclusão não permitida', code: '42501' }; }
        else if (state.deleteMode === 'empty') body = [];
        else {
          const id = url.searchParams.get('id')!.slice(3);
          const found = state.comments.find(item => item.id === id);
          const removed = new Set([id]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const item of state.comments) if (item.parent_id && removed.has(item.parent_id) && !removed.has(item.id)) { removed.add(item.id); changed = true; }
          }
          state.comments = state.comments.filter(item => !removed.has(item.id));
          body = found ? [{ id, post_id: postId }] : [];
        }
      } else {
        state.commentReads++;
        body = state.comments.slice(0, Number(url.searchParams.get('limit') || 100));
      }
    } else if (url.pathname.endsWith('/post_supports')) {
      if (method === 'POST') { state.supported = true; state.supports++; }
      else if (method === 'DELETE') { state.supported = false; state.supports--; }
      else body = state.supported ? { id: 'support-fixture' } : null;
    } else if (url.pathname.endsWith('/saved_items')) {
      if (method === 'POST') state.saved = true;
      else if (method === 'DELETE') state.saved = false;
      else body = state.saved ? [{ post_id: postId, event_id: null, job_id: null }] : [];
    } else if (url.pathname.endsWith('/app_roles')) body = null;
    else if (url.pathname.includes('/auth/v1/')) body = { user: null, session: null };
    else if (url.pathname.endsWith('/rpc/get_neighborhood_weekly_summary')) body = null;
    await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });

  // Real supabase-js subscription and callbacks, with a deterministic local
  // Phoenix/Realtime server; never connects to or mutates production data.
  type Binding = { id: number; event: string; schema: string; table: string; filter: string };
  const subscriptions = new Map<string, { socket: WebSocketRoute; joinRef: string; filters: Binding[] }>();
  await page.routeWebSocket('**/supabase-mock/realtime/v1/websocket**', socket => {
    socket.onMessage(message => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
      if (event === 'phx_join') {
        const filters = (payload.config?.postgres_changes || []).map((filter: object, i: number) => ({ ...filter, id: i + 1 }));
        subscriptions.set(topic, { socket, joinRef, filters });
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: filters } }]));
      } else if (event === 'phx_leave') {
        subscriptions.delete(topic);
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      } else if (event === 'heartbeat') socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
    socket.onClose(() => { for (const [topic, sub] of subscriptions) if (sub.socket === socket) subscriptions.delete(topic); });
  });

  return {
    state,
    subscribed: () => [...subscriptions.keys()].some(topic => topic.includes('feed-comment-counts')),
    emitCountChange: () => {
      for (const [topic, sub] of subscriptions) {
        const filters = sub.filters.filter(filter => filter.table === 'posts' && filter.filter.includes(postId));
        if (!filters.length) continue;
        sub.socket.send(JSON.stringify([sub.joinRef, null, topic, 'postgres_changes', {
          ids: filters.map(filter => filter.id),
          data: { schema: 'public', table: 'posts', type: 'UPDATE', commit_timestamp: new Date().toISOString(),
            columns: [{ name: 'id', type: 'uuid' }, { name: 'comments_count', type: 'int4' }],
            record: { id: postId, comments_count: state.comments.length }, old_record: { id: postId }, errors: null },
        }]));
      }
    },
  };
}

const firstCard = (page: Page) => page.locator(`#post-${postId}`);
const total = (page: Page) => firstCard(page).locator('.nmb-post-comment-total');
const commentsButton = (page: Page) => firstCard(page).getByRole('button', { name: /^Comentários \(/ });

async function clickFeedControl(control: Locator) {
  // Scroll as a reader would: a point merely inside the viewport can still be
  // covered by the sticky header, mobile navigation or accessibility widget.
  // Keep a real hit-tested click; never force clicks through those overlays.
  await control.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await control.click();
}

async function settle(page: Page) {
  await page.locator('.nmb-feed').evaluate(async root => {
    await document.fonts.ready;
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)));
  });
}

test('cards separados, barra leve e total antes de abrir sem baixar comentários', async ({ page }, info) => {
  const { state } = await setup(page);
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  await expect(commentsButton(page)).toHaveAttribute('aria-expanded', 'false');
  expect(state.commentReads).toBe(0);
  expect(state.feedSelects[0]).toContain('comments!comments_post_id_fkey(count)');
  await expect(firstCard(page).getByRole('group', { name: 'Ações da publicação' }).getByRole('button')).toHaveCount(3);
  await expect(firstCard(page).getByRole('button', { name: 'Denunciar', exact: true })).toBeHidden();
  await settle(page);
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const cards = [...document.querySelectorAll('.nmb-post-card')];
    const first = cards[0].getBoundingClientRect();
    const second = cards[1].getBoundingClientRect();
    return { main: getComputedStyle(main).backgroundColor, card: getComputedStyle(cards[0]).backgroundColor, shadow: getComputedStyle(cards[0]).boxShadow,
      border: getComputedStyle(cards[0]).borderTopWidth, gap: second.top - first.bottom,
      buttons: [...cards[0].querySelectorAll('.nmb-post-actions > button')].map(button => button.getBoundingClientRect().toJSON()),
      viewport: innerWidth, document: document.documentElement.scrollWidth };
  });
  expect(metrics.main).toBe('rgb(233, 237, 242)');
  expect(metrics.card).toBe('rgb(255, 255, 255)');
  expect(metrics.shadow).not.toBe('none');
  expect(metrics.border).toBe('1px');
  expect(metrics.gap).toBeGreaterThanOrEqual(12);
  expect(metrics.gap).toBeLessThanOrEqual(20);
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  for (const button of metrics.buttons) {
    expect(button.y).toBeCloseTo(metrics.buttons[0].y, 0);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeLessThanOrEqual(56);
  }
  await info.attach('feed-cards-e-acoes', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
});

test('adicionar, responder e excluir conversa atualizam total sem recarregar', async ({ page }) => {
  const { state } = await setup(page);
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  await commentsButton(page).click();
  await expect(firstCard(page).getByText('Comentário inicial', { exact: true })).toBeVisible();
  await firstCard(page).getByRole('textbox', { name: 'Escreva um comentário' }).fill('Novo comentário de teste');
  await clickFeedControl(firstCard(page).getByRole('button', { name: 'Enviar', exact: true }));
  await expect(total(page)).toHaveText('4 comentários');
  const root = page.locator(`[data-comment-id="${rootId}"]`);
  await root.getByRole('button', { name: 'Responder', exact: true }).first().click();
  await firstCard(page).getByRole('textbox', { name: 'Escreva um comentário' }).fill('Mais uma resposta');
  await clickFeedControl(firstCard(page).getByRole('button', { name: 'Enviar', exact: true }));
  await expect(total(page)).toHaveText('5 comentários');
  await root.getByRole('button', { name: 'Excluir', exact: true }).first().click();
  await expect(total(page)).toHaveText('2 comentários');
  await expect(page.locator(`[data-comment-id="${replyId}"]`)).toHaveCount(0);
  await expect(firstCard(page).getByText('Mais uma resposta', { exact: true })).toHaveCount(0);
  await commentsButton(page).click();
  await expect(total(page)).toHaveText('2 comentários');
  await commentsButton(page).click();
  await expect(firstCard(page).getByText('Novo comentário de teste', { exact: true })).toBeVisible();
  await expect(total(page)).toHaveText('2 comentários');
  expect(state.feedReads).toBe(1);
});

test('falhas e exclusão recusada não alteram a contagem nem removem comentários', async ({ page }) => {
  const { state } = await setup(page);
  await page.goto('/');
  await commentsButton(page).click();
  await expect(firstCard(page).getByText('Comentário inicial', { exact: true })).toBeVisible();
  state.failInsert = true;
  await firstCard(page).getByRole('textbox', { name: 'Escreva um comentário' }).fill('Não deve ser gravado');
  await clickFeedControl(firstCard(page).getByRole('button', { name: 'Enviar', exact: true }));
  await expect(page.getByText('Falha simulada ao comentar', { exact: true })).toBeVisible();
  await expect(total(page)).toHaveText('3 comentários');
  state.deleteMode = 'denied';
  await page.locator(`[data-comment-id="${otherId}"]`).getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByText('Exclusão não permitida', { exact: true })).toBeVisible();
  await expect(total(page)).toHaveText('3 comentários');
  state.deleteMode = 'empty';
  await page.locator(`[data-comment-id="${otherId}"]`).getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByText('O comentário já foi removido ou você não tem permissão para excluí-lo.', { exact: true })).toBeVisible();
  await expect(firstCard(page).getByText('Outra conversa', { exact: true })).toBeVisible();
  await expect(total(page)).toHaveText('3 comentários');
});

test('total não é truncado pelos 100 comentários carregados e cascata conta respostas ocultas', async ({ page }) => {
  const { state } = await setup(page);
  state.comments = [comment(rootId, 'Conversa com muitas respostas'), ...Array.from({ length: 124 }, (_, i) => comment(`40000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `Resposta ${i}`, rootId))];
  await page.goto('/');
  await expect(total(page)).toHaveText('125 comentários');
  await commentsButton(page).click();
  await expect(firstCard(page).locator('[data-comment-id]')).toHaveCount(100);
  await expect(total(page)).toHaveText('125 comentários');
  await page.locator(`[data-comment-id="${rootId}"]`).getByRole('button', { name: 'Excluir', exact: true }).first().click();
  await expect(total(page)).toHaveText('0 comentários');
  await expect(firstCard(page).locator('[data-comment-id]')).toHaveCount(0);
});

test('Realtime atualiza inclusão e exclusão externas com conversa fechada', async ({ page }) => {
  const fixture = await setup(page, { authenticated: false });
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  await expect.poll(fixture.subscribed).toBe(true);
  fixture.state.comments.push(comment('remote', 'Comentário de outro morador'));
  fixture.emitCountChange();
  await expect(total(page)).toHaveText('4 comentários');
  fixture.state.comments = fixture.state.comments.filter(item => item.id !== 'remote');
  fixture.emitCountChange();
  await expect(total(page)).toHaveText('3 comentários');
  await expect(commentsButton(page)).toHaveAttribute('aria-expanded', 'false');
  expect(fixture.state.commentReads).toBe(0);
  expect(fixture.state.feedReads).toBe(1);
  expect(fixture.state.countReads).toBeLessThanOrEqual(5);
  expect(fixture.state.countReadIds.every(filter => filter.includes(postId))).toBe(true);
});

test('feed em cache revalida somente totais antes de exibir a lista', async ({ page }) => {
  const { state } = await setup(page, { authenticated: false });
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  state.comments.push(comment('remote', 'Novo comentário no servidor'));
  await page.reload();
  await expect(total(page)).toHaveText('4 comentários');
  expect(state.feedReads).toBe(1);
  expect(state.commentReads).toBe(0);
});

test('apoio, compartilhamento, salvos, denúncia e situação continuam acessíveis', async ({ page }) => {
  const { state } = await setup(page);
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  const card = firstCard(page);
  await card.getByRole('button', { name: 'Apoiar', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Apoiar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.nmb-post-support-total')).toHaveText('3 apoios');
  await card.getByRole('button', { name: 'Apoiar', exact: true }).click();
  await expect(card.locator('.nmb-post-support-total')).toHaveText('2 apoios');
  await card.getByRole('button', { name: 'Compartilhar relato', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-test-shared-url', new RegExp(`/relato/${postId}$`));
  await card.getByRole('button', { name: 'Mais opções do relato' }).click();
  await card.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Salvo', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: 'Salvo', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Salvar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await card.getByRole('button', { name: 'Resolvido', exact: true }).click();
  await expect(card.locator('.nmb-post-header')).toContainText('Resolvido');
  expect(state.status).toBe('resolved');
  await card.getByRole('button', { name: 'Denunciar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Denunciar Conteúdo' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Denunciar Conteúdo' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await card.getByRole('button', { name: 'Mais opções do relato' }).focus();
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button', { name: 'Mais opções do relato' })).toHaveAttribute('aria-expanded', 'false');
  await card.getByRole('button', { name: 'Mais opções do relato' }).click();
  await card.getByRole('link', { name: 'Abrir', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/post/${postId}$`));
});

test('tema escuro, fonte gigante e opções abertas mantêm contraste e reflow', async ({ page }, info) => {
  await setup(page, { dark: true, giant: true });
  await page.goto('/');
  await expect(total(page)).toHaveText('3 comentários');
  await clickFeedControl(firstCard(page).getByRole('button', { name: 'Mais opções do relato' }));
  await settle(page);
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    main: getComputedStyle(document.querySelector('main')!).backgroundColor,
    card: getComputedStyle(document.querySelector('.nmb-post-card')!).backgroundColor,
    buttons: [...document.querySelectorAll('.nmb-post-card:first-child .nmb-post-actions > button')].map(button => ({ width: button.clientWidth, scroll: button.scrollWidth, height: button.clientHeight })),
  }));
  expect(metrics.main).not.toBe(metrics.card);
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  for (const button of metrics.buttons) {
    expect(button.scroll).toBeLessThanOrEqual(button.width + 1);
    expect(button.height).toBeLessThanOrEqual(84);
  }
  const scan = await new AxeBuilder({ page }).include('.nmb-feed').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }))).toEqual([]);
  await info.attach('feed-escuro-fonte-gigante', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
});
