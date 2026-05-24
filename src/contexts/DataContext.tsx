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
  addPost: (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<void>;
  addAnonymousPost: (data: { tipo: string; description: string; latitude?: number; longitude?: number }) => Promise<void>;
  addBusiness: (data: { name: string; description: string; category: BusinessCategory; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; latitude?: number; longitude?: number }) => Promise<void>;
  addEvent: (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => Promise<void>;
  supportPost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  updatePostStatus: (postId: string, status: PostStatus) => Promise<void>;
  deleteBusiness: (businessId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
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
    try {
      // Busca básica que SEMPRE deve funcionar
      const [postsRes, bizRes, eventsRes, commentsRes] = await Promise.all([
        supabase.from('posts').select('*, users(name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('businesses').select('*, users!businesses_created_by_fkey(name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('events').select('*, users!events_created_by_fkey(name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('comments').select('*, users(name, avatar_url)').order('created_at', { ascending: false })
      ]);

      // Busca de notificações (separada para não travar o resto se a tabela não existir)
      if (user) {
        console.log('Buscando notificações para o usuário:', user.id);
        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .select(`
            *,
            users:actor_id(name, avatar_url),
            posts:post_id(title),
            comments:comment_id(content)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (notifError) {
          console.error('Erro detalhado nas notificações:', notifError);
          // Tenta busca simples sem join se o de cima falhar
          const { data: simpleData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (simpleData) {
            setNotifications(simpleData.map(n => ({
              id: n.id, userId: n.user_id, actorId: n.actor_id,
              actorName: 'Alguém',
              type: n.type as 'support' | 'comment', postId: n.post_id,
              isRead: n.is_read, createdAt: n.created_at
            })));
          }
        } else if (notifData) {
          console.log('Notificações encontradas:', notifData.length);
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

      if (postsRes.data) {
        setPosts(postsRes.data.map(p => ({
          id: p.id,
          authorId: p.author_id || 'anonymous',
          authorName: p.is_anonymous ? 'Denúncia Anônima' : (p.users?.name || 'Morador'),
          authorAvatarUrl: p.is_anonymous ? undefined : (p.users?.avatar_url),
          category: p.category, status: p.status, title: p.title,
          description: p.description, imageUrl: p.image_url, location: p.location,
          latitude: p.latitude, longitude: p.longitude,
          supports: p.supports_count ?? 0,
          commentsCount: p.comments_count ?? 0,
          createdAt: p.created_at, updatedAt: p.updated_at
        })));
      }

      if (bizRes.data) {
        setBusinesses(bizRes.data.map(b => ({
          id: b.id, name: b.name, description: b.description, category: b.category,
          phone: b.phone, whatsapp: b.whatsapp, address: b.address,
          latitude: b.latitude, longitude: b.longitude, imageUrl: b.image_url,
          createdBy: b.created_by,
          createdByName: b.users?.name || 'Morador',
          createdByAvatarUrl: b.users?.avatar_url,
          createdAt: b.created_at
        })));
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data.map(e => ({
          id: e.id, title: e.title, description: e.description,
          date: e.event_date, location: e.location, latitude: e.latitude, longitude: e.longitude,
          type: e.type, createdBy: e.created_by,
          createdByName: e.users?.name || 'Morador',
          createdByAvatarUrl: e.users?.avatar_url,
          createdAt: e.created_at
        })));
      }

      if (commentsRes.data) {
        setComments(commentsRes.data.map(c => ({
          id: c.id, postId: c.post_id, authorId: c.author_id,
          authorName: c.users?.name || 'Morador',
          authorAvatarUrl: c.users?.avatar_url,
          content: c.content, parentId: c.parent_id, createdAt: c.created_at
        })));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    console.log('Iniciando subscrição em tempo real...');
    const channel = supabase.channel('db-final-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        console.log('Mudança em posts:', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        console.log('Mudança em comments:', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_supports' }, (payload) => {
        console.log('Mudança em supports:', payload);
        fetchData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        console.log('NOVA NOTIFICAÇÃO RECEBIDA:', payload);
        fetchData();
      })
      .subscribe((status) => {
        console.log('Status da subscrição:', status);
      });
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const addPost = useCallback(async (data: { title: string; description: string; category: PostCategory; location: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    if (!user) return;
    await supabase.from('posts').insert({
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
  }, [user]);

  const addAnonymousPost = useCallback(async (data: { tipo: string; description: string; latitude?: number; longitude?: number }) => {
    const authorId = user?.id || null;
    const { data: postData, error: postErr } = await supabase.from('posts').insert({
      author_id: authorId,
      category: 'seguranca',
      title: data.tipo,
      description: data.description,
      location: 'Local Protegido',
      latitude: data.latitude,
      longitude: data.longitude,
      is_anonymous: true
    }).select().single();

    if (postErr || !postData) return;
    addMyAnonId(postData.id);

    await supabase.from('anonymous_reports').insert({
      report_type: 'outros',
      encrypted_content: Uint8Array.from(atob(btoa(data.description)), c => c.charCodeAt(0)),
      content_hash: 'sha256-mock',
      post_id: postData.id
    });
  }, [user, addMyAnonId]);

  const addBusiness = useCallback(async (data: { name: string; description: string; category: BusinessCategory; phone?: string; whatsapp?: string; address?: string; imageUrl?: string; latitude?: number; longitude?: number }) => {
    if (!user) return;
    await supabase.from('businesses').insert({
      name: data.name,
      description: data.description,
      category: data.category,
      phone: data.phone,
      whatsapp: data.whatsapp,
      address: data.address,
      image_url: data.imageUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      created_by: user.id
    });
  }, [user]);

  const addEvent = useCallback(async (data: { title: string; description: string; date: string; location: string; type: EventType; latitude?: number; longitude?: number }) => {
    if (!user) return;
    await supabase.from('events').insert({
      title: data.title,
      description: data.description,
      event_date: data.date,
      location: data.location,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      created_by: user.id
    });
  }, [user]);

  const supportPost = useCallback(async (postId: string) => {
    if (!user || processing.has(postId)) return;

    setProcessing(prev => new Set(prev).add(postId));

    try {
      // 1. Check existing in DB
      const { data: existing } = await supabase
        .from('post_supports')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (existing && existing.length > 0) {
        // 2. UNLIKE: Delete ALL records for this post/user (cleans duplicates too)
        await supabase
          .from('post_supports')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        // 3. LIKE
        await supabase.from('post_supports').insert({ post_id: postId, user_id: user.id });
      }

      fetchData(); // Sincroniza contagens
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }, [user, processing, fetchData]);

  const addComment = useCallback(async (postId: string, content: string, parentId?: string) => {
    if (!user) return;
    await supabase.from('comments').insert({
      post_id: postId,
      author_id: user.id,
      parent_id: parentId,
      content: content
    });
  }, [user]);

  const deleteComment = useCallback(async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    const ids = getMyAnonIds();
    if (ids.has(postId)) {
      ids.delete(postId);
      localStorage.setItem(SK_MY_ANON, JSON.stringify([...ids]));
    }
  }, [getMyAnonIds]);

  const updatePostStatus = useCallback(async (postId: string, status: PostStatus) => {
    await supabase.from('posts').update({ status }).eq('id', postId);
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    fetchData();
  }, [user, fetchData]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    fetchData();
  }, [user, fetchData]);

  const deleteBusiness = useCallback(async (businessId: string) => {
    await supabase.from('businesses').delete().eq('id', businessId);
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    await supabase.from('events').delete().eq('id', eventId);
  }, []);

  const isMyPost = useCallback((post: { id: string; authorId: string }) => {
    if (getMyAnonIds().has(post.id)) return true;
    return user ? post.authorId === user.id : false;
  }, [user, getMyAnonIds]);

  const isMyBusiness = useCallback((business: { id: string; createdBy: string }) => {
    return user ? business.createdBy === user.id : false;
  }, [user]);

  const isMyEvent = useCallback((event: { id: string; createdBy: string }) => {
    return user ? event.createdBy === user.id : false;
  }, [user]);

  const commentsByPost = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      (map[c.postId] ??= []).push(c);
    }
    return map;
  }, [comments]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const contextValue = useMemo(() => ({
    posts, businesses, events, comments, notifications, unreadCount, commentsByPost, loading,
    addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, markNotificationsAsRead, deleteAllNotifications,
    isMyPost, isMyBusiness, isMyEvent,
  }), [posts, businesses, events, comments, notifications, unreadCount, commentsByPost, loading,
    addPost, addAnonymousPost, addBusiness, addEvent, supportPost, addComment, deleteComment,
    deletePost, updatePostStatus, deleteBusiness, deleteEvent, markNotificationsAsRead, deleteAllNotifications,
    isMyPost, isMyBusiness, isMyEvent]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
