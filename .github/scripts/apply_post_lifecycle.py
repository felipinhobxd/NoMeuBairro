from pathlib import Path
import re

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


path = 'src/pages/Feed.tsx'
text = read(path)

text = replace_once(
    text,
    "  const [nearMe, setNearMe] = useState(false);\n  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);",
    "  const [nearMe, setNearMe] = useState(false);\n  const [nearRadius, setNearRadius] = useState<1 | 3 | 5 | 10>(5);\n  const [sortMode, setSortMode] = useState<'recent' | 'supported' | 'discussed' | 'nearest'>('recent');\n  const [onlyWithImage, setOnlyWithImage] = useState(false);\n  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);",
    'advanced filter state',
)

pattern = re.compile(r"  const filtered = useMemo\(\(\) => \{.*?\n  \}, \[posts, activeCategory, activeStatus, searchQuery, onlyMine, nearMe, userLocation, user, currentNeighborhood, isNeighborhoodSelected\]\);", re.S)
replacement = """  const filtered = useMemo(() => {
    const q = normalizeNeighborhoodText(searchQuery);
    return posts.filter(p => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (activeStatus !== 'all' && p.status !== activeStatus) return false;
      if (onlyMine && user && p.authorId !== user.id) return false;
      if (onlyMine && !user) return false;
      if (onlyWithImage && !p.imageUrl) return false;

      if (q) {
        const searchable = normalizeNeighborhoodText([
          p.title, p.description, p.location, p.authorName,
          p.neighborhood || '', p.locality || '', neighborhoodSearchText(p.neighborhood), neighborhoodSearchText(p.locality),
        ].join(' '));
        if (!searchable.includes(q)) return false;
      }

      // GPS proximity takes precedence over the selected neighborhood. This makes
      // "Perto de mim" useful even when the global filter is set to another area.
      if (nearMe) {
        if (!userLocation || p.latitude == null || p.longitude == null) return false;
        if (calculateDistance(userLocation.lat, userLocation.lng, Number(p.latitude), Number(p.longitude)) > nearRadius) return false;
      } else if (isNeighborhoodSelected && currentNeighborhood.name) {
        if (!neighborhoodMatches(currentNeighborhood.name, p.neighborhood, p.locality, p.location)) return false;
      }

      return true;
    });
  }, [posts, activeCategory, activeStatus, searchQuery, onlyMine, onlyWithImage, nearMe, nearRadius, userLocation, user, currentNeighborhood, isNeighborhoodSelected]);

  const visiblePosts = useMemo(() => {
    const next = [...filtered];
    if (sortMode === 'supported') return next.sort((a, b) => b.supports - a.supports || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortMode === 'discussed') return next.sort((a, b) => ((commentsByPost[b.id]?.length ?? b.commentsCount) - (commentsByPost[a.id]?.length ?? a.commentsCount)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortMode === 'nearest' && userLocation) {
      return next.sort((a, b) => {
        const da = a.latitude != null && a.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude)) : Number.POSITIVE_INFINITY;
        const db = b.latitude != null && b.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude)) : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }
    return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filtered, sortMode, userLocation, commentsByPost]);"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'filtered block: expected 1, found {count}')

text = replace_once(
    text,
    "<span className=\"hidden sm:inline\">Perto de mim</span>",
    "<span className=\"hidden sm:inline\">{nearMe ? `Até ${nearRadius} km` : 'Perto de mim'}</span>",
    'nearby button label',
)
text = replace_once(
    text,
    "<Filter className=\"w-3.5 h-3.5\" /><span className=\"hidden sm:inline\">Categorias</span>",
    "<Filter className=\"w-3.5 h-3.5\" /><span className=\"hidden sm:inline\">Filtros</span>",
    'filter button label',
)

old_panel = """{showFilters && <div className=\"flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800\">{Object.entries(postCategories).map(([key, def]) => { const Icon = catIcons[key] ?? HelpCircle; return <button key={key} onClick={() => setActiveCategory(activeCategory === key ? null : key as PostCategory)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', activeCategory === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')}><Icon className=\"w-3.5 h-3.5\" />{def.label}</button>; })}</div>}"""
new_panel = """{showFilters && <div className=\"mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3\"><div><p className=\"text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2\">Categoria</p><div className=\"flex flex-wrap gap-1.5\">{Object.entries(postCategories).map(([key, def]) => { const Icon = catIcons[key] ?? HelpCircle; return <button key={key} onClick={() => setActiveCategory(activeCategory === key ? null : key as PostCategory)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', activeCategory === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')}><Icon className=\"w-3.5 h-3.5\" />{def.label}</button>; })}</div></div><div className=\"grid grid-cols-1 sm:grid-cols-2 gap-2\"><label className=\"block\"><span className=\"text-[10px] font-black uppercase tracking-wider text-slate-400\">Ordenar por</span><select value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)} className=\"mt-1 w-full min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500\"><option value=\"recent\">Mais recentes</option><option value=\"supported\">Mais apoiados</option><option value=\"discussed\">Mais comentados</option><option value=\"nearest\">Mais próximos</option></select></label><button type=\"button\" onClick={() => setOnlyWithImage(!onlyWithImage)} className={cn('mt-4 sm:mt-[18px] min-h-10 rounded-xl px-3 text-xs font-bold ring-1 transition-all', onlyWithImage ? 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20' : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700')} aria-pressed={onlyWithImage}>📷 {onlyWithImage ? 'Somente com imagem' : 'Filtrar com imagem'}</button></div>{nearMe && <div><p className=\"text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2\">Distância máxima</p><div className=\"flex gap-1.5\">{([1,3,5,10] as const).map(radius => <button type=\"button\" key={radius} onClick={() => { setNearRadius(radius); if (sortMode === 'recent') setSortMode('nearest'); }} className={cn('min-h-9 flex-1 rounded-lg text-xs font-bold transition-all', nearRadius === radius ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>{radius} km</button>)}</div></div>}<button type=\"button\" onClick={() => { setActiveCategory(null); setOnlyWithImage(false); setSortMode('recent'); setNearRadius(5); }} className=\"text-[10px] font-bold text-slate-400 hover:text-red-500\">Limpar filtros avançados</button></div>}"""
text = replace_once(text, old_panel, new_panel, 'advanced filter panel')

text = text.replace("filtered.length === 0", "visiblePosts.length === 0")
text = text.replace("{filtered.length} resultado", "{visiblePosts.length} resultado")
text = text.replace("{filtered.map(post => {", "{visiblePosts.map(post => {")

text = replace_once(
    text,
    "            const canManageStatus = isMyPost(post) || canModerate;\n            return <Card",
    "            const canManageStatus = isMyPost(post) || canModerate;\n            const distanceFromUser = userLocation && post.latitude != null && post.longitude != null ? calculateDistance(userLocation.lat, userLocation.lng, Number(post.latitude), Number(post.longitude)) : null;\n            return <Card",
    'distance per post',
)
text = replace_once(
    text,
    "{resolvedArea && <span className=\"inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[11px] font-bold text-orange-800 dark:text-orange-300\"><MapPin className=\"w-3 h-3\" />{resolvedArea}</span>}{post.location &&",
    "{resolvedArea && <span className=\"inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[11px] font-bold text-orange-800 dark:text-orange-300\"><MapPin className=\"w-3 h-3\" />{resolvedArea}</span>}{nearMe && distanceFromUser != null && <span className=\"inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300\"><LocateFixed className=\"w-3 h-3\" />{distanceFromUser < 1 ? `${Math.round(distanceFromUser * 1000)} m` : `${distanceFromUser.toFixed(1)} km`}</span>}{post.location &&",
    'distance badge',
)

# LocateFixed is already used conceptually for proximity; add it to imports.
text = replace_once(
    text,
    "Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase, Bookmark,",
    "Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase, Bookmark, LocateFixed,",
    'LocateFixed import',
)

write(path, text)
print('Advanced feed filters and nearby radius applied successfully.')
