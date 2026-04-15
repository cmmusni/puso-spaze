// ─────────────────────────────────────────────
// services/api.ts
// Centralised HTTP client for PUSO Spaze backend
// Base URL reads from app.json extra.apiUrl or env
// ─────────────────────────────────────────────

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  Post,
  Journal,
  CreateUserRequest,
  CreateUserResponse,
  CreatePostRequest,
  CreatePostResponse,
  UpdatePostRequest,
  UpdatePostResponse,
  GetPostsResponse,
  UpsertReactionRequest,
  UpsertReactionResponse,
  GetReactionsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
  GetCommentsResponse,
  RedeemInviteRequest,
  RedeemInviteResponse,
  GetReviewQueueResponse,
  ModerateRequest,
  ModeratePostResponse,
  ModerateCommentResponse,
  SendInviteByEmailResponse,
  GenerateInviteCodesResponse,
  ListInviteCodesResponse,
  GetNotificationsResponse,
  GetUnreadCountResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadRequest,
  MarkAllNotificationsReadResponse,
  SearchUsersResponse,
  CreateJournalRequest,
  CreateJournalResponse,
  UpdateJournalRequest,
  UpdateJournalResponse,
  GetJournalsResponse,
  GetJournalResponse,
  GetCoachesResponse,
  GetConversationsResponse,
  GetOrCreateConversationRequest,
  GetOrCreateConversationResponse,
  GetMessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  SubmitRecoveryResponse,
  GetRecoveryRequestsResponse,
  ReviewRecoveryResponse,
} from '../../../packages/types';

// ── Base URL ─────────────────────────────────
// Reads from app.json → extra.apiUrl. In release builds (EAS preview/production)
// falls back to the production URL. In dev builds falls back to localhost.
const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  (__DEV__ ? 'http://localhost:4000' : 'https://api.puso-spaze.org');

console.log('[API] Base URL:', BASE_URL);

export function getBaseUrl(): string {
  return BASE_URL;
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── JWT token management ─────────────────────
// Token is stored in memory and persisted via UserContext.
// Set by loginUser, cleared by logoutUser.
let _authToken: string | null = null;

/** Set the JWT token for all subsequent API calls. */
export function setAuthToken(token: string | null): void {
  _authToken = token;
}

/** Get the current JWT token (used by upload functions that bypass axios). */
export function getAuthToken(): string | null {
  return _authToken;
}

// ── Session invalidation callback ────────────
// Called when the server returns 404 "User not found" — means the stored
// userId no longer exists in the database (e.g. DB was reset). UserContext
// registers this callback on load to trigger auto-logout.
let _onSessionInvalid: (() => void) | null = null;

/** Register a callback that fires when the server says the user no longer exists. */
export function onSessionInvalid(cb: (() => void) | null): void {
  _onSessionInvalid = cb;
}

// ── Interceptor: attach JWT to all requests ──
client.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

// ── Interceptor: log errors in dev, handle 401/404 ──
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (__DEV__) {
      console.error('[API Error]', error?.response?.data ?? error.message);
    }
    if (error?.response?.status === 401) {
      // Token expired or invalid — clear it so the app can prompt re-login
      _authToken = null;
    }
    // Detect stale session: server says user no longer exists
    if (
      error?.response?.status === 404 &&
      typeof error?.response?.data?.error === 'string' &&
      error.response.data.error.toLowerCase().includes('user not found') &&
      _authToken // Only trigger if we think we're logged in
    ) {
      console.warn('[API] Session invalid — user not found on server. Forcing logout.');
      _authToken = null;
      _onSessionInvalid?.();
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

/**
 * GET /api/users/search?q=...&limit=...
 * Returns users for @mention autocomplete.
 */
export async function apiSearchUsers(
  q: string,
  limit = 8
): Promise<SearchUsersResponse> {
  const { data } = await client.get<SearchUsersResponse>('/api/users/search', {
    params: { q, limit },
  });
  return data;
}

/**
 * PATCH /api/users/:userId/anonymous
 * Toggles anonymous mode for the user.
 */
export async function apiToggleAnonymous(
  userId: string,
  isAnonymous: boolean
): Promise<{ success: boolean; isAnonymous: boolean }> {
  const { data } = await client.patch(`/api/users/${userId}/anonymous`, {
    isAnonymous,
  });
  return data;
}

/**
 * PATCH /api/users/:userId/notifications
 * Toggles daily reflection reminder notifications.
 */
export async function apiToggleNotifications(
  userId: string,
  enabled: boolean
): Promise<{ success: boolean; notificationsEnabled: boolean }> {
  const { data } = await client.patch(`/api/users/${userId}/notifications`, {
    enabled,
  });
  return data;
}

/**
 * POST /api/users/:userId/avatar
 * Uploads a profile avatar image via multipart form data.
 * Returns { avatarUrl: string }
 */
export async function apiUploadAvatar(
  userId: string,
  imageUri: string
): Promise<{ avatarUrl: string }> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[blob.type] ?? 'jpg';
    formData.append('image', blob, `avatar.${ext}`);
  } else {
    const uriParts = imageUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';
    formData.append('image', {
      uri: imageUri,
      name: `avatar.${ext}`,
      type: mimeType,
    } as any);
  }

  const response = await fetch(`${BASE_URL}/api/users/${userId}/avatar`, {
    method: 'POST',
    body: formData,
    headers: _authToken ? { Authorization: `Bearer ${_authToken}` } : undefined,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to upload avatar');
  }
  return response.json();
}

/**
 * GET /api/users/:userId/pin
 * Returns the user's current PIN code.
 */
export async function apiGetPin(
  userId: string
): Promise<{ pin: string | null }> {
  const { data } = await client.get(`/api/users/${userId}/pin`);
  return data;
}

/**
 * GET /api/users/:userId/stats
 * Returns profile stats (encouragementsGiven).
 */
export async function apiGetUserStats(
  userId: string
): Promise<{ encouragementsGiven: number; totalReflections: number; streak: number }> {
  const { data } = await client.get(`/api/users/${userId}/stats`);
  return data;
}

/**
 * PATCH /api/users/:userId/pin
 * Updates the user's PIN code.
 */
export async function apiUpdatePin(
  userId: string,
  pin: string
): Promise<{ success: boolean; pin: string }> {
  const { data } = await client.patch(`/api/users/${userId}/pin`, { pin });
  return data;
}

// ── Post endpoints ───────────────────────────

/**
 * GET /api/posts
 * Returns all SAFE-moderated posts. Optional search query.
 */
export async function apiFetchPosts(query?: string, cursor?: string): Promise<GetPostsResponse> {
  const params: Record<string, string> = {};
  if (query) params.q = query;
  if (cursor) params.cursor = cursor;
  const { data } = await client.get<GetPostsResponse>('/api/posts', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
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
 * Supports optional image upload via multipart form data.
 * Returns { post, flagged }.
 */
export async function apiCreatePost(
  body: CreatePostRequest & { imageUri?: string }
): Promise<CreatePostResponse> {
  if (body.imageUri) {
    const formData = new FormData();
    formData.append('userId', body.userId);
    formData.append('content', body.content);
    if (body.tags) {
      formData.append('tags', JSON.stringify(body.tags));
    }
    if (body.isAnonymous !== undefined) {
      formData.append('isAnonymous', String(body.isAnonymous));
    }
    if (Platform.OS === 'web') {
      // On web, blob: URIs have no extension — derive type from blob mime
      const blob = await fetch(body.imageUri).then((r) => r.blob());
      const extFromMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
      const webExt = extFromMime[blob.type] ?? 'jpg';
      formData.append('image', blob, `photo.${webExt}`);
    } else {
      // On native, parse extension from file URI
      const uriParts = body.imageUri.split('.');
      const ext = uriParts[uriParts.length - 1]?.toLowerCase() ?? 'jpg';
      const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      const mimeType = mimeMap[ext] ?? 'image/jpeg';
      formData.append('image', {
        uri: body.imageUri,
        name: `photo.${ext}`,
        type: mimeType,
      } as any);
    }

    const response = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      body: formData,
      headers: _authToken ? { Authorization: `Bearer ${_authToken}` } : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? 'Failed to create post');
    }
    return response.json();
  }
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

export async function apiUpdatePost(
  postId: string,
  body: UpdatePostRequest
): Promise<UpdatePostResponse> {
  const { data } = await client.patch<UpdatePostResponse>(
    `/api/posts/${postId}`,
    body
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
 * GET /api/posts/:postId/comments?userId=...
 * Returns all comments for a post, oldest first.
 */
export async function apiGetComments(postId: string, userId?: string): Promise<GetCommentsResponse> {
  const { data } = await client.get<GetCommentsResponse>(
    `/api/posts/${postId}/comments`,
    { params: userId ? { userId } : undefined }
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

/**
 * DELETE /api/posts/:postId/comments/:commentId
 * Deletes a comment owned by the requesting user, or any comment if requester is admin.
 */
export async function apiDeleteComment(
  postId: string,
  commentId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await client.delete<{ success: boolean; message: string }>(
    `/api/posts/${postId}/comments/${commentId}`,
    {
      data: { userId },
      params: { userId },
    }
  );
  return data;
}

export async function apiUpdateComment(
  postId: string,
  commentId: string,
  body: UpdateCommentRequest
): Promise<UpdateCommentResponse> {
  const { data } = await client.patch<UpdateCommentResponse>(
    `/api/posts/${postId}/comments/${commentId}`,
    body
  );
  return data;
}

/**
 * POST /api/posts/:postId/comments/:commentId/reactions
 * Toggle a reaction on a comment.
 */
export async function apiUpsertCommentReaction(
  postId: string,
  commentId: string,
  body: UpsertReactionRequest
): Promise<UpsertReactionResponse> {
  const { data } = await client.post<UpsertReactionResponse>(
    `/api/posts/${postId}/comments/${commentId}/reactions`,
    body
  );
  return data;
}

// ── Coach / Auth endpoints ───────────────────

/**
 * GET /api/auth/invite-email?code=...
 * Returns the email associated with an unused invite code.
 */
export async function apiGetInviteEmail(
  code: string
): Promise<{ email: string | null }> {
  const { data } = await client.get<{ email: string | null }>(
    '/api/auth/invite-email',
    { params: { code } }
  );
  return data;
}

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

// ── Admin invite management (JWT-authenticated) ──

/**
 * GET /api/admin/my/invite-codes
 * Lists all invite codes. Requires ADMIN role (JWT auth).
 */
export async function apiAdminListInviteCodes(): Promise<ListInviteCodesResponse> {
  const { data } = await client.get<ListInviteCodesResponse>('/api/admin/my/invite-codes');
  return data;
}

/**
 * POST /api/admin/my/invite-codes
 * Generates new invite codes. Requires ADMIN role (JWT auth).
 */
export async function apiAdminGenerateInviteCodes(
  count: number = 1
): Promise<GenerateInviteCodesResponse> {
  const { data } = await client.post<GenerateInviteCodesResponse>(
    '/api/admin/my/invite-codes',
    { count }
  );
  return data;
}

/**
 * POST /api/admin/my/invite-codes/send-email
 * Generates and emails an invite code. Requires ADMIN role (JWT auth).
 */
export async function apiAdminSendInviteByEmail(
  email: string
): Promise<SendInviteByEmailResponse> {
  const { data } = await client.post<SendInviteByEmailResponse>(
    '/api/admin/my/invite-codes/send-email',
    { email }
  );
  return data;
}

/**
 * GET /api/admin/hourly-hope/status
 * Reads whether Hourly Hope is currently enabled.
 */
export async function apiGetHourlyHopeStatus(
  adminSecret: string
): Promise<{ postingEnabled: boolean; visible: boolean }> {
  const { data } = await client.get<{ postingEnabled: boolean; visible: boolean }>(
    '/api/admin/hourly-hope/status',
    { headers: { Authorization: `Bearer ${adminSecret}` } }
  );
  return data;
}

/**
 * PATCH /api/admin/hourly-hope/status
 * Updates whether Hourly Hope is enabled.
 */
export async function apiSetHourlyHopeStatus(
  body: { postingEnabled?: boolean; visible?: boolean },
  adminSecret: string
): Promise<{ postingEnabled: boolean; visible: boolean }> {
  const { data } = await client.patch<{ postingEnabled: boolean; visible: boolean }>(
    '/api/admin/hourly-hope/status',
    body,
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
 * GET /api/notifications/vapid-public-key
 * Get the VAPID public key for Web Push subscription
 */
export async function apiGetVapidPublicKey(): Promise<{ publicKey: string }> {
  const { data } = await client.get<{ publicKey: string }>(
    '/api/notifications/vapid-public-key'
  );
  return data;
}

/**
 * POST /api/notifications/register-web-push
 * Register a Web Push subscription for the current user
 */
export async function apiRegisterWebPushSubscription(body: {
  userId: string;
  subscription: PushSubscriptionJSON;
}): Promise<{ success: boolean }> {
  const { data } = await client.post<{ success: boolean }>(
    '/api/notifications/register-web-push',
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

// ── Stats ─────────────────────────────────────

/**
 * GET /api/stats/online
 * Returns count of users active in the last 15 minutes
 */
export async function apiGetOnlineCount(): Promise<number> {
  try {
    const { data } = await client.get<{ online: number }>('/api/stats/online');
    return data.online;
  } catch {
    return 0;
  }
}

/**
 * GET /api/users/check?username=<name>
 * Returns true if the username is available (not yet registered).
 */
export async function apiCheckUsername(username: string): Promise<boolean> {
  try {
    const { data } = await client.get<{ available: boolean }>('/api/users/check', {
      params: { username },
    });
    return data.available;
  } catch {
    // On network error, assume available so login isn't blocked
    return true;
  }
}


export interface DashboardStats {
  totalMembers: number;
  dailyStories: number;
  onlineCount: number;
  trendingTags: { tag: string; count: number }[];
  dailyReflection: { id: string; content: string; createdAt: string } | null;
}

export async function apiGetDashboardStats(userId?: string): Promise<DashboardStats> {
  try {
    const { data } = await client.get<DashboardStats>('/api/stats/dashboard', {
      params: userId ? { userId } : undefined,
    });
    return data;
  } catch {
    return { totalMembers: 0, dailyStories: 0, onlineCount: 0, trendingTags: [], dailyReflection: null };
  }
}

// ── Journal endpoints ─────────────────────────

/**
 * GET /api/journals?userId=...
 * Returns all journal entries for the user, newest first.
 */
export async function apiFetchJournals(userId: string): Promise<GetJournalsResponse> {
  const { data } = await client.get<GetJournalsResponse>('/api/journals', {
    params: { userId },
  });
  return data;
}

/**
 * GET /api/journals/:journalId?userId=...
 * Returns a single journal entry.
 */
export async function apiGetJournalById(
  journalId: string,
  userId: string
): Promise<GetJournalResponse> {
  const { data } = await client.get<GetJournalResponse>(
    `/api/journals/${journalId}`,
    { params: { userId } }
  );
  return data;
}

/**
 * POST /api/journals
 * Creates a new journal entry.
 */
export async function apiCreateJournal(
  body: CreateJournalRequest
): Promise<CreateJournalResponse> {
  const { data } = await client.post<CreateJournalResponse>('/api/journals', body);
  return data;
}

/**
 * PATCH /api/journals/:journalId
 * Updates an existing journal entry.
 */
export async function apiUpdateJournal(
  journalId: string,
  body: UpdateJournalRequest
): Promise<UpdateJournalResponse> {
  const { data } = await client.patch<UpdateJournalResponse>(
    `/api/journals/${journalId}`,
    body
  );
  return data;
}

/**
 * DELETE /api/journals/:journalId
 * Deletes a journal entry.
 */
export async function apiDeleteJournal(
  journalId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await client.delete<{ success: boolean; message: string }>(
    `/api/journals/${journalId}`,
    { data: { userId } }
  );
  return data;
}

// ── Conversation / Messaging endpoints ────────

/**
 * GET /api/conversations/coaches
 * Returns all available coaches.
 */
export async function apiFetchCoaches(): Promise<GetCoachesResponse> {
  const { data } = await client.get<GetCoachesResponse>('/api/conversations/coaches');
  return data;
}

/**
 * GET /api/conversations?userId=...
 * Returns conversations for the user (or all, if coach).
 */
export async function apiFetchConversations(userId: string): Promise<GetConversationsResponse> {
  const { data } = await client.get<GetConversationsResponse>('/api/conversations', {
    params: { userId },
  });
  return data;
}

/**
 * GET /api/conversations/all
 * Returns all conversations with at least one message (community view).
 */
export async function apiFetchAllConversations(): Promise<GetConversationsResponse> {
  const { data } = await client.get<GetConversationsResponse>('/api/conversations/all');
  return data;
}

/**
 * POST /api/conversations
 * Get or create a conversation between user and coach.
 */
export async function apiGetOrCreateConversation(
  body: GetOrCreateConversationRequest
): Promise<GetOrCreateConversationResponse> {
  const { data } = await client.post<GetOrCreateConversationResponse>(
    '/api/conversations',
    body
  );
  return data;
}

/**
 * GET /api/conversations/:conversationId/messages?userId=...
 * Returns messages in a conversation.
 */
export async function apiFetchMessages(
  conversationId: string,
  userId: string
): Promise<GetMessagesResponse> {
  const { data } = await client.get<GetMessagesResponse>(
    `/api/conversations/${conversationId}/messages`,
    { params: { userId } }
  );
  return data;
}

/**
 * POST /api/conversations/:conversationId/messages
 * Send a message in a conversation.
 */
export async function apiSendMessage(
  conversationId: string,
  body: SendMessageRequest
): Promise<SendMessageResponse> {
  const { data } = await client.post<SendMessageResponse>(
    `/api/conversations/${conversationId}/messages`,
    body
  );
  return data;
}

/** POST /api/conversations/:id/typing — signal that userId is typing */
export async function apiSetTyping(
  conversationId: string,
  userId: string
): Promise<void> {
  await client.post(`/api/conversations/${conversationId}/typing`, { userId });
}

/** GET /api/conversations/:id/typing?userId=me — check if other participant is typing */
export async function apiGetTyping(
  conversationId: string,
  userId: string
): Promise<{ typing: boolean; typingUserId: string | null }> {
  const { data } = await client.get(
    `/api/conversations/${conversationId}/typing`,
    { params: { userId } }
  );
  return data;
}

// ── Recovery requests ────────────────────────

/** POST /api/recovery-requests — public, no auth needed */
export async function apiSubmitRecoveryRequest(
  displayName: string,
  reason: string
): Promise<SubmitRecoveryResponse> {
  const { data } = await client.post<SubmitRecoveryResponse>(
    '/api/recovery-requests',
    { displayName, reason }
  );
  return data;
}

/** GET /api/coach/recovery-requests?coachId=... — coach only */
export async function apiGetRecoveryRequests(
  coachId: string
): Promise<GetRecoveryRequestsResponse> {
  const { data } = await client.get<GetRecoveryRequestsResponse>(
    '/api/coach/recovery-requests',
    { params: { coachId } }
  );
  return data;
}

/** PATCH /api/coach/recovery-requests/:id — approve or deny */
export async function apiReviewRecovery(
  requestId: string,
  body: { coachId: string; action: 'approve' | 'deny' }
): Promise<ReviewRecoveryResponse> {
  const { data } = await client.patch<ReviewRecoveryResponse>(
    `/api/coach/recovery-requests/${requestId}`,
    body
  );
  return data;
}
