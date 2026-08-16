import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode, useEffect } from 'react';
import type { Post, PostCategory, PostStatus, Business, BusinessCategory, CommunityEvent, EventType, Comment, AppNotification } from '../types';
import { useAuth } from './AuthContext';
import { useNeighborhood, curitibaNeighborhoods } from './NeighborhoodContext';
import { supabase } from '../utils/supabase';

interface DataContextType {
  posts: Post[];
  businesses: Business[];
  events: CommunityEvent[];
  comments: Comment[];
  notifications: AppNotification[];
  reports: any[];
  unreadCount: number;
  commentsByPost: Record<string, Comment[]>;
  loading: boolean;
  fetchData: () => Promise<void>;
  addPost: (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addAnonymousPost: (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addBusiness: (data: { name: string; description: string; category: BusinessCategory; neighborhood?: string; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; openTime?: string; closeTime?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addEvent: (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  supportPost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  updatePostStatus: (postId: string, status: PostStatus) => Promise<void>;
  deleteBusiness: (businessId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  toggleAttendance: (eventId: string) => Promise<void>;
  getEventAttendees: (eventId: string) => Promise<any[]>;
  addBusinessRating: (data: { businessId: string; stars: number; comment?: string }) => Promise<void>;
  getBusinessRatings: (businessId: string) => Promise<any[]>;
  reportContent: (data: { postId?: string; commentId?: string; reason: string }) => Promise<void>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'ignored') => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  isMyPost: (post: { id: string; authorId: string }) => boolean;
  isMyBusiness: (business: { id: string; createdBy: string }) => boolean;
  isMyEvent: (event: { id: string; createdBy: string }) => boolean;
}

const DataContext = createContext<DataContextType>(null!);
const SK_MY_ANON = 'anb-my-anonymous-ids';
const POST_LIMIT = 30;
const COMMENT_LIMIT = 300;
const BUSINESS_LIMIT = 150;
const EVENT_LIMIT = 100;
const RATING_LIMIT = 1000;
const NOTIFICATION_LIMIT = 50;

const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferNeighborhood(latitude?: number, longitude?: number) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  let nearest = curitibaNeighborhoods[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const neighborhood of curitibaNeighborhoods) {
    const distance = calculateDistance(latitude, longitude, neighborhood.latitude, neighborhood.longitude);
    if (distance < nearestDistance) { nearest = neighborhood; nearestDistance = distance; }
  }
  return nearest?.name || null;
}

function withInferredNeighborhood(location: string | null | undefined, latitude?: number, longitude?: number) {
  const base = (location || '').trim();
  const inferred = inferNeighborhood(latitude, longitude);
  if (!inferred) return base;
  if (normalizeText(base).includes(normalizeText(inferred))) return base;
  return base ? `${base} — ${inferred}` : inferred;
}

function mapNotification(n: any): AppNotification {
  return {
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id || undefined,
    actorName: n.users?.name || (n.type === 'post_resolved' ? 'NoMeuBairro' : 'Alguém'),
    actorAvatarUrl: n.users?.avatar_url || undefined,
    type: n.type,
    postId: n.post_id || undefined,
    commentId: n.comment_id || undefined,
    jobId: n.job_id || undefined,
    applicationId: n.application_id || undefined,
    eventId: n.event_id || undefined,
    postTitle: n.posts?.title || undefined,
    jobTitle: n.job_posts?.title || undefined,
    eventTitle: n.events?.title || undefined,
    content: n.comments?.content || undefined,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useNeighborhood();
  const [posts, setPosts] = useState<Post[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const processingRef = useRef<Set<string>>(new Set());

  const getMyAnonIds = useCallback((): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(SK_MY_ANON) || '[]')); } catch { return new Set(); }
  }, []);
  const addMyAnonId = useCallback((id: string) => {
    try { const ids = getMyAnonIds(); ids.add(id); localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids])); } catch {}
  }, [getMyAnonIds]);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,actor_id,type,post_id,comment_id,job_id,application_id,event_id,is_read,created_at,users:actor_id(name,avatar_url),posts:post_id(title),comments:comment_id(content),job_posts:job_id(title),events:event_id(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATION_LIMIT);
    if (error) {
      console.error('Erro ao carregar notificações:', error);
      return;
    }
    setNotifications((data || []).map(mapNotification));
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const [postsRes, bizRes, eventsRes, commentsRes, ratingsRes] = await Promise.all([
        supabase.from('posts').select('id,author_id,category,status,title,description,image_url,location,latitude,longitude,is_anonymous,created_at,updated_at,comments_count,post_supports(count),users(name,avatar_url)').order('created_at', { ascending: false }).limit(POST_LIMIT),
        supabase.from('businesses').select('id,name,description,category,phone,whatsapp,address,neighborhood,latitude,longitude,image_url,open_time,close_time,created_by,created_at,users!businesses_created_by_fkey(name,avatar_url)').order('created_at', { ascending: false }).limit(BUSINESS_LIMIT),
        supabase.from('events').select('id,title,description,event_date,location,latitude,longitude,type,created_by,created_at,event_attendance(count)').order('event_date', { ascending: true }).limit(EVENT_LIMIT),
        supabase.from('comments').select('id,post_id,author_id,content,parent_id,created_at,users(name,avatar_url)').order('created_at', { ascending: false }).limit(COMMENT_LIMIT),
        supabase.from('business_ratings').select('business_id,stars').order('created_at', { ascending: false }).limit(RATING_LIMIT),
      ]);

      if (postsRes.error) console.error('Erro ao carregar relatos:', postsRes.error);
      if (postsRes.data) setPosts(postsRes.data.map((p: any) => ({
        id: p.id,
        authorId: p.author_id || 'anonymous',
        authorName: p.is_anonymous ? 'Denúncia Anônima' : (p.users?.name || 'Morador'),
        authorAvatarUrl: p.is_anonymous ? undefined : p.users?.avatar_url,
        category: p.category,
        status: p.status,
        title: p.title,
        description: p.description,
        imageUrl: p.image_url || undefined,
        location: withInferredNeighborhood(p.location, p.latitude, p.longitude),
        latitude: p.latitude,
        longitude: p.longitude,
        supports: p.post_supports?.[0]?.count ?? 0,
        commentsCount: p.comments_count ?? 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })));

      const ratingsByBiz: Record<string, { total: number; sum: number }> = {};
      for (const r of ratingsRes.data || []) {
        const entry = ratingsByBiz[r.business_id] ||= { total: 0, sum: 0 };
        entry.total++;
        entry.sum += Number(r.stars) || 0;
      }
      if (bizRes.data) setBusinesses(bizRes.data.map((b: any) => ({
        id: b.id, name: b.name, description: b.description, category: b.category, phone: b.phone, whatsapp: b.whatsapp,
        address: b.address, neighborhood: b.neighborhood, latitude: b.latitude, longitude: b.longitude, imageUrl: b.image_url,
        open_time: b.open_time, close_time: b.close_time, createdBy: b.created_by, createdByName: b.users?.name || 'Morador', createdAt: b.created_at,
        avgRating: ratingsByBiz[b.id] ? ratingsByBiz[b.id].sum / ratingsByBiz[b.id].total : undefined, totalRatings: ratingsByBiz[b.id]?.total || 0,
      })));
      if (eventsRes.data) setEvents(eventsRes.data.map((e: any) => ({ id: e.id, title: e.title, description: e.description, date: e.event_date, location: e.location, latitude: e.latitude, longitude: e.longitude, type: e.type, createdBy: e.created_by, createdAt: e.created_at, attendanceCount: e.event_attendance?.[0]?.count ?? 0 })));
      if (commentsRes.data) setComments(commentsRes.data.map((c: any) => ({ id: c.id, postId: c.post_id, authorId: c.author_id, authorName: c.users?.name || 'Morador', authorAvatarUrl: c.users?.avatar_url, content: c.content, parentId: c.parent_id, createdAt: c.created_at })));
      await fetchNotifications();
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const refreshNotifications = () => { void fetchNotifications(); };
    const channel = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshNotifications)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshNotifications)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshNotifications)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchNotifications, user?.id]);

  const addPost = useCallback(async (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('posts').insert({ author_id: user.id, category: data.category, title: data.title, description: data.description, image_url: data.imageUrl, location: data.location, latitude: data.latitude, longitude: data.longitude, is_anonymous: false });
    if (!res.error) await fetchData();
    return res;
  }, [user, fetchData]);

  const addAnonymousPost = useCallback(async (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    const { data: postData, error: postErr } = await supabase.from('posts').insert({ author_id: null, category: 'seguranca', title: `Denúncia: ${data.tipo}`, description: data.description, image_url: data.imageUrl, location: data.location || 'Local Privado', latitude: data.latitude, longitude: data.longitude, is_anonymous: true }).select('id').single();
    if (!postErr && postData) { addMyAnonId(postData.id); await fetchData(); }
    return { error: postErr };
  }, [addMyAnonId, fetchData]);

  const addBusiness = useCallback(async (data: { name: string; description: string; category: BusinessCategory; neighborhood?: string; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; openTime?: string; closeTime?: string; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('businesses').insert({ name: data.name, description: data.description, category: data.category, phone: data.phone, whatsapp: data.whatsapp, address: data.address, neighborhood: data.neighborhood, image_url: data.imageUrl, open_time: data.openTime, close_time: data.closeTime, latitude: data.latitude, longitude: data.longitude, created_by: user.id });
    if (!res.error) await fetchData();
    return res;
  }, [user, fetchData]);

  const supportPost = useCallback(async (postId: string) => {
    if (!user || processingRef.current.has(postId)) return;
    processingRef.current.add(postId);
    try {
      const { data: existing } = await supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();
      if (existing) await supabase.from('post_supports').delete().eq('id', existing.id);
      else await supabase.from('post_supports').insert({ post_id: postId, user_id: user.id });
      await fetchData();
    } finally { processingRef.current.delete(postId); }
  }, [user, fetchData]);

  const addComment = useCallback(async (postId: string, content: string, parentId?: string) => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: user.id, parent_id: parentId, content: content.trim() });
    if (!error) await fetchData();
  }, [user, fetchData]);

  const deleteComment = useCallback(async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) await fetchData();
  }, [fetchData]);

  const deletePost = useCallback(async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      const ids = getMyAnonIds();
      if (ids.has(postId)) {
        ids.delete(postId);
        try { localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids])); } catch {}
      }
      await fetchData();
    }
  }, [getMyAnonIds, fetchData]);

  const updatePostStatus = useCallback(async (postId: string, status: PostStatus) => {
    const { error } = await supabase.from('posts').update({ status }).eq('id', postId);
    if (!error) await fetchData();
  }, [fetchData]);

  const deleteBusiness = useCallback(async (businessId: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', businessId);
    if (!error) await fetchData();
  }, [fetchData]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (!error) await fetchData();
  }, [fetchData]);

  const toggleAttendance = useCallback(async (eventId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('event_attendance').select('id').eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
    if (existing) await supabase.from('event_attendance').delete().eq('id', existing.id);
    else await supabase.from('event_attendance').insert({ event_id: eventId, user_id: user.id });
    await fetchData();
  }, [user, fetchData]);

  const getEventAttendees = useCallback(async (eventId: string) => {
    const { data, error } = await supabase.from('event_attendance').select('id,users:user_id(name,avatar_url)').eq('event_id', eventId).limit(100);
    if (error) return [];
    return (data || []).map((a: any) => ({ id: a.id, userName: a.users?.name || 'Morador', userAvatarUrl: a.users?.avatar_url }));
  }, []);

  const addBusinessRating = useCallback(async (data: { businessId: string; stars: number; comment?: string }) => {
    if (!user) return;
    const { error } = await supabase.from('business_ratings').upsert({ business_id: data.businessId, user_id: user.id, stars: data.stars, comment: data.comment, created_at: new Date().toISOString() }, { onConflict: 'business_id,user_id' });
    if (error) throw error;
    await fetchData();
  }, [user, fetchData]);

  const getBusinessRatings = useCallback(async (businessId: string) => {
    const { data, error } = await supabase.from('business_ratings').select('id,stars,comment,created_at,users:user_id(name,avatar_url)').eq('business_id', businessId).order('created_at', { ascending: false }).limit(100);
    if (error) return [];
    return (data || []).map((r: any) => ({ id: r.id, stars: r.stars, comment: r.comment, createdAt: r.created_at, userName: r.users?.name || 'Morador', userAvatarUrl: r.users?.avatar_url }));
  }, []);

  const addEvent = useCallback(async (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('events').insert({ title: data.title, description: data.description, event_date: data.date, location: data.location, type: data.type, latitude: data.latitude, longitude: data.longitude, created_by: user.id });
    if (!res.error) await fetchData();
    return res;
  }, [user, fetchData]);

  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; reason: string }) => {
    await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, reason: data.reason });
  }, [user]);

  const updateReportStatus = useCallback(async (reportId: string, status: 'resolved' | 'ignored') => {
    await supabase.from('content_reports').update({ status, archived_at: new Date().toISOString(), archived_by: user?.id }).eq('id', reportId);
  }, [user]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    const target = notifications.find(n => n.id === notificationId);
    if (target?.isRead) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.id);
    if (!error) setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
  }, [user, notifications]);

  const markNotificationsAsRead = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (!error) setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, [user]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (!error) setNotifications([]);
  }, [user]);

  const isMyPost = useCallback((post: { id: string; authorId: string }) => getMyAnonIds().has(post.id) || (!!user && post.authorId === user.id), [user, getMyAnonIds]);
  const isMyBusiness = useCallback((business: { id: string; createdBy: string }) => !!user && business.createdBy === user.id, [user]);
  const isMyEvent = useCallback((event: { id: string; createdBy: string }) => !!user && event.createdBy === user.id, [user]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
  const commentsByPost = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) (map[c.postId] ??= []).push(c);
    return map;
  }, [comments]);

  const contextValue = useMemo(() => ({
    posts, businesses, events, comments, notifications, reports, unreadCount, commentsByPost, loading,
    fetchData, addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, toggleAttendance, getEventAttendees,
    addBusinessRating, getBusinessRatings, reportContent, updateReportStatus, markNotificationAsRead,
    markNotificationsAsRead, deleteAllNotifications, isMyPost, isMyBusiness, isMyEvent,
  }), [
    posts, businesses, events, comments, notifications, reports, unreadCount, commentsByPost, loading,
    fetchData, addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, toggleAttendance, getEventAttendees,
    addBusinessRating, getBusinessRatings, reportContent, updateReportStatus, markNotificationAsRead,
    markNotificationsAsRead, deleteAllNotifications, isMyPost, isMyBusiness, isMyEvent,
  ]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
