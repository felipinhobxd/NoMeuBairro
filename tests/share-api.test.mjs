import assert from 'node:assert/strict';
import test from 'node:test';
import sharePostHandler from '../api/share-post.js';

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = String(value); return this; },
    end() { return this; },
  };
}

test('a página social escapa texto do banco e aponta para o relato no PWA', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY; else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: '123e4567-e89b-42d3-a456-426614174000',
    title: '<script>alert(1)</script>',
    description: 'Rua & bairro "teste"',
    image_url: null,
    location: 'Curitiba',
    category: 'buraco',
  }]), { status: 200, headers: { 'content-type': 'application/json' } });

  const req = {
    method: 'GET',
    query: { id: '123e4567-e89b-42d3-a456-426614174000' },
    headers: { host: 'nomeubairro.vercel.app', 'x-forwarded-proto': 'https' },
  };
  const res = responseRecorder();
  await sharePostHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/);
  assert.match(res.body, /content="0;url=https:\/\/nomeubairro\.vercel\.app\/#\/post\/123e4567-e89b-42d3-a456-426614174000"/);
  assert.match(res.body, /property="og:title"/);
});

test('a página social rejeita identificadores inválidos', async () => {
  const res = responseRecorder();
  await sharePostHandler({ method: 'GET', query: { id: '../segredo' }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
