import { createContext, useContext, useState, useCallback, useMemo, type ReactNode, useEffect } from 'react';
import type { Post, PostCategory, PostStatus, Business, BusinessCategory, CommunityEvent, EventType, Comment, AppNotification } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../utils/supabase';

interface DataContextType {
  posts: Post[];
  businesses: Business[];
  events: CommunityEvent[];
  comments: Comment[];
  notifications: AppNotification[];
  unreadCount: number;
  commentsByPost: Record<string, Comment[]>;
  loading: boolean;
  fetchData: () => Promise<void>;
  addPost: (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addAnonymousPost: (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
  addBusiness: (data: { name: string; description: string; category: BusinessCategory; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; openTime?: string; closeTime?: string; latitude?: number; longitude?: number }) => Promise<{ error: any }>;
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
  getAllReports: () => Promise<any[]>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'ignored') => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  isMyPost: (post: { id: string; authorId: string }) => boolean;
  isMyBusiness: (business: { id: string; createdBy: string }) => boolean;
  isMyEvent: (event: { id: string; createdBy: string }) => boolean;
}

const DataContext = createContext<DataContextType>(null!);

const SK_MY_ANON = 'anb-my-anonymous-ids';

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const getMyAnonIds = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem(SK_MY_ANON);
      return new Set(JSON.parse(stored || '[]'));
    } catch { return new Set(); }
  }, []);

  const addMyAnonId = useCallback((id: string) => {
    try {
      const ids = getMyAnonIds();
      ids.add(id);
      localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids]));
    } catch (e) { console.error('Error saving anon id:', e); }
  }, [getMyAnonIds]);

  const fetchData = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const [postsRes, bizRes, eventsRes, commentsRes, ratingsRes] = await Promise.all([
        supabase.from('posts').select('*, users(name, avatar_url), post_supports(count)').order('created_at', { ascending: false }),
        supabase.from('businesses').select('*, users!businesses_created_by_fkey(name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('events').select('*, users!events_created_by_fkey(name, avatar_url), event_attendance(count)').order('created_at', { ascending: false }),
        supabase.from('comments').select('*, users(name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('business_ratings').select('business_id, stars')
      ]);

      if (postsRes.data) {
        setPosts(postsRes.data.map(p => ({
          id: p.id,
          authorId: p.author_id || 'anonymous',
          authorName: p.is_anonymous ? 'Denúncia Anônima' : (p.users?.name || 'Morador'),
          authorAvatarUrl: p.is_anonymous ? undefined : (p.users?.avatar_url),
          category: p.category, status: p.status, title: p.title,
          description: p.description, imageUrl: p.image_url, location: p.location,
          latitude: p.latitude, longitude: p.longitude,
          supports: p.post_supports?.[0]?.count ?? 0,
          commentsCount: p.comments_count ?? 0,
          createdAt: p.created_at, updatedAt: p.updated_at
        })));
      }

      const ratingsByBiz: Record<string, { total: number; sum: number }> = {};
      if (ratingsRes.data) {
        ratingsRes.data.forEach(r => {
          const entry = ratingsByBiz[r.business_id] ||= { total: 0, sum: 0 };
          entry.total++;
          entry.sum += r.stars;
        });
      }

      if (user) {
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*, users:actor_id(name, avatar_url), posts:post_id(title), comments:comment_id(content)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (notifData) {
          setNotifications(notifData.map(n => ({
            id: n.id, userId: n.user_id, actorId: n.actor_id,
            actorName: n.users?.name || 'Alguém',
            actorAvatarUrl: n.users?.avatar_url,
            type: n.type as 'support' | 'comment', postId: n.post_id,
            postTitle: n.posts?.title,
            content: n.comments?.content,
            isRead: n.is_read, createdAt: n.created_at
          })));
        }
      }

      if (bizRes.data) {
        setBusinesses(bizRes.data.map(b => ({
          id: b.id, name: b.name, description: b.description, category: b.category,
          phone: b.phone, whatsapp: b.whatsapp, address: b.address,
          latitude: b.latitude, longitude: b.longitude, imageUrl: b.image_url,
          open_time: b.open_time, close_time: b.close_time,
          createdBy: b.created_by,
          createdByName: b.users?.name || 'Morador',
          createdAt: b.created_at,
          avgRating: ratingsByBiz[b.id] ? ratingsByBiz[b.id].sum / ratingsByBiz[b.id].total : undefined,
          totalRatings: ratingsByBiz[b.id]?.total || 0
        })));
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data.map(e => ({
          id: e.id, title: e.title, description: e.description,
          date: e.event_date, location: e.location, latitude: e.latitude, longitude: e.longitude,
          type: e.type, createdBy: e.created_by,
          createdAt: e.created_at,
          attendanceCount: e.event_attendance?.[0]?.count ?? 0
        })));
      }

      if (commentsRes.data) {
        setComments(commentsRes.data.map(c => ({
          id: c.id, postId: c.post_id, authorId: c.author_id,
          authorName: c.users?.name || 'Morador',
          content: c.content, parentId: c.parent_id, createdAt: c.created_at
        })));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_supports' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (user && payload.new && payload.new.user_id === user.id) {
           fetchData();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, user]);

  const addPost = useCallback(async (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('posts').insert({
      author_id: user.id,
      category: data.category,
      title: data.title,
      description: data.description,
      image_url: data.imageUrl,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      is_anonymous: false
    });
    if (!res.error) fetchData();
    return res;
  }, [user, fetchData]);

  const addAnonymousPost = useCallback(async (data: { tipo: string; description: string; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    const { data: postData, error: postErr } = await supabase.from('posts').insert({
      author_id: null,
      category: 'seguranca',
      title: `Denúncia: ${data.tipo}`,
      description: data.description,
      image_url: data.imageUrl,
      location: data.location || 'Local Privado',
      latitude: data.latitude,
      longitude: data.longitude,
      is_anonymous: true
    }).select().single();

    if (!postErr && postData) {
      addMyAnonId(postData.id);
      fetchData();
    }
    return { error: postErr };
  }, [addMyAnonId, fetchData]);

  const addBusiness = useCallback(async (data: { name: string; description: string; category: BusinessCategory; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; openTime?: string; closeTime?: string; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('businesses').insert({
      name: data.name,
      description: data.description,
      category: data.category,
      phone: data.phone,
      whatsapp: data.whatsapp,
      address: data.address,
      image_url: data.imageUrl,
      open_time: data.openTime,
      close_time: data.closeTime,
      latitude: data.latitude,
      longitude: data.longitude,
      created_by: user.id
    });
    if (!res.error) fetchData();
    return res;
  }, [user, fetchData]);

  const addEvent = useCallback(async (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => {
    if (!user) return { error: 'Not authenticated' };
    const res = await supabase.from('events').insert({
      title: data.title,
      description: data.description,
      event_date: data.date,
      location: data.location,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      created_by: user.id
    });
    if (!res.error) fetchData();
    return res;
  }, [user, fetchData]);

  const supportPost = useCallback(async (postId: string) => {
    if (!user || processing.has(postId)) return;
    setProcessing(prev => new Set(prev).add(postId));
    try {
      const { data: existing } = await supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id);
      if (existing && existing.length > 0) {
        await supabase.from('post_supports').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_supports').insert({ post_id: postId, user_id: user.id });
      }
      fetchData();
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(postId); return next; });
    }
  }, [user, processing, fetchData]);

  const addComment = useCallback(async (postId: string, content: string, parentId?: string) => {
    if (!user) return;
    await supabase.from('comments').insert({ post_id: postId, author_id: user.id, parent_id: parentId, content });
    fetchData();
  }, [user, fetchData]);

  const deleteComment = useCallback(async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    fetchData();
  }, [fetchData]);

  const deletePost = useCallback(async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      const ids = getMyAnonIds();
      if (ids.has(postId)) {
        ids.delete(postId);
        localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids]));
      }
      fetchData();
    }
  }, [getMyAnonIds, fetchData]);

  const updatePostStatus = useCallback(async (postId: string, status: PostStatus) => {
    await supabase.from('posts').update({ status }).eq('id', postId);
    fetchData();
  }, [fetchData]);

  const markNotificationsAsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    fetchData();
  }, [user, fetchData]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    fetchData();
  }, [user, fetchData]);

  const deleteBusiness = useCallback(async (businessId: string) => {
    await supabase.from('businesses').delete().eq('id', businessId);
    fetchData();
  }, [fetchData]);

  const deleteEvent = useCallback(async (eventId: string) => {
    await supabase.from('events').delete().eq('id', eventId);
    fetchData();
  }, [fetchData]);

  const toggleAttendance = useCallback(async (eventId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('event_attendance').select('id').eq('event_id', eventId).eq('user_id', user.id);
    if (existing && existing.length > 0) {
      await supabase.from('event_attendance').delete().eq('event_id', eventId).eq('user_id', user.id);
    } else {
      await supabase.from('event_attendance').insert({ event_id: eventId, user_id: user.id });
    }
    fetchData();
  }, [user, fetchData]);

  const getEventAttendees = useCallback(async (eventId: string) => {
    const { data } = await supabase.from('event_attendance').select('*, users(name, avatar_url)').eq('event_id', eventId);
    return data || [];
  }, []);

  const addBusinessRating = useCallback(async (data: { businessId: string; stars: number; comment?: string }) => {
    if (!user) return;
    await supabase.from('business_ratings').upsert({ business_id: data.businessId, user_id: user.id, stars: data.stars, comment: data.comment }, { onConflict: 'business_id,user_id' });
    fetchData();
  }, [user, fetchData]);

  const getBusinessRatings = useCallback(async (businessId: string) => {
    const { data } = await supabase.from('business_ratings').select('*, users(name, avatar_url)').eq('business_id', businessId).order('created_at', { ascending: false });
    return data || [];
  }, []);

  const reportContent = useCallback(async (data: { postId?: string; commentId?: string; reason: string }) => {
    await supabase.from('content_reports').insert({ reporter_id: user?.id || null, post_id: data.postId, comment_id: data.commentId, reason: data.reason });
  }, [user]);

  const getAllReports = useCallback(async () => {
    const admins = ['9c90d435-bfe2-4936-98d1-2c6c1160db4b'];
    if (!user || !admins.includes(user.id)) return [];
    const { data } = await supabase.from('content_reports').select('*, reporter:reporter_id(name), post:post_id(title, description, image_url), comment:comment_id(content)').order('created_at', { ascending: false });
    return data || [];
  }, [user]);

  const updateReportStatus = useCallback(async (reportId: string, status: 'resolved' | 'ignored') => {
    const { error } = await supabase.from('content_reports').update({ status, archived_at: new Date().toISOString(), archived_by: user?.id }).eq('id', reportId);
    if (error) console.error('Erro ao atualizar denúncia:', error);
  }, [user]);

  const isMyPost = useCallback((post: { id: string; authorId: string }) => {
    if (getMyAnonIds().has(post.id)) return true;
    return user ? post.authorId === user.id : false;
  }, [user, getMyAnonIds]);

  const isMyBusiness = useCallback((business: { id: string; createdBy: string }) => user ? business.createdBy === user.id : false, [user]);
  const isMyEvent = useCallback((event: { id: string; createdBy: string }) => user ? event.createdBy === user.id : false, [user]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
  const commentsByPost = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) (map[c.postId] ??= []).push(c);
    return map;
  }, [comments]);

  const contextValue = useMemo(() => ({
    posts, businesses, events, comments, notifications, unreadCount, commentsByPost, loading, fetchData,
    addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, markNotificationsAsRead, deleteAllNotifications,
    isMyPost, isMyBusiness, isMyEvent, reportContent, getAllReports, updateReportStatus,
    addBusinessRating, getBusinessRatings, toggleAttendance, getEventAttendees
  }), [posts, businesses, events, comments, notifications, unreadCount, commentsByPost, loading,
    addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, markNotificationsAsRead, deleteAllNotifications,
    isMyPost, isMyBusiness, isMyEvent, reportContent, getAllReports, updateReportStatus,
    addBusinessRating, getBusinessRatings, toggleAttendance, getEventAttendees]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
