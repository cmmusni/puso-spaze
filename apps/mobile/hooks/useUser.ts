// ─────────────────────────────────────────────
// hooks/useUser.ts
// Utility hook for auth actions + anon username generation
// ─────────────────────────────────────────────

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../context/UserContext';
import { generateAnonUsername } from '../utils/generateAnonUsername';
import { apiCreateUser, apiRedeemInviteCode } from '../services/api';

export function useUser() {
  const {
    userId,
    username,
    role,
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

      const deviceId = await getDeviceId();
      const generatedId = uuidv4();
      const { userId: serverId, displayName: serverName, role: serverRole } =
        await apiCreateUser({ displayName, deviceId });
      await loginUser(serverId || generatedId, serverName || displayName, serverRole ?? 'USER');
    },
    [loginUser, validateDeviceOwner, getDeviceId]
  );

  /**
   * Login anonymously — generates a username locally, registers on server.
   */
  const loginAnonymously = useCallback(async (): Promise<void> => {
    const anonName = generateAnonUsername();
    const deviceId = await getDeviceId();
    const generatedId = uuidv4();
    try {
      const { userId: serverId, displayName: serverName, role: serverRole } =
        await apiCreateUser({ displayName: anonName, deviceId });
      await loginUser(serverId || generatedId, serverName || anonName, serverRole ?? 'USER');
    } catch {
      // Offline fallback — still allow local login
      await loginUser(generatedId, anonName, 'USER');
    }
  }, [loginUser, getDeviceId]);

  /**
   * Login as PUSO Coach using an invite code.
   * Validates that this username is allowed on this device.
   */
  const loginAsCoach = useCallback(
    async (displayName: string, code: string): Promise<void> => {
      // Validate device ownership before attempting login
      await validateDeviceOwner(displayName);

      const deviceId = await getDeviceId();
      const { userId: serverId, displayName: serverName, role: serverRole } =
        await apiRedeemInviteCode({ displayName, code, deviceId });
      await loginUser(serverId, serverName, serverRole);
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
