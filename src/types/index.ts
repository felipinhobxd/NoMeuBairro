export type PostStatus = 'pending' | 'in_progress' | 'resolved';
export type PostCategory = 'buraco' | 'iluminacao' | 'fios' | 'limpeza' | 'transporte' | 'seguranca' | 'outros';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  badges: Badge[];
  reputation: number;
  postsCount: number;
  supportsReceived: number;
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  category: PostCategory;
  status: PostStatus;
  title: string;
  description: string;
  imageUrl?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  supports: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId?: string;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  category: BusinessCategory;
  phone?: string;
  whatsapp?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  createdBy: string;
  createdByName?: string;
  createdByAvatarUrl?: string;
  createdAt: string;
}

export type BusinessCategory = 'alimentacao' | 'saude' | 'servicos' | 'educacao' | 'comercio' | 'beleza' | 'outros';

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  latitude?: number;
  longitude?: number;
  type: EventType;
  createdBy: string;
  createdByName?: string;
  createdByAvatarUrl?: string;
  createdAt: string;
}

export type EventType = 'feira' | 'saude' | 'reuniao' | 'cultura' | 'esporte' | 'campanha' | 'outros';
