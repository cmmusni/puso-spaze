// ─────────────────────────────────────────────
// Shared TypeScript types for PUSO Spaze
// Used by both the mobile app and server
// ─────────────────────────────────────────────

export type ModerationStatus = 'SAFE' | 'FLAGGED' | 'REVIEW';

export type ReactionType = 'PRAY' | 'CARE' | 'SUPPORT';

export type UserRole = 'USER' | 'COACH' | 'ADMIN';

export type NotificationType = 'REACTION' | 'COMMENT' | 'ENCOURAGEMENT' | 'SYSTEM';

export const REACTION_EMOJI: Record<ReactionType, string> = {
  PRAY:  '🙇',
  CARE: '❤️‍🩹',
  SUPPORT:  '🫶',
};

export interface User {
  id: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
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
  user?: Pick<User, 'displayName' | 'role'>;
  createdAt: string;
  moderationStatus: ModerationStatus;
  tags?: string[];
  pinned?: boolean;
  commentCount?: number;
  reactionCount?: number;
  latestComment?: {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    user?: Pick<User, 'displayName' | 'role'>;
  };
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  moderationStatus?: ModerationStatus;
  user?: Pick<User, 'displayName' | 'role'>;
  post?: Pick<Post, 'id' | 'content'>;
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

export interface ReactionCounts {
  PRAY?: number;
  CARE?: number;
  SUPPORT?: number;
}

// ── API shapes ────────────────────────────────
export interface CreateUserRequest { displayName: string; deviceId?: string; }
export interface CreateUserResponse { userId: string; displayName: string; role: UserRole; }

export interface CreatePostRequest { userId: string; content: string; tags?: string[]; }
export interface CreatePostResponse { post: Post; flagged: boolean; underReview: boolean; }
export interface UpdatePostRequest { userId: string; content: string; tags?: string[]; }
export interface UpdatePostResponse { post: Post; flagged: boolean; underReview: boolean; }
export interface GetPostsResponse { posts: Post[]; }

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

export interface CreateCommentRequest { userId: string; content: string; }
export interface CreateCommentResponse { comment: Comment; flagged: boolean; underReview: boolean; }
export interface UpdateCommentRequest { userId: string; content: string; }
export interface UpdateCommentResponse { comment: Comment; flagged: boolean; underReview: boolean; }
export interface GetCommentsResponse { comments: Comment[]; }
export interface SearchUsersResponse { users: MentionUser[]; }

// Auth / session
export interface UserSession { userId: string; username: string; role: UserRole; isLoggedIn: boolean; }

// Coach / Admin
export interface RedeemInviteRequest { displayName: string; code: string; deviceId?: string; }
export interface RedeemInviteResponse { userId: string; displayName: string; role: UserRole; }

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
