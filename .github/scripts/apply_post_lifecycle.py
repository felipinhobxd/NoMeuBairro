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
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


share_utility = r'''export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type SharePayload = {
  title: string;
  text?: string;
  url: string;
};

function absoluteUrl(url: string) {
  if (typeof window === 'undefined') return url;
  try { return new URL(url, window.location.origin).toString(); }
  catch { return url; }
}

async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') throw new Error('Clipboard indisponível');
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(input);
  if (!ok) throw new Error('Não foi possível copiar');
}

export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const url = absoluteUrl(payload.url);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to clipboard when native sharing is unavailable or fails.
    }
  }
  try {
    await copyText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
'''
write('src/utils/share.ts', share_utility)

# Feed: make each relato directly openable and shareable.
feed_path = 'src/pages/Feed.tsx'
feed = read(feed_path)
feed = replace_once(
    feed,
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw,\n",
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2,\n",
    'Feed sharing icons',
)
feed = replace_once(
    feed,
    "import { supabase } from '../utils/supabase';\n",
    "import { supabase } from '../utils/supabase';\nimport { shareContent } from '../utils/share';\n",
    'Feed share utility import',
)
feed = replace_once(
    feed,
    "  const handleStatusChange = useCallback(async (postId: string, status: PostStatus) => { const result = await updatePostStatus(postId, status); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o status.', 'error'); return; } const labels: Record<string, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \\\"${labels[status]}\\\".`); }, [updatePostStatus, toast]);\n",
    "  const handleStatusChange = useCallback(async (postId: string, status: PostStatus) => { const result = await updatePostStatus(postId, status); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o status.', 'error'); return; } const labels: Record<string, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \\\"${labels[status]}\\\".`); }, [updatePostStatus, toast]);\n  const handleSharePost = useCallback(async (post: { id: string; title: string; description: string }) => { const result = await shareContent({ title: `${post.title} · No Meu Bairro`, text: post.description.slice(0, 180), url: `/post/${post.id}` }); if (result === 'copied') toast('Link do relato copiado!'); else if (result === 'failed') toast('Não foi possível compartilhar este relato.', 'error'); }, [toast]);\n",
    'Feed share handler',
)
feed = replace_once(
    feed,
    "              <h3 className=\"text-base font-semibold text-slate-900 dark:text-white mb-1\">{post.title}</h3>",
    "              <Link to={`/post/${post.id}`} className=\"block rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40\"><h3 className=\"text-base font-semibold text-slate-900 dark:text-white mb-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors\">{post.title}</h3></Link>",
    'Feed clickable post title',
)
old_actions = "<div className=\"flex items-center gap-2 mt-2\"><button onClick={() => setShowReport({ postId: post.id })} className=\"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 active:bg-red-50 dark:active:bg-red-500/10 transition-all\"><AlertTriangle className=\"w-3.5 h-3.5\" />Denunciar</button>{canManageStatus &&"
new_actions = "<div className=\"flex items-center gap-1 sm:gap-2 mt-2 flex-wrap\"><button onClick={() => setShowReport({ postId: post.id })} className=\"flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 active:bg-red-50 dark:active:bg-red-500/10 transition-all\"><AlertTriangle className=\"w-3.5 h-3.5\" />Denunciar</button><Link to={`/post/${post.id}`} className=\"flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all\"><ExternalLink className=\"w-3.5 h-3.5\" />Abrir</Link><button type=\"button\" onClick={() => void handleSharePost(post)} className=\"flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all\"><Share2 className=\"w-3.5 h-3.5\" />Compartilhar</button>{canManageStatus &&"
feed = replace_once(feed, old_actions, new_actions, 'Feed detail/share actions')
write(feed_path, feed)

# PostDetails: native share on mobile, clipboard fallback on desktop, and useful document title.
details_path = 'src/pages/PostDetails.tsx'
details = read(details_path)
details = replace_once(
    details,
    "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2 } from 'lucide-react';",
    "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2, Share2 } from 'lucide-react';",
    'PostDetails share icon',
)
details = replace_once(
    details,
    "import { Card, StatusBadge, CategoryBadge, EmptyState, timeAgo } from '../components/UI';",
    "import { Card, StatusBadge, CategoryBadge, EmptyState, timeAgo, useToast } from '../components/UI';",
    'PostDetails toast import',
)
details = replace_once(
    details,
    "import { supabase } from '../utils/supabase';\n",
    "import { supabase } from '../utils/supabase';\nimport { shareContent } from '../utils/share';\n",
    'PostDetails share import',
)
details = replace_once(
    details,
    "  const { isAuthenticated, user } = useAuth();\n",
    "  const { isAuthenticated, user } = useAuth();\n  const { toast } = useToast();\n",
    'PostDetails toast hook',
)
role_effect = """  useEffect(() => {\n    let active = true;\n    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }\n    void supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => {\n      if (!active) return;\n      setCanModerate(data?.role === 'admin' || data?.role === 'moderator');\n    });\n    return () => { active = false; };\n  }, [user?.id]);\n"""
details = replace_once(
    details,
    role_effect,
    role_effect + """\n  useEffect(() => {\n    if (!post) return;\n    const previousTitle = document.title;\n    document.title = `${post.title} | No Meu Bairro`;\n    return () => { document.title = previousTitle; };\n  }, [post?.id, post?.title]);\n""",
    'PostDetails document title',
)
status_handler_end = """  const handleStatusChange = async (status: PostStatus) => {\n    if (!postId || !post || updatingStatus || post.status === status) return;\n    setUpdatingStatus(status);\n    try {\n      const result = await updatePostStatus(postId, status);\n      if (!result.ok) return;\n      setPost(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : prev);\n      const { data } = await supabase.from('post_status_history').select('id,old_status,new_status,source,changed_at').eq('post_id', postId).order('changed_at', { ascending: false }).limit(30);\n      if (data) setStatusHistory(data as StatusHistoryItem[]);\n    } finally {\n      setUpdatingStatus(null);\n    }\n  };\n"""
details = replace_once(
    details,
    status_handler_end,
    status_handler_end + """\n  const handleShare = async () => {\n    if (!post) return;\n    const result = await shareContent({ title: `${post.title} · No Meu Bairro`, text: post.description.slice(0, 180), url: `/post/${post.id}` });\n    if (result === 'copied') toast('Link do relato copiado!');\n    else if (result === 'failed') toast('Não foi possível compartilhar este relato.', 'error');\n  };\n""",
    'PostDetails share handler',
)
details = replace_once(
    details,
    "        <div className=\"grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">",
    "        <div className=\"grid grid-cols-3 gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">",
    'PostDetails action grid',
)
details = replace_once(
    details,
    "          <button onClick={() => document.getElementById('post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className=\"flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-sm font-bold transition-all\">\n            <MessageSquare className=\"w-5 h-5\" /> Comentar {post.commentsCount > 0 ? `(${post.commentsCount})` : ''}\n          </button>\n",
    "          <button onClick={() => document.getElementById('post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className=\"flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs sm:text-sm font-bold transition-all\">\n            <MessageSquare className=\"w-5 h-5\" /> <span>Comentar <span className=\"hidden sm:inline\">{post.commentsCount > 0 ? `(${post.commentsCount})` : ''}</span></span>\n          </button>\n          <button type=\"button\" onClick={() => void handleShare()} className=\"flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs sm:text-sm font-bold transition-all hover:bg-blue-100 dark:hover:bg-blue-500/20\">\n            <Share2 className=\"w-5 h-5\" /> Compartilhar\n          </button>\n",
    'PostDetails share button',
)
write(details_path, details)

print('Post sharing upgrade applied successfully.')
