// ─────────────────────────────────────────────
// Shared TypeScript types for PUSO Spaze
// Used by both the mobile app and server
// ─────────────────────────────────────────────

export type ModerationStatus = 'SAFE' | 'FLAGGED' | 'REVIEW';

export type ReactionType = 'PRAY' | 'CARE' | 'SUPPORT' | 'LIKE';

export type UserRole = 'USER' | 'COACH' | 'ADMIN';

export type NotificationType = 'REACTION' | 'COMMENT' | 'ENCOURAGEMENT' | 'SYSTEM' | 'MESSAGE';

export const REACTION_EMOJI: Record<ReactionType, string> = {
  PRAY:  '🙇',
  CARE: '❤️‍🩹',
  SUPPORT:  '🫶',
};

export interface ContactInfo {
  phone?: string | null;
  contactEmail?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
}

export interface User {
  id: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  isAnonymous?: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
}

export interface MentionUser {
  id: string;
  displayName: string;
  role: UserRole;
  mentionHandle: string;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string | null;
  userId: string;
  user?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
  createdAt: string;
  moderationStatus: ModerationStatus;
  tags?: string[];
  pinned?: boolean;
  isAnonymous?: boolean;
  anonDisplayName?: string | null;
  commentCount?: number;
  reactionCount?: number;
  latestComment?: {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    isAnonymous?: boolean;
    anonDisplayName?: string | null;
    user?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
  };
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  moderationStatus?: ModerationStatus;
  isAnonymous?: boolean;
  anonDisplayName?: string | null;
  user?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
  post?: Pick<Post, 'id' | 'content'>;
  parentId?: string | null;
  replies?: Comment[];
  reactionCounts?: ReactionCounts;
  userReaction?: ReactionType | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  used: boolean;
  usedBy?: string | null;
  createdAt: string;
  usedAt?: string | null;
}

export interface Journal {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: string | null;
  tags?: string[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
}

export interface ReactionCounts {
  PRAY?: number;
  CARE?: number;
  SUPPORT?: number;
  LIKE?: number;
}

// ── API shapes ────────────────────────────────
export interface CreateUserRequest { displayName: string; deviceId?: string; platform?: string; pin?: string; }
export interface CreateUserResponse { userId: string; displayName: string; role: UserRole; avatarUrl?: string | null; pin?: string | null; token?: string; }

export interface CreatePostRequest { userId: string; content: string; tags?: string[]; isAnonymous?: boolean; }
export interface CreatePostResponse { post: Post; flagged: boolean; underReview: boolean; }
export interface UpdatePostRequest { userId: string; content: string; tags?: string[]; }
export interface UpdatePostResponse { post: Post; flagged: boolean; underReview: boolean; }
export interface GetPostsResponse { posts: Post[]; nextCursor: string | null; }

export interface UpsertReactionRequest { userId: string; type: ReactionType; }
export interface UpsertReactionResponse {
  removed: boolean;
  type?: ReactionType;
  reaction?: { id: string; type: ReactionType };
}
export interface GetReactionsResponse {
  counts: ReactionCounts;
  userReaction: ReactionType | null;
}

export interface CreateCommentRequest { userId: string; content: string; parentId?: string; }
export interface CreateCommentResponse { comment: Comment; flagged: boolean; underReview: boolean; }
export interface UpdateCommentRequest { userId: string; content: string; }
export interface UpdateCommentResponse { comment: Comment; flagged: boolean; underReview: boolean; }
export interface GetCommentsResponse { comments: Comment[]; }
export interface SearchUsersResponse { users: MentionUser[]; }

// Auth / session
export interface UserSession { userId: string; username: string; role: UserRole; isLoggedIn: boolean; }

// Coach / Admin
export interface RedeemInviteRequest { displayName: string; code: string; deviceId?: string; platform?: string; email?: string; }
export interface RedeemInviteResponse { userId: string; displayName: string; role: UserRole; avatarUrl?: string | null; token?: string; }

export interface ReviewQueue { posts: Post[]; comments: Comment[]; }
export interface GetReviewQueueResponse { posts: Post[]; comments: Comment[]; }

export interface ModerateRequest { coachId: string; action: 'approve' | 'reject'; }
export interface ModeratePostResponse { post: Post; action: string; }
export interface ModerateCommentResponse { comment: Comment; action: string; }

export interface GenerateInviteCodesRequest { count?: number; }
export interface GenerateInviteCodesResponse { codes: string[]; }
export interface ListInviteCodesResponse { codes: InviteCode[]; }
export interface SendInviteByEmailRequest { email: string; adminSecret: string; }
export interface SendInviteByEmailResponse { code: string; email: string; }

// Notifications
export interface GetNotificationsResponse { notifications: Notification[]; }
export interface GetUnreadCountResponse { count: number; }
export interface RegisterPushTokenRequest { userId: string; expoPushToken: string; }
export interface RegisterPushTokenResponse { success: boolean; }
export interface MarkNotificationReadRequest { userId: string; }
export interface MarkNotificationReadResponse { notification: Notification; }
export interface MarkAllNotificationsReadRequest { userId: string; }
export interface MarkAllNotificationsReadResponse { success: boolean; }

// Journal
export interface CreateJournalRequest { userId: string; title: string; content: string; mood?: string; tags?: string[]; isPublic?: boolean; }
export interface CreateJournalResponse { journal: Journal; }
export interface UpdateJournalRequest { userId: string; title: string; content: string; mood?: string; tags?: string[]; isPublic?: boolean; }
export interface UpdateJournalResponse { journal: Journal; }
export interface GetJournalsResponse { journals: Journal[]; }
export interface GetJournalResponse { journal: Journal; }

// Conversation / Messaging
export interface Conversation {
  id: string;
  userId: string;
  coachId: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
  coach?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
  lastMessage?: Message | null;
  unreadCount?: number;
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: Pick<User, 'displayName' | 'role' | 'avatarUrl'>;
}

export interface CoachProfile {
  id: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface GetCoachesResponse { coaches: CoachProfile[]; }
export interface GetConversationsResponse { conversations: Conversation[]; }
export interface GetOrCreateConversationRequest { userId: string; coachId: string; }
export interface GetOrCreateConversationResponse { conversation: Conversation; }
export interface GetMessagesResponse { messages: Message[]; }
export interface SendMessageRequest { senderId: string; content: string; }
export interface SendMessageResponse { message: Message; }

// Recovery Requests
export interface RecoveryRequest {
  id: string;
  displayName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  userHistory?: {
    posts: { content: string; createdAt: string; tags: string[] }[];
    journals: { title: string; mood: string | null; createdAt: string }[];
    accountAge: string | null;
  };
}
export interface SubmitRecoveryRequest { displayName: string; reason: string; }
export interface SubmitRecoveryResponse { id: string; status: string; }
export interface GetRecoveryRequestsResponse { requests: RecoveryRequest[]; }
export interface ReviewRecoveryRequest { coachId: string; action: 'approve' | 'deny'; }
export interface ReviewRecoveryResponse { request: RecoveryRequest; }
