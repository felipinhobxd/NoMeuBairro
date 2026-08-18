from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


draft_util = r'''type DraftEnvelope<T> = {
  value: T;
  updatedAt: string;
};

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function readLocalDraft<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    const timestamp = new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

export function saveLocalDraft<T>(key: string, value: T) {
  if (!key || typeof window === 'undefined') return false;
  try {
    const envelope: DraftEnvelope<T> = { value, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(key: string) {
  if (!key || typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}
'''
write('src/utils/localDrafts.ts', draft_util)

# Feed drafts
path = 'src/pages/Feed.tsx'
text = read(path)
text = replace_once(
    text,
    "import { useSavedItems } from '../hooks/useSavedItems';\n",
    "import { useSavedItems } from '../hooks/useSavedItems';\nimport { clearLocalDraft, readLocalDraft, saveLocalDraft } from '../utils/localDrafts';\n",
    'Feed draft imports',
)
text = replace_once(
    text,
    "  const [summaryLoading, setSummaryLoading] = useState(false);\n",
    "  const [summaryLoading, setSummaryLoading] = useState(false);\n  const [postDraftReady, setPostDraftReady] = useState(false);\n  const [postDraftRestored, setPostDraftRestored] = useState(false);\n",
    'Feed draft state',
)
marker = """  useEffect(() => {
    let active = true;
    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }
"""
draft_effects = """  useEffect(() => {
    setPostDraftReady(false);
    setPostDraftRestored(false);
    if (!user?.id) return;
    const key = `nmb-draft:post:${user.id}`;
    const draft = readLocalDraft<{ title?: string; category?: PostCategory; location?: string; description?: string; latitude?: number; longitude?: number }>(key);
    if (draft) {
      setFt(draft.title || '');
      setFc(draft.category || 'buraco');
      setFl(draft.location || '');
      setFd(draft.description || '');
      setFLat(typeof draft.latitude === 'number' ? draft.latitude : undefined);
      setFLng(typeof draft.longitude === 'number' ? draft.longitude : undefined);
      if (draft.title || draft.location || draft.description) setPostDraftRestored(true);
    }
    setPostDraftReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !postDraftReady) return;
    const key = `nmb-draft:post:${user.id}`;
    const hasContent = Boolean(ft.trim() || fl.trim() || fd.trim() || fLat != null || fLng != null);
    if (!hasContent) {
      clearLocalDraft(key);
      return;
    }
    const timer = window.setTimeout(() => {
      saveLocalDraft(key, { title: ft, category: fc, location: fl, description: fd, latitude: fLat, longitude: fLng });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [user?.id, postDraftReady, ft, fc, fl, fd, fLat, fLng]);

  const discardPostDraft = useCallback(() => {
    if (user?.id) clearLocalDraft(`nmb-draft:post:${user.id}`);
    setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi(''); setFLat(undefined); setFLng(undefined);
    setPostDraftRestored(false);
    toast('Rascunho descartado.', 'info');
  }, [user?.id, toast]);

""" + marker
text = replace_once(text, marker, draft_effects, 'Feed draft effects insertion')
text = replace_once(
    text,
    "    setShowCreate(false); setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi(''); setFLat(undefined); setFLng(undefined); toast('Relato publicado com bairro identificado!');",
    "    if (user?.id) clearLocalDraft(`nmb-draft:post:${user.id}`);\n    setPostDraftRestored(false);\n    setShowCreate(false); setFt(''); setFc('buraco'); setFl(''); setFd(''); setFi(''); setFLat(undefined); setFLng(undefined); toast('Relato publicado com bairro identificado!');",
    'Feed clear draft after publish',
)
text = replace_once(
    text,
    "  }, [ft, fd, fl, fc, fi, fLat, fLng, addPost, toast]);",
    "  }, [ft, fd, fl, fc, fi, fLat, fLng, addPost, toast, user?.id]);",
    'Feed create dependencies',
)
old_modal = """      <Modal open={showCreate} onClose={() => setShowCreate(false)} title=\"Novo Relato\"><form onSubmit={e => { e.preventDefault(); void handleCreate(); }} className=\"space-y-4\"><Input label=\"Título\" placeholder=\"Ex: Buraco na Rua das Flores\" value={ft} onChange={e => setFt(e.target.value)} required />"""
new_modal = """      <Modal open={showCreate} onClose={() => setShowCreate(false)} title=\"Novo Relato\"><form onSubmit={e => { e.preventDefault(); void handleCreate(); }} className=\"space-y-4\">{postDraftRestored && <div className=\"flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10\"><div><p className=\"text-xs font-bold text-emerald-800 dark:text-emerald-300\">Rascunho recuperado automaticamente</p><p className=\"text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5\">Salvo neste dispositivo para você não perder o que estava escrevendo.</p></div><button type=\"button\" onClick={discardPostDraft} className=\"text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline shrink-0\">Descartar</button></div>}<Input label=\"Título\" placeholder=\"Ex: Buraco na Rua das Flores\" value={ft} onChange={e => setFt(e.target.value)} required />"""
text = replace_once(text, old_modal, new_modal, 'Feed restored draft notice')
text = replace_once(
    text,
    "<ImageUpload value={fi} onChange={setFi} /><div className=\"flex gap-3 pt-2\">",
    "<ImageUpload value={fi} onChange={setFi} /><p className=\"text-[10px] text-slate-400\">Título, categoria, localização e descrição são salvos automaticamente neste dispositivo por até 30 dias. Imagens não entram no rascunho.</p><div className=\"flex gap-3 pt-2\">",
    'Feed autosave note',
)
write(path, text)

# Mural drafts
path = 'src/pages/Mural.tsx'
text = read(path)
text = replace_once(
    text,
    "import { useSavedItems } from '../hooks/useSavedItems';\n",
    "import { useSavedItems } from '../hooks/useSavedItems';\nimport { clearLocalDraft, readLocalDraft, saveLocalDraft } from '../utils/localDrafts';\n",
    'Mural draft imports',
)
text = replace_once(
    text,
    "  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());\n",
    "  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());\n  const [eventDraftReady, setEventDraftReady] = useState(false);\n  const [eventDraftRestored, setEventDraftRestored] = useState(false);\n",
    'Mural draft state',
)
focus_effect = """  useEffect(() => {
    const focusedId = sessionStorage.getItem('anb-mural-focus-event');
"""
mural_draft_effects = """  useEffect(() => {
    setEventDraftReady(false);
    setEventDraftRestored(false);
    if (!user?.id) return;
    const key = `nmb-draft:event:${user.id}`;
    const draft = readLocalDraft<{ title?: string; type?: EventType; date?: string; location?: string; description?: string; latitude?: number; longitude?: number }>(key);
    if (draft) {
      setFt(draft.title || '');
      setFtype(draft.type || 'reuniao');
      setFdate(draft.date || '');
      setFloc(draft.location || '');
      setFdesc(draft.description || '');
      setFLat(typeof draft.latitude === 'number' ? draft.latitude : undefined);
      setFLng(typeof draft.longitude === 'number' ? draft.longitude : undefined);
      if (draft.title || draft.date || draft.location || draft.description) setEventDraftRestored(true);
    }
    setEventDraftReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !eventDraftReady) return;
    const key = `nmb-draft:event:${user.id}`;
    const hasContent = Boolean(ft.trim() || fdate || floc.trim() || fdesc.trim() || fLat != null || fLng != null);
    if (!hasContent) {
      clearLocalDraft(key);
      return;
    }
    const timer = window.setTimeout(() => {
      saveLocalDraft(key, { title: ft, type: ftype, date: fdate, location: floc, description: fdesc, latitude: fLat, longitude: fLng });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [user?.id, eventDraftReady, ft, ftype, fdate, floc, fdesc, fLat, fLng]);

  const discardEventDraft = useCallback(() => {
    if (user?.id) clearLocalDraft(`nmb-draft:event:${user.id}`);
    setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc(''); setFLat(undefined); setFLng(undefined);
    setEventDraftRestored(false);
    toast('Rascunho descartado.', 'info');
  }, [user?.id, toast]);

""" + focus_effect
text = replace_once(text, focus_effect, mural_draft_effects, 'Mural draft effects insertion')
text = replace_once(
    text,
    "      setShowCreate(false);\n      setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc('');",
    "      if (user?.id) clearLocalDraft(`nmb-draft:event:${user.id}`);\n      setEventDraftRestored(false);\n      setShowCreate(false);\n      setFt(''); setFtype('reuniao'); setFdate(''); setFloc(''); setFdesc('');",
    'Mural clear draft after publish',
)
text = replace_once(
    text,
    "        <form onSubmit={e => { e.preventDefault(); void handleCreate(); }} className=\"space-y-4\">\n          <Input label=\"Título do evento\"",
    "        <form onSubmit={e => { e.preventDefault(); void handleCreate(); }} className=\"space-y-4\">\n          {eventDraftRestored && <div className=\"flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10\"><div><p className=\"text-xs font-bold text-emerald-800 dark:text-emerald-300\">Rascunho recuperado automaticamente</p><p className=\"text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5\">Seu evento ficou salvo neste dispositivo.</p></div><button type=\"button\" onClick={discardEventDraft} className=\"text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline shrink-0\">Descartar</button></div>}\n          <Input label=\"Título do evento\"",
    'Mural restored draft notice',
)
text = replace_once(
    text,
    "          <Textarea label=\"Descrição\" placeholder=\"Detalhes do evento, horário, como participar...\" value={fdesc} onChange={e => setFdesc(e.target.value)} required />\n          <div className=\"flex gap-3 pt-2\">",
    "          <Textarea label=\"Descrição\" placeholder=\"Detalhes do evento, horário, como participar...\" value={fdesc} onChange={e => setFdesc(e.target.value)} required />\n          <p className=\"text-[10px] text-slate-400\">O rascunho deste evento é salvo automaticamente neste dispositivo por até 30 dias.</p>\n          <div className=\"flex gap-3 pt-2\">",
    'Mural autosave note',
)
write(path, text)

print('Automatic local draft upgrade applied successfully.')
