export type PostStatus = 'pending' | 'in_progress' | 'resolved';
export type OfficialProtocolStatus = 'submitted' | 'in_progress' | 'resolved';
export type PostCategory = 'buraco' | 'iluminacao' | 'fios' | 'saneamento' | 'limpeza' | 'transporte' | 'seguranca' | 'outros';
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

interface Badge {
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
  officialAgency?: string;
  officialProtocol?: string;
  officialStatus?: OfficialProtocolStatus;
  officialContactedAt?: string;
  supports: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SimilarPost {
  id: string;
  title: string;
  description: string;
  status: PostStatus;
  location: string;
  neighborhood?: string;
  locality?: string;
  latitude: number;
  longitude: number;
  distanceM: number;
  createdAt: string;
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

export type EventType = 'feira' | 'saude' | 'reuniao' | 'cultura' | 'esporte' | 'campanha' | 'outros';

type AppNotificationType =
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
