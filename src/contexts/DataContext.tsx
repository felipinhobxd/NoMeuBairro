import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode, useEffect } from 'react';
import type { Post, PostCategory, PostStatus, CommunityEvent, EventType, Comment, AppNotification, LocationPrecision } from '../types';
import { useAuth } from './AuthContext';
import { canonicalNeighborhoodName, curitibaNeighborhoods, normalizeNeighborhoodText } from './NeighborhoodContext';
import { supabase } from '../utils/supabase';
import { storePostImage, deleteStoredPostImage } from '../utils/imageStorage';

type ActionResult = { ok: boolean; error?: string };
type ResolvedLocation = {
  latitude?: number;
  longitude?: number;
  neighborhood?: string;
  locality?: string;
  precision?: LocationPrecision;
};

interface DataContextType {
  posts: Post[];
  events: CommunityEvent[];
  comments: Comment[];
  notifications: AppNotification[];
  reports: any[];
  unreadCount: number;
  commentsByPost: Record<string, Comment[]>;
  attendingEventIds: Set<string>;
  loading: boolean;
  postsLoading: boolean;
  eventsLoading: boolean;
  loadPosts: (force?: boolean) => Promise<void>;
  loadEvents: (force?: boolean) => Promise<void>;
  loadComments: (postId: string, force?: boolean) => Promise<void>;
  loadMyAttendance: (force?: boolean) => Promise<void>;
  fetchData: () => Promise<void>;
  addPost: (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addAnonymousPost: (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addEvent: (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  supportPost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<ActionResult>;
  updatePostStatus: (postId: string, status: PostStatus) => Promise<ActionResult>;
  deleteEvent: (eventId: string) => Promise<void>;
  toggleAttendance: (eventId: string) => Promise<void>;
  getEventAttendees: (eventId: string) => Promise<any[]>;
  reportContent: (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => Promise<void>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'ignored') => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  isMyPost: (post: { id: string; authorId: string }) => boolean;
  isMyEvent: (event: { id: string; createdBy: string }) => boolean;
}

const DataContext = createContext<DataContextType>(null!);
const SK_MY_ANON = 'anb-my-anonymous-ids';
const SK_ANON_TOKENS = 'anb-anonymous-control-tokens';
const POST_LIMIT = 30;
const EVENT_LIMIT = 60;
const COMMENT_PER_POST_LIMIT = 100;
const NOTIFICATION_LIMIT = 40;
const NOTIFICATION_SELECT = 'id,user_id,actor_id,type,post_id,comment_id,job_id,application_id,event_id,is_read,created_at,users:actor_id(name,avatar_url),posts:post_id(title),comments:comment_id(content),job_posts:job_id(title),events:event_id(title)';

function fallbackNeighborhoodFromText(location: string) {
  const normalized = normalizeNeighborhoodText(location);
  if (!normalized) return undefined;
  for (const item of curitibaNeighborhoods) {
    const candidates = [item.name, ...(item.aliases || [])].map(normalizeNeighborhoodText);
    if (candidates.some((candidate) => candidate.length >= 3 && normalized.includes(candidate))) return item.kind === 'locality' ? item.parentNeighborhood : item.name;
  }
  return undefined;
}

async function resolveLocation(location: string, latitude?: number, longitude?: number, neighborhood?: string): Promise<ResolvedLocation> {
  try {
    const { data, error } = await supabase.functions.invoke('anonymous-post-control', { body: { action: 'resolve_location', location, latitude, longitude, neighborhood } });
    if (!error && data?.ok) {
      return {
        latitude: data.latitude == null ? latitude : Number(data.latitude),
        longitude: data.longitude == null ? longitude : Number(data.longitude),
        neighborhood: data.neighborhood || canonicalNeighborhoodName(neighborhood) || fallbackNeighborhoodFromText(location),
        locality: data.locality || undefined,
        precision: data.precision || undefined,
      };
    }
  } catch (error) { console.warn('Não foi possível resolver o bairro pelo serviço de localização:', error); }
  return {
    latitude,
    longitude,
    neighborhood: canonicalNeighborhoodName(neighborhood) || fallbackNeighborhoodFromText(location),
    locality: normalizeNeighborhoodText(location).includes('vitoria regia') ? 'Vitória Régia' : undefined,
    precision: latitude != null && longitude != null ? 'exact' : undefined,
  };
}

function mapPost(p: any): Post {
  return {
    id: p.id, authorId: p.author_id || 'anonymous',
    authorName: p.is_anonymous ? 'Denúncia Anônima' : (p.users?.name || 'Morador'),
    authorAvatarUrl: p.is_anonymous ? undefined : p.users?.avatar_url,
    category: p.category, status: p.status, title: p.title, description: p.description,
    imageUrl: p.image_url || undefined, location: p.location || '',
    neighborhood: p.neighborhood || undefined, locality: p.locality || undefined,
    locationPrecision: p.location_precision || undefined,
    latitude: p.latitude == null ? undefined : Number(p.latitude),
    longitude: p.longitude == null ? undefined : Number(p.longitude),
    supports: p.post_supports?.[0]?.count ?? p.supports ?? 0,
    commentsCount: p.comments_count ?? 0,
    createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

function mapEvent(e: any): CommunityEvent {
  return {
    id: e.id, title: e.title, description: e.description, date: e.event_date, location: e.location,
    neighborhood: e.neighborhood || undefined, locality: e.locality || undefined,
    locationPrecision: e.location_precision || undefined,
    latitude: e.latitude == null ? undefined : Number(e.latitude), longitude: e.longitude == null ? undefined : Number(e.longitude),
    type: e.type, createdBy: e.created_by, createdAt: e.created_at,
    attendanceCount: e.event_attendance?.[0]?.count ?? e.attendance_count ?? 0,
  };
}

function mapComment(c: any): Comment {
  return { id: c.id, postId: c.post_id, authorId: c.author_id, authorName: c.users?.name || 'Morador', authorAvatarUrl: c.users?.avatar_url || undefined, content: c.content, parentId: c.parent_id || undefined, createdAt: c.created_at };
}

function mapNotification(n: any): AppNotification {
  return {
    id: n.id, userId: n.user_id, actorId: n.actor_id || undefined,
    actorName: n.users?.name || (n.type === 'post_resolved' ? 'NoMeuBairro' : 'Alguém'), actorAvatarUrl: n.users?.avatar_url || undefined,
    type: n.type, postId: n.post_id || undefined, commentId: n.comment_id || undefined, jobId: n.job_id || undefined,
    applicationId: n.application_id || undefined, eventId: n.event_id || undefined,
    postTitle: n.posts?.title || undefined, jobTitle: n.job_posts?.title || undefined, eventTitle: n.events?.title || undefined,
    content: n.comments?.content || undefined, isRead: Boolean(n.is_read), createdAt: n.created_at,
  };
}

function createAnonymousEditToken() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reports] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [managedAnonIds, setManagedAnonIds] = useState<Set<string>>(new Set());
  const [attendingEventIds, setAttendingEventIds] = useState<Set<string>>(new Set());

  const postsLoadedRef = useRef(false); const eventsLoadedRef = useRef(false);
  const postsRequestRef = useRef<Promise<void> | null>(null); const eventsRequestRef = useRef<Promise<void> | null>(null);
  const commentRequestsRef = useRef<Map<string, Promise<void>>>(new Map()); const loadedCommentPostsRef = useRef<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());
  const notificationRequestRef = useRef<Promise<void> | null>(null); const notificationLoadedUserRef = useRef<string | null>(null);
  const attendanceRequestRef = useRef<Promise<void> | null>(null); const attendanceLoadedUserRef = useRef<string | null>(null);
  const attendanceIdsRef = useRef<Set<string>>(new Set());

  const setAttendanceIds = useCallback((next: Set<string>) => { attendanceIdsRef.current = next; setAttendingEventIds(new Set(next)); }, []);
  const getMyAnonIds = useCallback((): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SK_MY_ANON) || '[]')); } catch { return new Set(); } }, []);
  const getAnonTokens = useCallback((): Record<string, string> => { try { const parsed = JSON.parse(localStorage.getItem(SK_ANON_TOKENS) || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }, []);
  const saveAnonControl = useCallback((id: string, token: string) => { try { const ids = getMyAnonIds(); ids.add(id); localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids])); const tokens = getAnonTokens(); tokens[id] = token; localStorage.setItem(SK_ANON_TOKENS, JSON.stringify(tokens)); } catch {} setManagedAnonIds(prev => new Set(prev).add(id)); }, [getAnonTokens, getMyAnonIds]);
  const clearAnonControl = useCallback((id: string) => { try { const ids = getMyAnonIds(); ids.delete(id); localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids])); const tokens = getAnonTokens(); delete tokens[id]; localStorage.setItem(SK_ANON_TOKENS, JSON.stringify(tokens)); } catch {} setManagedAnonIds(prev => { const next = new Set(prev); next.delete(id); return next; }); }, [getAnonTokens, getMyAnonIds]);

  const loadPosts = useCallback(async (force = false) => {
    if (postsRequestRef.current) return postsRequestRef.current;
    if (postsLoadedRef.current && !force) return;
    const request = (async () => {
      setPostsLoading(true);
      try {
        const { data, error } = await supabase.from('posts').select('id,author_id,category,status,title,description,image_url,location,neighborhood,locality,location_precision,latitude,longitude,is_anonymous,created_at,updated_at,comments_count,post_supports(count),users(name,avatar_url)').order('created_at', { ascending: false }).limit(POST_LIMIT);
        if (error) { console.error('Erro ao carregar relatos:', error); return; }
        setPosts((data || []).map(mapPost)); postsLoadedRef.current = true;
      } finally { setPostsLoading(false); postsRequestRef.current = null; }
    })();
    postsRequestRef.current = request; return request;
  }, []);

  const loadEvents = useCallback(async (force = false) => {
    if (eventsRequestRef.current) return eventsRequestRef.current;
    if (eventsLoadedRef.current && !force) return;
    const request = (async () => {
      setEventsLoading(true);
      try {
        const { data, error } = await supabase.from('events').select('id,title,description,event_date,location,neighborhood,locality,location_precision,latitude,longitude,type,created_by,created_at,event_attendance(count)').order('event_date', { ascending: true }).limit(EVENT_LIMIT);
        if (error) { console.error('Erro ao carregar eventos:', error); return; }
        setEvents((data || []).map(mapEvent)); eventsLoadedRef.current = true;
      } finally { setEventsLoading(false); eventsRequestRef.current = null; }
    })();
    eventsRequestRef.current = request; return request;
  }, []);

  const loadComments = useCallback(async (postId: string, force = false) => {
    if (!postId) return;
    const currentRequest = commentRequestsRef.current.get(postId); if (currentRequest) return currentRequest;
    if (loadedCommentPostsRef.current.has(postId) && !force) return;
    const request = (async () => {
      try {
        const { data, error } = await supabase.from('comments').select('id,post_id,author_id,content,parent_id,created_at,users(name,avatar_url)').eq('post_id', postId).order('created_at', { ascending: true }).limit(COMMENT_PER_POST_LIMIT);
        if (error) { console.error('Erro ao carregar comentários:', error); return; }
        setComments(prev => [...prev.filter(comment => comment.postId !== postId), ...(data || []).map(mapComment)]);
        loadedCommentPostsRef.current.add(postId);
      } finally { commentRequestsRef.current.delete(postId); }
    })();
    commentRequestsRef.current.set(postId, request); return request;
  }, []);

  const fetchNotifications = useCallback(async (force = false) => {
    const userId = user?.id;
    if (!userId) { setNotifications([]); notificationLoadedUserRef.current = null; return; }
    if (notificationRequestRef.current) return notificationRequestRef.current;
    if (notificationLoadedUserRef.current === userId && !force) return;
    const request = (async () => {
      try {
        const { data, error } = await supabase.from('notifications').select(NOTIFICATION_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(NOTIFICATION_LIMIT);
        if (error) { console.error('Erro ao carregar notificações:', error); return; }
        setNotifications((data || []).map(mapNotification)); notificationLoadedUserRef.current = userId;
      } finally { notificationRequestRef.current = null; }
    })();
    notificationRequestRef.current = request; return request;
  }, [user?.id]);

  const fetchNotificationById = useCallback(async (notificationId: string) => {
    const userId = user?.id; if (!userId || !notificationId) return;
    const { data, error } = await supabase.from('notifications').select(NOTIFICATION_SELECT).eq('id', notificationId).eq('user_id', userId).maybeSingle();
    if (error || !data) return;
    const mapped = mapNotification(data); setNotifications(prev => [mapped, ...prev.filter(item => item.id !== mapped.id)].slice(0, NOTIFICATION_LIMIT));
  }, [user?.id]);

  const loadMyAttendance = useCallback(async (force = false) => {
    const userId = user?.id;
    if (!userId) { attendanceLoadedUserRef.current = null; setAttendanceIds(new Set()); return; }
    if (attendanceRequestRef.current) return attendanceRequestRef.current;
    if (attendanceLoadedUserRef.current === userId && !force) return;
    const request = (async () => {
      try {
        const { data, error } = await supabase.from('event_attendance').select('event_id').eq('user_id', userId);
        if (error) { console.error('Erro ao carregar presenças:', error); return; }
        setAttendanceIds(new Set((data || []).map(row => row.event_id as string))); attendanceLoadedUserRef.current = userId;
      } finally { attendanceRequestRef.current = null; }
    })();
    attendanceRequestRef.current = request; return request;
  }, [user?.id, setAttendanceIds]);

  // Compatibilidade com o botão de atualizar do Feed: atualiza apenas relatos.
  const fetchData = useCallback(async () => { await loadPosts(true); }, [loadPosts]);

  useEffect(() => {
    notificationRequestRef.current = null; notificationLoadedUserRef.current = null;
    attendanceRequestRef.current = null; attendanceLoadedUserRef.current = null; setAttendanceIds(new Set());
    if (user?.id) void fetchNotifications(true); else setNotifications([]);
  }, [user?.id, fetchNotifications, setAttendanceIds]);

  useEffect(() => {
    let active = true;
    if (!user) { setManagedAnonIds(new Set()); return () => { active = false; }; }
    void supabase.functions.invoke('anonymous-post-control', { body: { action: 'list_owned' } }).then(({ data, error }) => { if (!active || error || !data?.ok) return; setManagedAnonIds(new Set(Array.isArray(data.postIds) ? data.postIds : [])); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`notifications-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => { const id = payload?.new?.id; if (id) void fetchNotificationById(String(id)); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchNotificationById, user?.id]);

  const addPost = useCallback(async (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const stored = await storePostImage(data.imageUrl, user.id);
    if (stored.error) return { error: { message: `Não foi possível salvar a imagem: ${stored.error}` } };
    const resolved = await resolveLocation(data.location, data.latitude, data.longitude);
    const { data: inserted, error } = await supabase.from('posts').insert({ author_id: user.id, category: data.category, title: data.title, description: data.description, image_url: stored.url, location: data.location, latitude: resolved.latitude, longitude: resolved.longitude, neighborhood: resolved.neighborhood || null, locality: resolved.locality || null, location_precision: resolved.precision || null, is_anonymous: false }).select('id,author_id,category,status,title,description,image_url,location,neighborhood,locality,location_precision,latitude,longitude,created_at,updated_at,comments_count').single();
    if (error || !inserted) {
      await deleteStoredPostImage(stored.url);
      return { data: inserted, error } as any;
    }
    const nextPost = mapPost({ ...inserted, users: { name: user.name, avatar_url: user.avatarUrl }, post_supports: [{ count: 0 }] });
    postsLoadedRef.current = true; setPosts(prev => [nextPost, ...prev.filter(post => post.id !== nextPost.id)].slice(0, POST_LIMIT));
    return { data: inserted, error: null } as any;
  }, [user]);

  const addAnonymousPost = useCallback(async (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    const stored = await storePostImage(data.imageUrl, 'anonymous');
    if (stored.error) return { error: { message: `Não foi possível salvar a imagem: ${stored.error}` } };
    const editToken = createAnonymousEditToken();
    const { data: result, error } = await supabase.functions.invoke('anonymous-post-control', { body: { action: 'create', tipo: data.tipo, description: data.description, location: data.location || 'Local Privado', imageUrl: stored.url, latitude: data.latitude, longitude: data.longitude, editToken } });
    if (error || !result?.ok || !result?.postId) {
      // Para uploads autenticados/permitidos, evita deixar arquivo se a criação falhar.
      await deleteStoredPostImage(stored.url);
      return { error: { message: result?.error || error?.message || 'Não foi possível enviar a denúncia.' } };
    }
    saveAnonControl(result.postId, editToken);
    const { data: row } = await supabase.from('posts').select('id,category,status,title,description,image_url,location,neighborhood,locality,location_precision,latitude,longitude,created_at,updated_at,comments_count').eq('id', result.postId).maybeSingle();
    if (row) { const nextPost = mapPost({ ...row, author_id: null, is_anonymous: true, post_supports: [{ count: 0 }] }); postsLoadedRef.current = true; setPosts(prev => [nextPost, ...prev.filter(post => post.id !== nextPost.id)].slice(0, POST_LIMIT)); }
    return { error: null };
  }, [saveAnonControl]);

  const supportPost = useCallback(async (postId: string) => {
    if (!user || processingRef.current.has(postId)) return; processingRef.current.add(postId);
    try {
      const { data: existing } = await supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
      if (existing) { const { error } = await supabase.from('post_supports').delete().eq('id', existing.id); if (!error) setPosts(prev => prev.map(post => post.id === postId ? { ...post, supports: Math.max(0, post.supports - 1) } : post)); }
      else { const { error } = await supabase.from('post_supports').insert({ post_id: postId, user_id: user.id }); if (!error) setPosts(prev => prev.map(post => post.id === postId ? { ...post, supports: post.supports + 1 } : post)); }
    } finally { processingRef.current.delete(postId); }
  }, [user]);

  const addComment = useCallback(async (postId: string, content: string, parentId?: string) => {
    if (!user || !content.trim()) return;
    const { data: inserted, error } = await supabase.from('comments').insert({ post_id: postId, author_id: user.id, parent_id: parentId, content: content.trim() }).select('id,post_id,author_id,content,parent_id,created_at').single();
    if (error || !inserted) return;
    const nextComment: Comment = { id: inserted.id, postId: inserted.post_id, authorId: inserted.author_id, authorName: user.name || 'Morador', authorAvatarUrl: user.avatarUrl, content: inserted.content, parentId: inserted.parent_id || undefined, createdAt: inserted.created_at };
    loadedCommentPostsRef.current.add(postId); setComments(prev => [...prev.filter(comment => comment.id !== nextComment.id), nextComment]); setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post));
  }, [user]);

  const deleteComment = useCallback(async (commentId: string) => {
    const target = comments.find(comment => comment.id === commentId); const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) { setComments(prev => prev.filter(comment => comment.id !== commentId)); if (target?.postId) setPosts(prev => prev.map(post => post.id === target.postId ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) } : post)); }
  }, [comments]);

  const deletePost = useCallback(async (postId: string): Promise<ActionResult> => {
    const target = posts.find(post => post.id === postId);
    if (target?.authorId === 'anonymous') {
      const token = getAnonTokens()[postId] || ''; const { data, error } = await supabase.functions.invoke('anonymous-post-control', { body: { action: 'delete', postId, editToken: token } });
      if (error || !data?.ok) return { ok: false, error: data?.error || error?.message || 'Não foi possível excluir a denúncia.' };
      clearAnonControl(postId); setPosts(prev => prev.filter(post => post.id !== postId)); setComments(prev => prev.filter(comment => comment.postId !== postId)); loadedCommentPostsRef.current.delete(postId); return { ok: true };
    }
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) return { ok: false, error: error.message };
    await deleteStoredPostImage(target?.imageUrl);
    setPosts(prev => prev.filter(post => post.id !== postId)); setComments(prev => prev.filter(comment => comment.postId !== postId)); loadedCommentPostsRef.current.delete(postId); return { ok: true };
  }, [posts, getAnonTokens, clearAnonControl]);

  const updatePostStatus = useCallback(async (postId: string, status: PostStatus): Promise<ActionResult> => {
    const target = posts.find(post => post.id === postId);
    if (target?.authorId === 'anonymous') {
      const token = getAnonTokens()[postId] || ''; const { data, error } = await supabase.functions.invoke('anonymous-post-control', { body: { action: 'update_status', postId, status, editToken: token } });
      if (error || !data?.ok) return { ok: false, error: data?.error || error?.message || 'Não foi possível atualizar o status.' };
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, status, updatedAt: new Date().toISOString() } : post)); return { ok: true };
    }
    const { error } = await supabase.from('posts').update({ status }).eq('id', postId); if (error) return { ok: false, error: error.message };
    setPosts(prev => prev.map(post => post.id === postId ? { ...post, status, updatedAt: new Date().toISOString() } : post)); return { ok: true };
  }, [posts, getAnonTokens]);

  const deleteEvent = useCallback(async (eventId: string) => { const { error } = await supabase.from('events').delete().eq('id', eventId); if (!error) setEvents(prev => prev.filter(event => event.id !== eventId)); }, []);

  const toggleAttendance = useCallback(async (eventId: string) => {
    const userId = user?.id; if (!userId) return; if (attendanceLoadedUserRef.current !== userId) await loadMyAttendance(); const isAttending = attendanceIdsRef.current.has(eventId);
    if (isAttending) { const { error } = await supabase.from('event_attendance').delete().eq('event_id', eventId).eq('user_id', userId); if (!error) { const next = new Set(attendanceIdsRef.current); next.delete(eventId); setAttendanceIds(next); setEvents(prev => prev.map(event => event.id === eventId ? { ...event, attendanceCount: Math.max(0, (event.attendanceCount || 0) - 1) } : event)); } }
    else { const { error } = await supabase.from('event_attendance').insert({ event_id: eventId, user_id: userId }); if (!error) { const next = new Set(attendanceIdsRef.current); next.add(eventId); setAttendanceIds(next); setEvents(prev => prev.map(event => event.id === eventId ? { ...event, attendanceCount: (event.attendanceCount || 0) + 1 } : event)); } }
  }, [user?.id, loadMyAttendance, setAttendanceIds]);

  const getEventAttendees = useCallback(async (eventId: string) => { const { data, error } = await supabase.from('event_attendance').select('id,event_id,user_id,users:user_id(name,avatar_url)').eq('event_id', eventId).limit(100); if (error) return []; return (data || []).map((a: any) => ({ id: a.id, eventId: a.event_id, userId: a.user_id, userName: a.users?.name || 'Morador', userAvatarUrl: a.users?.avatar_url })); }, []);

  const addEvent = useCallback(async (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' }; const resolved = await resolveLocation(data.location, data.latitude, data.longitude);
    const { data: inserted, error } = await supabase.from('events').insert({ title: data.title, description: data.description, event_date: data.date, location: data.location, type: data.type, latitude: resolved.latitude, longitude: resolved.longitude, neighborhood: resolved.neighborhood || null, locality: resolved.locality || null, location_precision: resolved.precision || null, created_by: user.id }).select('id,title,description,event_date,location,neighborhood,locality,location_precision,latitude,longitude,type,created_by,created_at').single();
    if (!error && inserted) { const nextEvent = mapEvent({ ...inserted, event_attendance: [{ count: 0 }] }); eventsLoadedRef.current = true; setEvents(prev => [...prev.filter(event => event.id !== nextEvent.id), nextEvent].sort((a, b) => a.date.localeCompare(b.date)).slice(0, EVENT_LIMIT)); }
    return { data: inserted, error } as any;
  }, [user]);

  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; eventId?: string; reason: string }) => { await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, event_id: data.eventId, reason: data.reason }); }, [user]);
  const updateReportStatus = useCallback(async (reportId: string, status: 'resolved' | 'ignored') => { await supabase.from('content_reports').update({ status, archived_at: new Date().toISOString(), archived_by: user?.id }).eq('id', reportId); }, [user]);
  const markNotificationAsRead = useCallback(async (notificationId: string) => { if (!user) return; const target = notifications.find(n => n.id === notificationId); if (target?.isRead) return; const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.id); if (!error) setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)); }, [user, notifications]);
  const markNotificationsAsRead = useCallback(async () => { if (!user) return; const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false); if (!error) setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); }, [user]);
  const deleteAllNotifications = useCallback(async () => { if (!user) return; const { error } = await supabase.from('notifications').delete().eq('user_id', user.id); if (!error) setNotifications([]); }, [user]);
  const isMyPost = useCallback((post: { id: string; authorId: string }) => { if (post.authorId === 'anonymous') { const token = getAnonTokens()[post.id]; return Boolean(token) || managedAnonIds.has(post.id); } return !!user && post.authorId === user.id; }, [user, managedAnonIds, getAnonTokens]);
  const isMyEvent = useCallback((event: { id: string; createdBy: string }) => !!user && event.createdBy === user.id, [user]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
  const commentsByPost = useMemo(() => { const map: Record<string, Comment[]> = {}; for (const c of comments) (map[c.postId] ??= []).push(c); return map; }, [comments]);
  const loading = postsLoading || eventsLoading;

  const contextValue = useMemo(() => ({ posts, events, comments, notifications, reports, unreadCount, commentsByPost, attendingEventIds, loading, postsLoading, eventsLoading, loadPosts, loadEvents, loadComments, loadMyAttendance, fetchData, addPost, addAnonymousPost, addEvent, supportPost, addComment, deleteComment, deletePost, updatePostStatus, deleteEvent, toggleAttendance, getEventAttendees, reportContent, updateReportStatus, markNotificationAsRead, markNotificationsAsRead, deleteAllNotifications, isMyPost, isMyEvent }), [posts, events, comments, notifications, reports, unreadCount, commentsByPost, attendingEventIds, loading, postsLoading, eventsLoading, loadPosts, loadEvents, loadComments, loadMyAttendance, fetchData, addPost, addAnonymousPost, addEvent, supportPost, addComment, deleteComment, deletePost, updatePostStatus, deleteEvent, toggleAttendance, getEventAttendees, reportContent, updateReportStatus, markNotificationAsRead, markNotificationsAsRead, deleteAllNotifications, isMyPost, isMyEvent]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
