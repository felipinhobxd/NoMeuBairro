import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('a primeira visita exige escolha de fonte antes do restante do aplicativo', async () => {
  const source = await read('src/contexts/FontSizeContext.tsx');
  assert.match(source, /stored \?\? 'medium'/);
  assert.match(source, /\{hasChosen \? children : null\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /aria-checked=\{active\}/);
});

test('o guia só pode iniciar depois de uma escolha de cookies', async () => {
  const [safety, experience] = await Promise.all([
    read('src/components/Safety.tsx'),
    read('src/components/ProductExperience.tsx'),
  ]);
  assert.match(safety, /Antes do guia: escolha os cookies/);
  assert.match(safety, /Concordo com cookies/);
  assert.match(safety, /aria-labelledby="cookie-consent-title"/);
  assert.match(experience, /if \(!cookieChoiceMade\) return/);
  assert.match(experience, /if \(!cookieChoiceMade \|\| !isNeighborhoodSelected \|\| suppressed\) return/);
});

test('links de relatos usam uma página compartilhável com metadados sociais', async () => {
  const [share, feed, details, api, imageApi, vercel, serviceWorker] = await Promise.all([
    read('src/utils/share.ts'),
    read('src/pages/Feed.tsx'),
    read('src/pages/PostDetails.tsx'),
    read('api/share-post.js'),
    read('api/post-image.js'),
    read('vercel.json'),
    read('public/sw.js'),
  ]);
  assert.match(share, /return `\/relato\/\$\{encodeURIComponent\(postId\)\}`/);
  assert.match(feed, /postShareUrl\(post\.id\)/);
  assert.match(details, /postShareUrl\(post\.id\)/);
  assert.match(api, /property="og:title"/);
  assert.match(api, /name="twitter:card"/);
  assert.match(api, /escapeHtml\(summary\)/);
  assert.match(imageApi, /\[1-5\]\[0-9a-f\]\{3\}/);
  assert.match(imageApi, /\[89ab\]\[0-9a-f\]\{3\}/);
  assert.match(vercel, /"source": "\/relato\/:postId"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/relato\/'\)/);
  assert.match(serviceWorker, /event\.respondWith\(fetch\(request\)\)/);
});

test('controles sensíveis têm RLS e privilégios explícitos', async () => {
  const migration = await read('database/20260818_civic_followup_and_account_controls.sql');
  assert.match(migration, /alter table public\.account_deletion_requests enable row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant select, insert, update, delete on table public\.account_deletion_requests to authenticated/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /grant execute on function public\.find_similar_posts/);
  assert.doesNotMatch(migration, /security definer[\s\S]*find_similar_posts/i);
});

test('prevenção de duplicados ocorre antes do upload da imagem', async () => {
  const [source, anonymousFunction] = await Promise.all([
    read('src/contexts/DataContext.tsx'),
    read('supabase/functions/anonymous-post-control/index.ts'),
  ]);
  const duplicateCheck = source.indexOf("supabase.rpc('find_similar_posts'");
  const imageUpload = source.indexOf('storePostImage(data.imageUrl, user.id)');
  assert.ok(duplicateCheck >= 0, 'RPC de relatos similares não encontrada');
  assert.ok(imageUpload > duplicateCheck, 'a imagem não deve ser enviada antes da verificação de duplicados');
  const anonymousDuplicateCheck = anonymousFunction.indexOf("admin.rpc('find_similar_posts'");
  const anonymousImageUpload = anonymousFunction.indexOf('uploadAnonymousImage(body?.imageData)');
  assert.ok(anonymousDuplicateCheck >= 0, 'verificação de duplicados anônimos não encontrada');
  assert.ok(anonymousImageUpload > anonymousDuplicateCheck, 'imagem anônima não deve ser enviada antes da verificação de duplicados');
});

test('consultas frequentes usam cache curto e uma única leitura de permissões', async () => {
  const [cache, dataContext, authContext, feed, layout, productExperience, postDetails] = await Promise.all([
    read('src/utils/sessionQueryCache.ts'),
    read('src/contexts/DataContext.tsx'),
    read('src/contexts/AuthContext.tsx'),
    read('src/pages/Feed.tsx'),
    read('src/components/Layout.tsx'),
    read('src/components/ProductExperience.tsx'),
    read('src/pages/PostDetails.tsx'),
  ]);

  assert.match(cache, /window\.sessionStorage/);
  assert.match(cache, /fresh: ageMs <= maxAgeMs/);
  assert.match(dataContext, /POSTS_CACHE_MAX_AGE_MS = 2 \* 60 \* 1000/);
  assert.match(dataContext, /EVENTS_CACHE_MAX_AGE_MS = 5 \* 60 \* 1000/);
  assert.match(dataContext, /readSessionQueryCache<Post\[]>/);
  assert.match(dataContext, /writeSessionQueryCache\(POSTS_CACHE_KEY/);
  assert.match(authContext, /\.from\('app_roles'\)/);

  for (const source of [feed, layout, productExperience, postDetails]) {
    assert.doesNotMatch(source, /\.from\('app_roles'\)/);
  }
});

test('itens salvos compartilham uma única leitura por sessão', async () => {
  const savedItems = await read('src/hooks/useSavedItems.ts');
  assert.match(savedItems, /SAVED_ITEMS_CACHE_MAX_AGE_MS = 2 \* 60 \* 1000/);
  assert.match(savedItems, /savedItemsInFlight/);
  assert.match(savedItems, /select\('post_id,event_id,job_id'\)/);
  assert.match(savedItems, /readSessionQueryCache<SavedSnapshot>/);
  assert.match(savedItems, /SAVED_ITEMS_UPDATED_EVENT/);
  assert.doesNotMatch(savedItems, /select\(column\)/);
});

test('senhas novas exigem pelo menos oito caracteres sem bloquear logins antigos', async () => {
  const [security, login, profile] = await Promise.all([
    read('src/config/authSecurity.ts'),
    read('src/pages/Login.tsx'),
    read('src/pages/Profile.tsx'),
  ]);
  assert.match(security, /MIN_NEW_PASSWORD_LENGTH = 8/);
  assert.match(login, /register \? MIN_NEW_PASSWORD_LENGTH : 6/);
  assert.match(login, /password\.length < MIN_NEW_PASSWORD_LENGTH/);
  assert.match(profile, /newPwd\.length < MIN_NEW_PASSWORD_LENGTH/);
  assert.doesNotMatch(login, /pelo menos 6 caracteres/);
  assert.doesNotMatch(profile, /pelo menos 6 caracteres/);
});

test('feeds longos têm renderização progressiva e otimização fora da tela', async () => {
  const [feed, polish] = await Promise.all([
    read('src/pages/Feed.tsx'),
    read('src/ux-polish.css'),
  ]);
  assert.match(feed, /FEED_RENDER_BATCH = 20/);
  assert.match(feed, /renderedPosts\.map/);
  assert.match(feed, /Mostrar mais relatos/);
  assert.match(feed, /loading="lazy" decoding="async"/);
  assert.match(polish, /content-visibility: auto/);
});

test('PWA sempre verifica a versão nova do service worker', async () => {
  const [main, serviceWorker, manifest] = await Promise.all([
    read('src/main.tsx'),
    read('public/sw.js'),
    read('public/manifest.webmanifest'),
  ]);
  assert.match(main, /updateViaCache: 'none'/);
  assert.match(main, /registration\.update\(\)/);
  assert.match(serviceWorker, /CACHE_VERSION = 'v6'/);
  assert.match(serviceWorker, /IMAGE_CACHE_MAX_ENTRIES = 48/);
  assert.match(serviceWorker, /IMAGE_CACHE_MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/post-image'\)/);
  assert.match(serviceWorker, /networkFirst\(request, \{ cacheName: IMAGE_CACHE, image: true \}\)/);
  assert.match(manifest, /icon-maskable-512\.png/);
  assert.match(manifest, /"short_name": "Relatar"/);
  assert.match(manifest, /"short_name": "Mapa"/);
});

test('build e upload de imagens mantêm compatibilidade com celulares menos recentes', async () => {
  const [viteConfig, imageStorage] = await Promise.all([
    read('vite.config.ts'),
    read('src/utils/imageStorage.ts'),
  ]);
  assert.match(viteConfig, /target: 'es2019'/);
  assert.match(imageStorage, /typeof crypto\.randomUUID === 'function'/);
  assert.match(imageStorage, /crypto\.getRandomValues\(bytes\)/);
});
