import assert from 'node:assert/strict';
import test from 'node:test';
import { commentThreadIds, createPostCommentCountSync, readPostCommentCount } from '../src/utils/postCommentCounts.ts';

const row = (id, count) => ({ id, comments: [{ count }] });

test('o total real prevalece sobre contador legado e inclui zero', () => {
  assert.equal(readPostCommentCount({ comments: [{ count: 3 }], comments_count: 0 }), 3);
  assert.equal(readPostCommentCount({ comments: [{ count: 0 }], comments_count: 99 }), 0);
  assert.equal(readPostCommentCount({ comments: [{ count: 125 }] }), 125);
  assert.equal(readPostCommentCount({ comments_count: 2 }), 2);
  assert.equal(readPostCommentCount({ comments: [{ count: -1 }] }), 0);
});

test('excluir uma conversa remove descendentes em qualquer ordem sem atingir outras', () => {
  const comments = [{ id: 'grandchild', parentId: 'reply' }, { id: 'other' }, { id: 'reply', parentId: 'root' }, { id: 'root' }];
  assert.deepEqual([...commentThreadIds(comments, 'root')].sort(), ['grandchild', 'reply', 'root']);
  assert.deepEqual([...commentThreadIds(comments, 'reply')].sort(), ['grandchild', 'reply']);
});

test('contagens simultâneas são deduplicadas em lotes limitados, nunca uma consulta por card', async () => {
  const queries = [];
  const accepted = new Map();
  const sync = createPostCommentCountSync(async ids => { queries.push(ids); return ids.map(id => row(id, 4)); }, counts => counts.forEach((count, id) => accepted.set(id, count)));
  const ids = Array.from({ length: 150 }, (_, i) => `post-${i}`);
  await Promise.all([sync.refresh(ids), sync.refresh(ids.slice(0, 30)), sync.refresh(['post-2'])]);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(ids => ids.length <= 100));
  assert.equal(accepted.size, 150);
});

test('uma resposta atrasada não sobrescreve a contagem posterior à mutação', async () => {
  let finishOld;
  let queryCount = 0;
  const accepted = [];
  const sync = createPostCommentCountSync(async () => {
    queryCount++;
    if (queryCount === 1) return new Promise(resolve => { finishOld = resolve; });
    return [row('post', 5)];
  }, counts => accepted.push(counts.get('post')));
  const initial = sync.refresh(['post']);
  await Promise.resolve();
  const afterMutation = sync.refresh(['post']);
  finishOld([row('post', 3)]);
  await Promise.all([initial, afterMutation]);
  assert.deepEqual(accepted, [5]);
  assert.equal(queryCount, 2);
});

test('a atualização de comentários prevalece sobre um snapshot antigo do feed', async () => {
  const sync = createPostCommentCountSync(async () => [row('post', 7)], () => {});
  const snapshot = sync.snapshotRevision();
  await sync.refresh(['post']);
  assert.equal(sync.countAfter('post', snapshot), 7);
  assert.equal(sync.countAfter('post', sync.snapshotRevision()), undefined);
});

test('falha de leitura não zera contagens e a próxima sincronização se recupera', async t => {
  t.mock.method(console, 'warn', () => {});
  let fail = true;
  const accepted = [];
  const sync = createPostCommentCountSync(async () => {
    if (fail) throw new Error('offline');
    return [row('post', 3)];
  }, counts => accepted.push(counts.get('post')));
  await sync.refresh(['post']);
  assert.deepEqual(accepted, []);
  fail = false;
  await sync.refresh(['post']);
  assert.deepEqual(accepted, [3]);
});
