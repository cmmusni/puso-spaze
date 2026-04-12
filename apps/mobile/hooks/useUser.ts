// ─────────────────────────────────────────────
// hooks/useUser.ts
// Utility hook for auth actions + anon username generation
// ─────────────────────────────────────────────

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../context/UserContext';
import { generateAnonUsername } from '../utils/generateAnonUsername';
import { apiCreateUser, apiRedeemInviteCode } from '../services/api';

export function useUser() {
  const {
    userId,
    username,
    role,
    avatarUrl,
    isLoggedIn,
    loginUser,
    logoutUser,
    loadUser,
    validateDeviceOwner,
    getDeviceOwner,
    clearDeviceOwnerBinding,
    getDeviceId,
  } =
    useUserStore();

  /**
   * Login with a custom display name.
   * Creates/fetches user on the server, then persists session.
   * Validates that this username is allowed on this device.
   * 
   * ⭐ COACHES: Can use this to log back in after signing out.
   *    Their COACH role from the database is automatically restored.
   *    No need to re-enter the invite code.
   */
  const loginWithUsername = useCallback(
    async (displayName: string): Promise<void> => {
      // Validate device ownership before attempting login
      await validateDeviceOwner(displayName);

      const deviceId = Platform.OS !== 'web' ? await getDeviceId() : undefined;
      const generatedId = uuidv4();
      const { userId: serverId, displayName: serverName, role: serverRole, avatarUrl: serverAvatar } =
        await apiCreateUser({ displayName, ...(deviceId ? { deviceId } : {}), platform: Platform.OS });
      await loginUser(serverId || generatedId, serverName || displayName, serverRole ?? 'USER', serverAvatar);
    },
    [loginUser, validateDeviceOwner, getDeviceId]
  );

  /**
   * Login anonymously — tries preferredName first, then retries with new
   * generated names if taken. Returns the display name that was actually used.
   */
  const loginAnonymously = useCallback(async (preferredName?: string): Promise<string> => {
    const deviceId = Platform.OS !== 'web' ? await getDeviceId() : undefined;
    const generatedId = uuidv4();
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const anonName = attempt === 0 && preferredName ? preferredName : generateAnonUsername();
      try {
        const { userId: serverId, displayName: serverName, role: serverRole, avatarUrl: serverAvatar } =
          await apiCreateUser({ displayName: anonName, ...(deviceId ? { deviceId } : {}), platform: Platform.OS });
        await loginUser(serverId || generatedId, serverName || anonName, serverRole ?? 'USER', serverAvatar);
        return serverName || anonName;
      } catch (err: any) {
        const serverError = err?.response?.data?.error ?? err?.message ?? '';
        const isTaken =
          serverError.toLowerCase().includes('already taken') ||
          serverError.toLowerCase().includes('unique constraint');

        // If taken, loop and try a new name; otherwise fall through
        if (isTaken && attempt < MAX_ATTEMPTS - 1) continue;

        // Last attempt or non-conflict error → offline fallback
        await loginUser(generatedId, anonName, 'USER');
        return anonName;
      }
    }
    // Should never reach here, but TypeScript needs a return
    return preferredName ?? generateAnonUsername();
  }, [loginUser, getDeviceId]);

  /**
   * Login as PUSO Coach using an invite code.
   * Validates that this username is allowed on this device.
   */
  const loginAsCoach = useCallback(
    async (displayName: string, code: string): Promise<void> => {
      // Validate device ownership before attempting login
      await validateDeviceOwner(displayName);

      const deviceId = Platform.OS !== 'web' ? await getDeviceId() : undefined;
      const { userId: serverId, displayName: serverName, role: serverRole, avatarUrl: serverAvatar } =
        await apiRedeemInviteCode({ displayName, code, ...(deviceId ? { deviceId } : {}), platform: Platform.OS });
      await loginUser(serverId, serverName, serverRole, serverAvatar);
    },
    [loginUser, validateDeviceOwner, getDeviceId]
  );

  /**
   * Generate a preview anonymous username without logging in.
   */
  const previewAnonUsername = useCallback((): string => {
    return generateAnonUsername();
  }, []);

  return {
    userId,
    username,
    role,
    avatarUrl,
    isLoggedIn,
    loginWithUsername,
    loginAnonymously,
    loginAsCoach,
    logoutUser,
    loadUser,
    previewAnonUsername,
    getDeviceOwner,
    clearDeviceOwnerBinding,
  };
}
