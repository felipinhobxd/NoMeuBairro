export type PostStatus = 'pending' | 'in_progress' | 'resolved';
export type PostCategory = 'buraco' | 'iluminacao' | 'fios' | 'limpeza' | 'transporte' | 'seguranca' | 'outros';
export type AccountType = 'resident' | 'company';
export type LocationPrecision = 'exact' | 'reverse' | 'neighborhood';

export interface User {
  id: string;
  name: string;
  email: string;
  accountType?: AccountType;
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
  neighborhood?: string;
  locality?: string;
  locationPrecision?: LocationPrecision;
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

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  neighborhood?: string;
  locality?: string;
  locationPrecision?: LocationPrecision;
  latitude?: number;
  longitude?: number;
  type: EventType;
  createdBy: string;
  createdByName?: string;
  createdByAvatarUrl?: string;
  createdAt: string;
  attendanceCount?: number;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
}

export type EventType = 'feira' | 'saude' | 'reuniao' | 'cultura' | 'esporte' | 'campanha' | 'outros';

export type AppNotificationType =
  | 'support'
  | 'comment'
  | 'reply'
  | 'post_resolved'
  | 'job_interest'
  | 'application_viewed'
  | 'application_contacted'
  | 'event_attendance'
  | 'neighborhood_post'
  | 'neighborhood_event'
  | 'neighborhood_job';

export interface AppNotification {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  type: AppNotificationType;
  postId?: string;
  commentId?: string;
  jobId?: string;
  applicationId?: string;
  eventId?: string;
  postTitle?: string;
  jobTitle?: string;
  eventTitle?: string;
  content?: string;
  isRead: boolean;
  createdAt: string;
}
