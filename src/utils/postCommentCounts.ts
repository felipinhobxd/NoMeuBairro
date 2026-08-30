// Counts are aggregated by PostgREST: no comment bodies, per-card queries or
// reliance on the legacy denormalized counter (which can drift).
export const POST_COMMENT_COUNT_SELECT = 'id,comments!comments_post_id_fkey(count)';

export type PostCommentCountRow = { id: string; comments?: { count: number }[] };

export function readPostCommentCount(row: { comments?: { count: number }[]; comments_count?: number }): number {
  const count = row.comments?.[0]?.count ?? row.comments_count ?? 0;
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function commentThreadIds(comments: { id: string; parentId?: string }[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  // ON DELETE CASCADE also removes nested replies, not just the root comment.
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (comment.parentId && ids.has(comment.parentId) && !ids.has(comment.id)) {
        ids.add(comment.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** One serial, batched queue. A late response cannot undo a newer refresh. */
export function createPostCommentCountSync(
  fetchCounts: (ids: string[]) => Promise<PostCommentCountRow[]>,
  applyCounts: (counts: Map<string, number>) => void,
) {
  let revision = 0;
  let request: Promise<void> | null = null;
  const pending = new Set<string>();
  const versions = new Map<string, number>();
  const accepted = new Map<string, { count: number; revision: number }>();

  const refresh = (ids: string[]): Promise<void> => {
    for (const id of new Set(ids.filter(Boolean))) {
      versions.set(id, ++revision);
      pending.add(id);
    }
    if (request) return request;
    request = (async () => {
      // Coalesce requests from several cards/mutations in the same turn.
      await Promise.resolve();
      while (pending.size) {
        const batch = [...pending].slice(0, 100);
        const started = new Map(batch.map(id => [id, versions.get(id)!]));
        for (const id of batch) pending.delete(id);
        try {
          const rows = await fetchCounts(batch);
          const counts = new Map<string, number>();
          for (const row of rows) {
            if (!started.has(row.id) || started.get(row.id) !== versions.get(row.id)) continue;
            const count = readPostCommentCount(row);
            counts.set(row.id, count);
            accepted.set(row.id, { count, revision: ++revision });
          }
          if (counts.size) applyCounts(counts);
        } catch (error) {
          // Retain the last verified count when offline. Reconnect/focus retries;
          // a failed read must never make every card display zero.
          console.warn('Não foi possível atualizar a contagem de comentários:', error);
        }
      }
    })().finally(() => { request = null; });
    return request;
  };

  return {
    refresh,
    snapshotRevision: () => revision,
    countAfter: (id: string, snapshot: number): number | undefined => {
      const value = accepted.get(id);
      return value && value.revision > snapshot ? value.count : undefined;
    },
  };
}
