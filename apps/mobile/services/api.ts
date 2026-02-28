// ─────────────────────────────────────────────
// services/api.ts
// Centralised HTTP client for PUSO Spaze backend
// Base URL reads from app.json extra.apiUrl or env
// ─────────────────────────────────────────────

import axios from 'axios';
import Constants from 'expo-constants';
import type {
  Post,
  CreateUserRequest,
  CreateUserResponse,
  CreatePostRequest,
  CreatePostResponse,
  GetPostsResponse,
  UpsertReactionRequest,
  UpsertReactionResponse,
  GetReactionsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  GetCommentsResponse,
  RedeemInviteRequest,
  RedeemInviteResponse,
  GetReviewQueueResponse,
  ModerateRequest,
  ModeratePostResponse,
  ModerateCommentResponse,
  SendInviteByEmailResponse,
  GetNotificationsResponse,
  GetUnreadCountResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadRequest,
  MarkAllNotificationsReadResponse,
} from '../../../packages/types';

// ── Base URL ─────────────────────────────────
// Override in app.json → extra.apiUrl for production
const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:4000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor: log errors in dev ──────────
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (__DEV__) {
      console.error('[API Error]', error?.response?.data ?? error.message);
    }
    return Promise.reject(error);
  }
);

// ── User endpoints ───────────────────────────

/**
 * POST /api/users
 * Creates or fetches a user. Returns { userId, displayName }.
 */
export async function apiCreateUser(
  body: CreateUserRequest
): Promise<CreateUserResponse> {
  const { data } = await client.post<CreateUserResponse>('/api/users', body);
  return data;
}

/**
 * PATCH /api/users/:userId/username
 * Updates a user's display name.
 */
export async function apiUpdateUsername(
  userId: string,
  newUsername: string
): Promise<{ success: boolean }> {
  const { data } = await client.patch(`/api/users/${userId}/username`, {
    displayName: newUsername,
  });
  return data;
}

// ── Post endpoints ───────────────────────────

/**
 * GET /api/posts
 * Returns all SAFE-moderated posts.
 */
export async function apiFetchPosts(): Promise<GetPostsResponse> {
  const { data } = await client.get<GetPostsResponse>('/api/posts');
  return data;
}

/**
 * GET /api/posts/:postId
 * Returns a single post by ID.
 */
export async function apiGetPostById(postId: string): Promise<{ post: Post }> {
  const { data } = await client.get<{ post: Post }>(`/api/posts/${postId}`);
  return data;
}

/**
 * POST /api/posts
 * Submits a new post for AI moderation + persistence.
 * Returns { post, flagged }.
 */
export async function apiCreatePost(
  body: CreatePostRequest
): Promise<CreatePostResponse> {
  const { data } = await client.post<CreatePostResponse>('/api/posts', body);
  return data;
}

/**
 * DELETE /api/posts/:postId
 * Deletes a post. Users can delete their own posts, admins can delete any post.
 */
export async function apiDeletePost(
  postId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await client.delete<{ success: boolean; message: string }>(
    `/api/posts/${postId}`,
    { data: { userId } }
  );
  return data;
}

/**
 * POST /api/admin/posts/:postId/pin
 * Pins a post (Admin only).
 */
export async function apiPinPost(
  postId: string,
  userId: string
): Promise<{ post: Post }> {
  const { data } = await client.post<{ post: Post }>(
    `/api/admin/posts/${postId}/pin`,
    { userId }
  );
  return data;
}

/**
 * POST /api/admin/posts/:postId/unpin
 * Unpins a post (Admin only).
 */
export async function apiUnpinPost(
  postId: string,
  userId: string
): Promise<{ post: Post }> {
  const { data } = await client.post<{ post: Post }>(
    `/api/admin/posts/${postId}/unpin`,
    { userId }
  );
  return data;
}

// ── Reaction endpoints ───────────────────────

/**
 * GET /api/posts/:postId/reactions?userId=...
 * Returns reaction counts and the current user's reaction.
 */
export async function apiGetReactions(
  postId: string,
  userId?: string
): Promise<GetReactionsResponse> {
  const { data } = await client.get<GetReactionsResponse>(
    `/api/posts/${postId}/reactions`,
    { params: userId ? { userId } : undefined }
  );
  return data;
}

/**
 * POST /api/posts/:postId/reactions
 * Toggle a reaction (same type removes, different type replaces).
 */
export async function apiUpsertReaction(
  postId: string,
  body: UpsertReactionRequest
): Promise<UpsertReactionResponse> {
  const { data } = await client.post<UpsertReactionResponse>(
    `/api/posts/${postId}/reactions`,
    body
  );
  return data;
}

// ── Comment endpoints ────────────────────────

/**
 * GET /api/posts/:postId/comments
 * Returns all comments for a post, oldest first.
 */
export async function apiGetComments(postId: string): Promise<GetCommentsResponse> {
  const { data } = await client.get<GetCommentsResponse>(
    `/api/posts/${postId}/comments`
  );
  return data;
}

/**
 * POST /api/posts/:postId/comments
 * Adds a comment to a post.
 */
export async function apiCreateComment(
  postId: string,
  body: CreateCommentRequest
): Promise<CreateCommentResponse> {
  const { data } = await client.post<CreateCommentResponse>(
    `/api/posts/${postId}/comments`,
    body
  );
  return data;
}

// ── Coach / Auth endpoints ───────────────────

/**
 * POST /api/auth/redeem-invite
 * Validates an invite code and creates a COACH account.
 */
export async function apiRedeemInviteCode(
  body: RedeemInviteRequest
): Promise<RedeemInviteResponse> {
  const { data } = await client.post<RedeemInviteResponse>(
    '/api/auth/redeem-invite',
    body
  );
  return data;
}

/**
 * GET /api/coach/review?coachId=...
 * Returns all REVIEW-status posts and comments.
 */
export async function apiGetReviewQueue(
  coachId: string
): Promise<GetReviewQueueResponse> {
  const { data } = await client.get<GetReviewQueueResponse>('/api/coach/review', {
    params: { coachId },
  });
  return data;
}

/**
 * PATCH /api/coach/posts/:id/moderate
 * Approve or reject a post.
 */
export async function apiModeratePost(
  postId: string,
  body: ModerateRequest
): Promise<ModeratePostResponse> {
  const { data } = await client.patch<ModeratePostResponse>(
    `/api/coach/posts/${postId}/moderate`,
    body
  );
  return data;
}

/**
 * PATCH /api/coach/comments/:id/moderate
 * Approve or reject a comment.
 */
export async function apiModerateComment(
  commentId: string,
  body: ModerateRequest
): Promise<ModerateCommentResponse> {
  const { data } = await client.patch<ModerateCommentResponse>(
    `/api/coach/comments/${commentId}/moderate`,
    body
  );
  return data;
}

/**
 * PATCH /api/coach/posts/:id/flag
 * Flag a post for review (Coaches/Admins only).
 */
export async function apiFlagPost(
  postId: string,
  coachId: string
): Promise<{ post: any; message: string }> {
  const { data } = await client.patch<{ post: any; message: string }>(
    `/api/coach/posts/${postId}/flag`,
    { coachId }
  );
  return data;
}

/**
 * POST /api/admin/invite-codes/send-email
 * Generates a new invite code and emails it to the provided address.
 * Requires the admin secret for authorisation.
 */
export async function apiSendInviteByEmail(
  email: string,
  adminSecret: string
): Promise<SendInviteByEmailResponse> {
  const { data } = await client.post<SendInviteByEmailResponse>(
    '/api/admin/invite-codes/send-email',
    { email },
    { headers: { Authorization: `Bearer ${adminSecret}` } }
  );
  return data;
}

// ── Notifications ────────────────────────────

/**
 * GET /api/notifications?userId=xxx
 * Get all notifications for a user
 */
export async function apiGetNotifications(
  userId: string
): Promise<GetNotificationsResponse> {
  const { data } = await client.get<GetNotificationsResponse>(
    `/api/notifications?userId=${userId}`
  );
  return data;
}

/**
 * GET /api/notifications/unread-count?userId=xxx
 * Get count of unread notifications
 */
export async function apiGetUnreadCount(
  userId: string
): Promise<GetUnreadCountResponse> {
  const { data } = await client.get<GetUnreadCountResponse>(
    `/api/notifications/unread-count?userId=${userId}`
  );
  return data;
}

/**
 * POST /api/notifications/register-token
 * Register or update a user's Expo push token
 */
export async function apiRegisterPushToken(
  body: RegisterPushTokenRequest
): Promise<RegisterPushTokenResponse> {
  const { data } = await client.post<RegisterPushTokenResponse>(
    '/api/notifications/register-token',
    body
  );
  return data;
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
export async function apiMarkNotificationRead(
  notificationId: string,
  body: MarkNotificationReadRequest
): Promise<MarkNotificationReadResponse> {
  const { data } = await client.patch<MarkNotificationReadResponse>(
    `/api/notifications/${notificationId}/read`,
    body
  );
  return data;
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for a user
 */
export async function apiMarkAllNotificationsRead(
  body: MarkAllNotificationsReadRequest
): Promise<MarkAllNotificationsReadResponse> {
  const { data } = await client.patch<MarkAllNotificationsReadResponse>(
    '/api/notifications/read-all',
    body
  );
  return data;
}
