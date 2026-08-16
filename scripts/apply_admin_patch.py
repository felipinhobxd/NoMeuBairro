from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, count), encoding='utf-8')


# Route for the protected moderation area.
replace(
    'src/App.tsx',
    "const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'), 'post');",
    "const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'), 'post');\nconst Admin = lazyWithRetry(() => import('./pages/Admin'), 'admin');",
)
replace(
    'src/App.tsx',
    '                        <Route path="/post/:postId" element={<PostDetails />} />',
    '                        <Route path="/post/:postId" element={<PostDetails />} />\n                        <Route path="/admin" element={<Admin />} />',
)

# Feed: recursively render children of replies instead of stopping at one reply level.
replace(
    'src/pages/Feed.tsx',
    'function CommentItem({ comment, replies, onReply, replyingTo, onDelete, onReport, currentUser, isPostOwner }: {\n  comment: Comment; replies: Comment[]; onReply: (c: Comment) => void; replyingTo: string | null; onDelete: (id: string) => void; onReport: (id: string) => void; currentUser: any; isPostOwner: boolean;\n}) {',
    'function CommentItem({ comment, replies, allComments, onReply, replyingTo, onDelete, onReport, currentUser, isPostOwner }: {\n  comment: Comment; replies: Comment[]; allComments: Comment[]; onReply: (c: Comment) => void; replyingTo: string | null; onDelete: (id: string) => void; onReport: (id: string) => void; currentUser: any; isPostOwner: boolean;\n}) {',
)
replace(
    'src/pages/Feed.tsx',
    '<CommentItem key={r.id} comment={r} replies={[]} onReply={onReply}',
    '<CommentItem key={r.id} comment={r} replies={allComments.filter((child: Comment) => child.parentId === r.id)} allComments={allComments} onReply={onReply}',
)
replace(
    'src/pages/Feed.tsx',
    '<CommentItem key={rc.id} comment={rc} replies={replies} onReply={(c) => handleReplyClick(post.id, c)}',
    '<CommentItem key={rc.id} comment={rc} replies={replies} allComments={postComments} onReply={(c) => handleReplyClick(post.id, c)}',
)

# Data context: allow a report to target a mural event.
replace(
    'src/contexts/DataContext.tsx',
    "  reportContent: (data: { postId?: string; commentId?: string; reason: string }) => Promise<void>;",
    "  reportContent: (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => Promise<void>;",
)
replace(
    'src/contexts/DataContext.tsx',
    "  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; reason: string }) => { await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, reason: data.reason }); }, [user]);",
    "  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => { await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, event_id: data.eventId, reason: data.reason }); }, [user]);",
)

# Mural: reporting UI + always open the general map, clearing any stale focused location.
replace(
    'src/pages/Mural.tsx',
    'CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw, Search, X, LocateFixed, Map',
    'CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw, Search, X, LocateFixed, Map, AlertTriangle',
)
replace(
    'src/pages/Mural.tsx',
    '  const { isAuthenticated } = useAuth();',
    '  const { user, isAuthenticated } = useAuth();',
)
replace(
    'src/pages/Mural.tsx',
    '    events, addEvent, deleteEvent, isMyEvent, toggleAttendance, getEventAttendees,\n    loadEvents, eventsLoading, attendingEventIds,',
    '    events, addEvent, deleteEvent, isMyEvent, toggleAttendance, getEventAttendees, reportContent,\n    loadEvents, eventsLoading, attendingEventIds,',
)
replace(
    'src/pages/Mural.tsx',
    "  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);",
    "  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);\n  const [showReport, setShowReport] = useState<{ eventId: string; title: string } | null>(null);\n  const [reportReason, setReportReason] = useState('');\n  const [reportDetail, setReportDetail] = useState('');",
)
replace(
    'src/pages/Mural.tsx',
    "  const selectedLabel = isNeighborhoodSelected && currentNeighborhood.name ? currentNeighborhood.name : 'todos os bairros';",
    "  const openMapOverview = useCallback(() => {\n    try {\n      sessionStorage.removeItem('anb-map-focus-post');\n      sessionStorage.removeItem('anb-map-focus-event');\n    } catch {}\n    navigate('/mapa');\n  }, [navigate]);\n\n  const handleSendReport = async () => {\n    if (!showReport || !reportReason.trim()) return;\n    if (!isAuthenticated || !user) { navigate('/login'); return; }\n    const reason = reportDetail.trim() ? `${reportReason}: ${reportDetail.trim()}` : reportReason;\n    await reportContent({ eventId: showReport.eventId, reason });\n    setShowReport(null);\n    setReportReason('');\n    setReportDetail('');\n    toast('Denúncia enviada para análise do administrador.');\n  };\n\n  const selectedLabel = isNeighborhoodSelected && currentNeighborhood.name ? currentNeighborhood.name : 'todos os bairros';",
)
replace(
    'src/pages/Mural.tsx',
    "onClick={() => navigate('/mapa')} className=\"inline-flex items-center gap-1 text-blue-600",
    "onClick={openMapOverview} className=\"inline-flex items-center gap-1 text-blue-600",
)
replace(
    'src/pages/Mural.tsx',
    '                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">\n                      <button onClick={() => openAttendees(ev.id, ev.title)}',
    '                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">\n                      <button onClick={() => { if (!isAuthenticated) { navigate(\'/login\'); return; } setShowReport({ eventId: ev.id, title: ev.title }); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><AlertTriangle className="w-3.5 h-3.5" />Denunciar</button>\n                      <button onClick={() => openAttendees(ev.id, ev.title)}',
)
replace(
    'src/pages/Mural.tsx',
    '      <Modal open={!!viewAttendeesTarget} onClose={() => setViewAttendeesTarget(null)} title={`Confirmados: ${viewAttendeesTarget?.title || \'\'}`}>',
    '''      <Modal open={!!showReport} onClose={() => { setShowReport(null); setReportReason(''); setReportDetail(''); }} title="Denunciar Evento">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Você está denunciando <strong>{showReport?.title}</strong>. Escolha o motivo para o administrador analisar.</p>
          <Select label="Categoria da Denúncia" options={[{ value: '', label: 'Selecione uma categoria...' }, { value: 'Conteúdo ofensivo ou ódio', label: 'Conteúdo ofensivo ou ódio' }, { value: 'Informação falsa (Spam)', label: 'Informação falsa (Spam)' }, { value: 'Assédio ou perseguição', label: 'Assédio ou perseguição' }, { value: 'Conteúdo inadequado ou ilegal', label: 'Conteúdo inadequado ou ilegal' }, { value: 'Outros', label: 'Outros' }]} value={reportReason} onChange={e => setReportReason(e.target.value)} />
          <Textarea label="Detalhes da denúncia (opcional)" placeholder="Explique o problema para ajudar na análise..." value={reportDetail} onChange={e => setReportDetail(e.target.value)} rows={3} />
          <div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1" onClick={() => { setShowReport(null); setReportReason(''); setReportDetail(''); }}>Cancelar</Button><Button className="flex-1 !bg-red-600 hover:!bg-red-700 !text-white" onClick={() => void handleSendReport()} disabled={!reportReason}>Enviar Denúncia</Button></div>
        </div>
      </Modal>

      <Modal open={!!viewAttendeesTarget} onClose={() => setViewAttendeesTarget(null)} title={`Confirmados: ${viewAttendeesTarget?.title || ''}`}>''',
)

print('Admin moderation frontend patch applied successfully.')
