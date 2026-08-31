// Shared by the health endpoint and the scheduled checker. Never trust an HTML
// fallback or an arbitrary JSON response merely because it returned HTTP 200.
export function parseIncidentSnapshot(value) {
  if (!value || value.schemaVersion !== 2) return null;
  for (const key of ['openIncidents', 'criticalIncidents', 'testSequence']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) return null;
  }
  if (value.openIncidents > 10000 || value.criticalIncidents > value.openIncidents) return null;
  return { schemaVersion: 2, openIncidents: value.openIncidents, criticalIncidents: value.criticalIncidents, testSequence: value.testSequence };
}

export async function readLimitedText(response, maxBytes = 64_000) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('response_too_large');
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
