// ─────────────────────────────────────────────
// context/UserContext.tsx
// Global auth state using Zustand
// Provides: userId, username, role, isLoggedIn
// Actions: loginUser, logoutUser
// ─────────────────────────────────────────────

import { Platform } from 'react-native';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type { UserRole } from '../../../packages/types';
import { apiCreateUser, apiToggleAnonymous, apiToggleNotifications } from '../services/api';

// ── Storage keys ─────────────────────────────
const USER_ID_KEY    = 'puso_user_id';
const USERNAME_KEY   = 'puso_username';
const ROLE_KEY       = 'puso_role';
const DEV_OWNER_KEY  = 'puso_device_owner'; // Device-level username binding (persistent across logouts)
const DEVICE_ID_KEY  = 'puso_device_id';    // Permanent device UUID (never cleared, sent to server)
const DEVICE_SYNCED_KEY = 'puso_device_id_synced'; // Flag: deviceId has been sent to server
const ANONYMOUS_KEY  = 'puso_anonymous';     // Anonymous mode on/off
const AVATAR_URL_KEY = 'puso_avatar_url';   // Profile picture URL
const NOTIFICATIONS_KEY = 'puso_notifications'; // Daily reflection reminders on/off

// ── Platform-aware storage helper ────────────
// expo-secure-store is native-only; fall back to AsyncStorage on web.
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// ── State & Actions interface ────────────────
export interface UserState {
  userId: string | null;
  username: string | null;
  role: UserRole | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
  notificationsEnabled: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;

  /** Load persisted session from SecureStore */
  loadUser: () => Promise<void>;

  /**
   * Validate if a username is allowed on this device.
   * Throws error if a different username is already bound to this device.
   */
  validateDeviceOwner: (username: string) => Promise<void>;

  /**
   * Login: persist userId + username + role in SecureStore, update state.
   * Also sets the device owner on first login (cannot be changed).
   * @param userId  UUID string
   * @param username  Display name (anon or custom)
   * @param role  UserRole (default USER)
   * @param avatarUrl  Profile picture URL from server (optional)
   */
  loginUser: (userId: string, username: string, role?: UserRole, avatarUrl?: string | null) => Promise<void>;

  /** Clear session from SecureStore and reset state (but keep device owner) */
  logoutUser: () => Promise<void>;

  /** Update the user's username in storage and state */
  updateUsername: (newUsername: string) => Promise<void>;

  /** Update the user's avatar URL in storage and state */
  updateAvatarUrl: (url: string) => Promise<void>;

  /** Read current device owner binding username (if any). */
  getDeviceOwner: () => Promise<string | null>;

  /** Clear device owner binding to allow a fresh account binding. */
  clearDeviceOwnerBinding: () => Promise<void>;

  /** Toggle anonymous mode on/off, persists to server + local storage */
  toggleAnonymous: (value: boolean) => Promise<void>;

  /** Toggle daily reflection reminder notifications on/off */
  toggleNotifications: (value: boolean) => Promise<void>;

  /**
   * Get or generate a permanent device UUID.
   * This ID is generated once per install and NEVER cleared.
   * Sent to the server to enforce username ownership.
   */
  getDeviceId: () => Promise<string>;
}

// ── Zustand store ────────────────────────────
export const useUserStore = create<UserState>((set, get) => ({
  userId: null,
  username: null,
  role: null,
  avatarUrl: null,
  isAnonymous: false,
  notificationsEnabled: true,
  isLoggedIn: false,
  isLoading: true,

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const userId   = await storage.getItem(USER_ID_KEY);
      const username = await storage.getItem(USERNAME_KEY);
      const role     = (await storage.getItem(ROLE_KEY)) as UserRole | null;
      console.log('[UserStore] Loading user:', { userId: userId?.slice(0, 8), username, role });
      if (userId && username) {
        const savedAnon = await storage.getItem(ANONYMOUS_KEY);
        const isAnonymous = savedAnon === 'true';
        const savedNotif = await storage.getItem(NOTIFICATIONS_KEY);
        const notificationsEnabled = savedNotif !== 'false'; // default true
        const avatarUrl = await storage.getItem(AVATAR_URL_KEY);
        set({ userId, username, role: role ?? 'USER', avatarUrl, isAnonymous, notificationsEnabled, isLoggedIn: true, isLoading: false });
        console.log('[UserStore] User loaded successfully');

        // One-time deviceId sync for users who were already logged in before the update
        // Skip on web — no persistent device ID available
        if (Platform.OS !== 'web') {
          const alreadySynced = await storage.getItem(DEVICE_SYNCED_KEY);
          if (!alreadySynced) {
            try {
              const deviceId = await get().getDeviceId();
              await apiCreateUser({ displayName: username, deviceId, platform: Platform.OS });
              await storage.setItem(DEVICE_SYNCED_KEY, 'true');
              console.log('[UserStore] deviceId synced to server');
            } catch (syncErr) {
              // Non-blocking — will retry on next app launch
              console.warn('[UserStore] deviceId sync deferred:', syncErr);
            }
          }
        }
      } else {
        console.log('[UserStore] No saved session found');
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('[UserStore] Could not restore session:', err);
      set({ isLoading: false });
    }
  },

  validateDeviceOwner: async (username: string) => {
    try {
      const deviceOwner = await storage.getItem(DEV_OWNER_KEY);
      if (deviceOwner && deviceOwner !== username) {
        throw new Error(
          `This device is bound to user "${deviceOwner}". ` +
          `Cannot log in as "${username}". ` +
          `You can sign in as "${deviceOwner}" to keep access to previous posts/comments, ` +
          `or sign in as "${deviceOwner}" and clear the device binding first to use a new username (previous posts/comments will stay with "${deviceOwner}").`
        );
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      console.warn('[UserStore] Device owner validation error:', err);
      throw err;
    }
  },

  loginUser: async (userId: string, username: string, role: UserRole = 'USER', avatarUrl?: string | null) => {
    try {
      // Set device owner on first login (immutable thereafter)
      const deviceOwner = await storage.getItem(DEV_OWNER_KEY);
      if (!deviceOwner) {
        await storage.setItem(DEV_OWNER_KEY, username);
      }

      // Store session data
      await storage.setItem(USER_ID_KEY, userId);
      await storage.setItem(USERNAME_KEY, username);
      await storage.setItem(ROLE_KEY, role);
      // Persist avatar URL from server if provided
      if (avatarUrl) {
        await storage.setItem(AVATAR_URL_KEY, avatarUrl);
      }
      // Mark deviceId as synced (login already sent it to the server)
      await storage.setItem(DEVICE_SYNCED_KEY, 'true');
    } catch (err) {
      console.warn('[UserStore] Could not persist session:', err);
    }
    // Always update in-memory state even if storage fails
    set({ userId, username, role, avatarUrl: avatarUrl ?? null, isLoggedIn: true, isLoading: false });
  },

  logoutUser: async () => {
    try {
      // Clear session data but keep DEV_OWNER_KEY (persistent after logout)
      await storage.removeItem(USER_ID_KEY);
      await storage.removeItem(USERNAME_KEY);
      await storage.removeItem(ROLE_KEY);
      await storage.removeItem(AVATAR_URL_KEY);
    } catch (err) {
      console.warn('[UserStore] Could not clear session:', err);
    }
    set({ userId: null, username: null, role: null, avatarUrl: null, isAnonymous: false, notificationsEnabled: true, isLoggedIn: false, isLoading: false });
  },

  updateUsername: async (newUsername: string) => {
    try {
      console.log('[UserStore] ═══════════ UPDATE USERNAME START ═══════════');
      console.log('[UserStore] Platform:', Platform.OS);
      console.log('[UserStore] New username:', newUsername);
      
      // Update both USERNAME_KEY and DEV_OWNER_KEY
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(USERNAME_KEY, newUsername);
        await AsyncStorage.setItem(DEV_OWNER_KEY, newUsername);
        console.log('[UserStore] ✓ Updated both keys (web)');
        
        // Verify
        const verifyUsername = await AsyncStorage.getItem(USERNAME_KEY);
        const verifyDeviceOwner = await AsyncStorage.getItem(DEV_OWNER_KEY);
        console.log('[UserStore] Verified USERNAME_KEY:', verifyUsername);
        console.log('[UserStore] Verified DEV_OWNER_KEY:', verifyDeviceOwner);
      } else {
        await SecureStore.setItemAsync(USERNAME_KEY, newUsername);
        await SecureStore.setItemAsync(DEV_OWNER_KEY, newUsername);
        console.log('[UserStore] ✓ Updated both keys (native)');
        
        // Verify immediately after setting
        const verifyUsername = await SecureStore.getItemAsync(USERNAME_KEY);
        const verifyDeviceOwner = await SecureStore.getItemAsync(DEV_OWNER_KEY);
        console.log('[UserStore] Verified USERNAME_KEY:', verifyUsername);
        console.log('[UserStore] Verified DEV_OWNER_KEY:', verifyDeviceOwner);
      }
      
      // Update state
      set({ username: newUsername });
      console.log('[UserStore] ✓ State updated to:', newUsername);
      console.log('[UserStore] ═══════════ UPDATE USERNAME END ═══════════');
    } catch (err) {
      console.error('[UserStore] ✗ ERROR updating username:', err);
      throw err;
    }
  },

  updateAvatarUrl: async (url: string) => {
    try {
      await storage.setItem(AVATAR_URL_KEY, url);
      set({ avatarUrl: url });
    } catch (err) {
      console.warn('[UserStore] Could not persist avatar URL:', err);
      throw err;
    }
  },

  getDeviceOwner: async () => {
    try {
      return await storage.getItem(DEV_OWNER_KEY);
    } catch (err) {
      console.warn('[UserStore] Could not read device owner binding:', err);
      return null;
    }
  },

  clearDeviceOwnerBinding: async () => {
    try {
      await storage.removeItem(DEV_OWNER_KEY);
    } catch (err) {
      console.warn('[UserStore] Could not clear device owner binding:', err);
      throw err;
    }
  },

  toggleAnonymous: async (value: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await apiToggleAnonymous(userId, value);
    await storage.setItem(ANONYMOUS_KEY, String(value));
    set({ isAnonymous: value });
  },

  toggleNotifications: async (value: boolean) => {
    const { userId } = get();
    if (!userId) return;
    await apiToggleNotifications(userId, value);
    await storage.setItem(NOTIFICATIONS_KEY, String(value));
    set({ notificationsEnabled: value });
  },

  getDeviceId: async () => {
    try {
      let deviceId = await storage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = uuidv4();
        await storage.setItem(DEVICE_ID_KEY, deviceId);
        console.log('[UserStore] Generated new device ID:', deviceId.slice(0, 8));
      }
      return deviceId;
    } catch (err) {
      console.warn('[UserStore] Could not get/generate device ID:', err);
      // Fallback: generate a non-persisted UUID (less safe, but app won't crash)
      return uuidv4();
    }
  },
}));
