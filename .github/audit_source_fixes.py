from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Legal pages must be public in the real source, not patched by Vite at build time.
replace_once(
    'src/components/Layout.tsx',
    "  if (!isNeighborhoodSelected) {\n",
    "  if (!isNeighborhoodSelected && !['/privacidade', '/termos'].includes(location.pathname)) {\n",
)

# DataContext: propagate database errors instead of showing false success states.
p = Path('src/contexts/DataContext.tsx')
text = p.read_text()
for old, new in [
    ("  supportPost: (postId: string) => Promise<void>;", "  supportPost: (postId: string) => Promise<ActionResult>;"),
    ("  addComment: (postId: string, content: string, parentId?: string) => Promise<void>;", "  addComment: (postId: string, content: string, parentId?: string) => Promise<ActionResult>;"),
    ("  deleteComment: (commentId: string) => Promise<void>;", "  deleteComment: (commentId: string) => Promise<ActionResult>;"),
    ("  deleteEvent: (eventId: string) => Promise<void>;", "  deleteEvent: (eventId: string) => Promise<ActionResult>;"),
    ("  toggleAttendance: (eventId: string) => Promise<void>;", "  toggleAttendance: (eventId: string) => Promise<ActionResult>;"),
    ("  reportContent: (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => Promise<void>;", "  reportContent: (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => Promise<ActionResult>;"),
]:
    if old not in text:
        raise SystemExit(f'DataContext type anchor missing: {old}')
    text = text.replace(old, new, 1)

start = text.index("  const supportPost = useCallback")
end = text.index("  const deletePost = useCallback", start)
replacement = '''  const supportPost = useCallback(async (postId: string): Promise<ActionResult> => {
    if (!user) return { ok: false, error: 'Entre na sua conta para apoiar um relato.' };
    if (processingRef.current.has(postId)) return { ok: false, error: 'Aguarde a ação anterior terminar.' };
    processingRef.current.add(postId);
    try {
      const { data: existing, error: lookupError } = await supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
      if (lookupError) return { ok: false, error: lookupError.message };
      if (existing) {
        const { error } = await supabase.from('post_supports').delete().eq('id', existing.id);
        if (error) return { ok: false, error: error.message };
        setPosts(prev => prev.map(post => post.id === postId ? { ...post, supports: Math.max(0, post.supports - 1) } : post));
      } else {
        const { error } = await supabase.from('post_supports').insert({ post_id: postId, user_id: user.id });
        if (error) return { ok: false, error: error.message };
        setPosts(prev => prev.map(post => post.id === postId ? { ...post, supports: post.supports + 1 } : post));
      }
      return { ok: true };
    } finally {
      processingRef.current.delete(postId);
    }
  }, [user]);

  const addComment = useCallback(async (postId: string, content: string, parentId?: string): Promise<ActionResult> => {
    if (!user) return { ok: false, error: 'Entre na sua conta para comentar.' };
    if (!content.trim()) return { ok: false, error: 'Escreva um comentário antes de enviar.' };
    const { data: inserted, error } = await supabase.from('comments').insert({ post_id: postId, author_id: user.id, parent_id: parentId, content: content.trim() }).select('id,post_id,author_id,content,parent_id,created_at').single();
    if (error || !inserted) return { ok: false, error: error?.message || 'Não foi possível adicionar o comentário.' };
    const nextComment: Comment = { id: inserted.id, postId: inserted.post_id, authorId: inserted.author_id, authorName: user.name || 'Morador', authorAvatarUrl: user.avatarUrl, content: inserted.content, parentId: inserted.parent_id || undefined, createdAt: inserted.created_at };
    loadedCommentPostsRef.current.add(postId);
    setComments(prev => [...prev.filter(comment => comment.id !== nextComment.id), nextComment]);
    setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post));
    return { ok: true };
  }, [user]);

  const deleteComment = useCallback(async (commentId: string): Promise<ActionResult> => {
    const target = comments.find(comment => comment.id === commentId);
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) return { ok: false, error: error.message };
    setComments(prev => prev.filter(comment => comment.id !== commentId));
    if (target?.postId) setPosts(prev => prev.map(post => post.id === target.postId ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) } : post));
    return { ok: true };
  }, [comments]);

'''
text = text[:start] + replacement + text[end:]

old = "  const deleteEvent = useCallback(async (eventId: string) => { const { error } = await supabase.from('events').delete().eq('id', eventId); if (!error) setEvents(prev => prev.filter(event => event.id !== eventId)); }, []);"
new = "  const deleteEvent = useCallback(async (eventId: string): Promise<ActionResult> => { const { error } = await supabase.from('events').delete().eq('id', eventId); if (error) return { ok: false, error: error.message }; setEvents(prev => prev.filter(event => event.id !== eventId)); return { ok: true }; }, []);"
if old not in text: raise SystemExit('deleteEvent anchor missing')
text = text.replace(old, new, 1)

start = text.index("  const toggleAttendance = useCallback")
end = text.index("  const getEventAttendees = useCallback", start)
replacement = '''  const toggleAttendance = useCallback(async (eventId: string): Promise<ActionResult> => {
    const userId = user?.id;
    if (!userId) return { ok: false, error: 'Entre na sua conta para confirmar presença.' };
    if (attendanceLoadedUserRef.current !== userId) await loadMyAttendance();
    const isAttending = attendanceIdsRef.current.has(eventId);
    if (isAttending) {
      const { error } = await supabase.from('event_attendance').delete().eq('event_id', eventId).eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
      const next = new Set(attendanceIdsRef.current); next.delete(eventId); setAttendanceIds(next);
      setEvents(prev => prev.map(event => event.id === eventId ? { ...event, attendanceCount: Math.max(0, (event.attendanceCount || 0) - 1) } : event));
    } else {
      const { error } = await supabase.from('event_attendance').insert({ event_id: eventId, user_id: userId });
      if (error) return { ok: false, error: error.message };
      const next = new Set(attendanceIdsRef.current); next.add(eventId); setAttendanceIds(next);
      setEvents(prev => prev.map(event => event.id === eventId ? { ...event, attendanceCount: (event.attendanceCount || 0) + 1 } : event));
    }
    return { ok: true };
  }, [user?.id, loadMyAttendance, setAttendanceIds]);

'''
text = text[:start] + replacement + text[end:]

old = "  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => { await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, event_id: data.eventId, reason: data.reason }); }, [user]);"
new = "  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; eventId?: string; reason: string }): Promise<ActionResult> => { if (!user?.id) return { ok: false, error: 'Entre ou crie uma conta para denunciar este conteúdo.' }; const { error } = await supabase.from('content_reports').insert({ reporter_id: user.id, post_id: data.postId, comment_id: data.commentId, event_id: data.eventId, reason: data.reason.trim() }); if (error) return { ok: false, error: error.message }; return { ok: true }; }, [user?.id]);"
if old not in text: raise SystemExit('reportContent anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# Feed: only show success after Supabase confirms the operation.
p = Path('src/pages/Feed.tsx')
text = p.read_text()
old = "  const handleSupport = useCallback((id: string) => { const isSupported = supported.has(id); supportPost(id); const next = new Set(supported); if (isSupported) next.delete(id); else { next.add(id); setHeartsAnimating(prev => { const n = new Set(prev); n.add(id); return n; }); setTimeout(() => setHeartsAnimating(prev => { const n = new Set(prev); n.delete(id); return n; }), 500); } setSupported(next); try { localStorage.setItem('anb-supported', JSON.stringify([...next])); } catch {} }, [supported, supportPost]);"
new = "  const handleSupport = useCallback(async (id: string) => { if (!isAuthenticated || !user) { toast('Entre ou crie uma conta para apoiar um relato.', 'info'); navigate('/login'); return; } const isSupported = supported.has(id); const result = await supportPost(id); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o apoio.', 'error'); return; } const next = new Set(supported); if (isSupported) next.delete(id); else { next.add(id); setHeartsAnimating(prev => { const n = new Set(prev); n.add(id); return n; }); setTimeout(() => setHeartsAnimating(prev => { const n = new Set(prev); n.delete(id); return n; }), 500); } setSupported(next); try { localStorage.setItem('anb-supported', JSON.stringify([...next])); } catch {} }, [supported, supportPost, isAuthenticated, user, toast, navigate]);"
if old not in text: raise SystemExit('Feed support anchor missing')
text = text.replace(old, new, 1)
old = "  const handleSubmitComment = useCallback((postId: string) => { const text = (commentTexts[postId] ?? '').trim(); if (!text || !user) return; addComment(postId, text, replyingTo[postId] ?? undefined); setCommentTexts(prev => ({ ...prev, [postId]: '' })); setReplyingTo(prev => ({ ...prev, [postId]: null })); toast('Comentário adicionado!'); }, [commentTexts, replyingTo, user, addComment, toast]);"
new = "  const handleSubmitComment = useCallback(async (postId: string) => { const text = (commentTexts[postId] ?? '').trim(); if (!text || !user) return; const result = await addComment(postId, text, replyingTo[postId] ?? undefined); if (!result.ok) { toast(result.error || 'Não foi possível adicionar o comentário.', 'error'); return; } setCommentTexts(prev => ({ ...prev, [postId]: '' })); setReplyingTo(prev => ({ ...prev, [postId]: null })); toast('Comentário adicionado!'); }, [commentTexts, replyingTo, user, addComment, toast]);"
if old not in text: raise SystemExit('Feed comment anchor missing')
text = text.replace(old, new, 1)
old = "  const handleDeletePost = useCallback((postId: string) => { deletePost(postId); setConfirmDeleteId(null); toast('Relato excluído.', 'info'); }, [deletePost, toast]);"
new = "  const handleDeletePost = useCallback(async (postId: string) => { const result = await deletePost(postId); if (!result.ok) { toast(result.error || 'Não foi possível excluir o relato.', 'error'); return; } setConfirmDeleteId(null); toast('Relato excluído.', 'info'); }, [deletePost, toast]);"
if old not in text: raise SystemExit('Feed delete post anchor missing')
text = text.replace(old, new, 1)
old = "  const handleDeleteComment = useCallback((commentId: string) => { deleteComment(commentId); toast('Comentário excluído.', 'info'); }, [deleteComment, toast]);"
new = "  const handleDeleteComment = useCallback(async (commentId: string) => { const result = await deleteComment(commentId); if (!result.ok) { toast(result.error || 'Não foi possível excluir o comentário.', 'error'); return; } toast('Comentário excluído.', 'info'); }, [deleteComment, toast]);"
if old not in text: raise SystemExit('Feed delete comment anchor missing')
text = text.replace(old, new, 1)
old = "  const handleStatusChange = useCallback((postId: string, status: PostStatus) => { updatePostStatus(postId, status); const labels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \\\"${labels[status]}\\\".`); }, [updatePostStatus, toast]);"
if old not in text:
    old = "  const handleStatusChange = useCallback((postId: string, status: PostStatus) => { updatePostStatus(postId, status); const labels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \"${labels[status]}\".`); }, [updatePostStatus, toast]);"
new = "  const handleStatusChange = useCallback(async (postId: string, status: PostStatus) => { const result = await updatePostStatus(postId, status); if (!result.ok) { toast(result.error || 'Não foi possível atualizar o status.', 'error'); return; } const labels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido' }; toast(`Status atualizado para \\\"${labels[status]}\\\".`); }, [updatePostStatus, toast]);"
if old not in text: raise SystemExit('Feed status anchor missing')
text = text.replace(old, new, 1)
old = "  const handleSendReport = async () => { if (!reportReason.trim()) return; const finalReason = reportDetail.trim() ? `${reportReason}: ${reportDetail}` : reportReason; await reportContent({ ...showReport, reason: finalReason }); setShowReport(null); setReportReason(''); setReportDetail(''); toast('Denúncia enviada para análise do administrador.'); };"
new = "  const handleSendReport = async () => { if (!reportReason.trim()) return; if (!isAuthenticated || !user) { toast('Entre ou crie uma conta para denunciar conteúdo.', 'info'); navigate('/login'); return; } const finalReason = reportDetail.trim() ? `${reportReason}: ${reportDetail}` : reportReason; const result = await reportContent({ ...showReport, reason: finalReason }); if (!result.ok) { toast(result.error || 'Não foi possível enviar a denúncia.', 'error'); return; } setShowReport(null); setReportReason(''); setReportDetail(''); toast('Denúncia enviada para análise do administrador.'); };"
if old not in text: raise SystemExit('Feed report anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# Mural: propagate delete/attendance/report errors.
p = Path('src/pages/Mural.tsx')
text = p.read_text()
old = """  const handleDelete = useCallback((id: string) => {
    void deleteEvent(id);
    setConfirmDeleteId(null);
    toast('Evento removido.', 'info');
  }, [deleteEvent, toast]);
"""
new = """  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteEvent(id);
    if (!result.ok) { toast(result.error || 'Não foi possível remover o evento.', 'error'); return; }
    setConfirmDeleteId(null);
    toast('Evento removido.', 'info');
  }, [deleteEvent, toast]);
"""
if old not in text: raise SystemExit('Mural delete anchor missing')
text = text.replace(old, new, 1)
old = """    await toggleAttendance(eventId);
    toast('Presença atualizada!');
"""
new = """    const result = await toggleAttendance(eventId);
    if (!result.ok) { toast(result.error || 'Não foi possível atualizar sua presença.', 'error'); return; }
    toast('Presença atualizada!');
"""
if old not in text: raise SystemExit('Mural attendance anchor missing')
text = text.replace(old, new, 1)
old = """    const reason = reportDetail.trim() ? `${reportReason}: ${reportDetail.trim()}` : reportReason;
    await reportContent({ eventId: showReport.eventId, reason });
    setShowReport(null);
"""
new = """    const reason = reportDetail.trim() ? `${reportReason}: ${reportDetail.trim()}` : reportReason;
    const result = await reportContent({ eventId: showReport.eventId, reason });
    if (!result.ok) { toast(result.error || 'Não foi possível enviar a denúncia.', 'error'); return; }
    setShowReport(null);
"""
if old not in text: raise SystemExit('Mural report anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# Legacy same-origin image endpoint: only passive raster formats and bounded payloads.
p = Path('api/post-image.js')
text = p.read_text()
old = """    const mime = match[1] || 'image/jpeg';
    const bytes = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(bytes.length));
"""
new = """    const mime = String(match[1] || 'image/jpeg').toLowerCase();
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMimes.has(mime)) return res.status(415).end();
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 5 * 1024 * 1024) return res.status(413).end();
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', String(bytes.length));
"""
if old not in text: raise SystemExit('image MIME anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# Legacy Flask entrypoint must respect selected config and never force the debugger.
replace_once('backend/app.py', '    app.run(host="0.0.0.0", port=5000, debug=True)', '    app.run(host="0.0.0.0", port=5000, debug=app.debug)')

# Remove temporary automation files from the resulting source commit.
Path('.github/workflows/audit-source-fixes.yml').unlink(missing_ok=True)
Path('.github/audit_source_fixes.py').unlink(missing_ok=True)
