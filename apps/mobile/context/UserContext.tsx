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
import type { UserRole } from '../../../packages/types';

// ── Storage keys ─────────────────────────────
const USER_ID_KEY    = 'puso_user_id';
const USERNAME_KEY   = 'puso_username';
const ROLE_KEY       = 'puso_role';
const DEV_OWNER_KEY  = 'puso_device_owner'; // Device-level username binding (persistent across logouts)

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
   */
  loginUser: (userId: string, username: string, role?: UserRole) => Promise<void>;

  /** Clear session from SecureStore and reset state (but keep device owner) */
  logoutUser: () => Promise<void>;

  /** Update the user's username in storage and state */
  updateUsername: (newUsername: string) => Promise<void>;
}

// ── Zustand store ────────────────────────────
export const useUserStore = create<UserState>((set) => ({
  userId: null,
  username: null,
  role: null,
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
        set({ userId, username, role: role ?? 'USER', isLoggedIn: true, isLoading: false });
        console.log('[UserStore] User loaded successfully');
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
          `Only the original user can access this device.`
        );
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      console.warn('[UserStore] Device owner validation error:', err);
      throw err;
    }
  },

  loginUser: async (userId: string, username: string, role: UserRole = 'USER') => {
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
    } catch (err) {
      console.warn('[UserStore] Could not persist session:', err);
    }
    // Always update in-memory state even if storage fails
    set({ userId, username, role, isLoggedIn: true });
  },

  logoutUser: async () => {
    try {
      // Clear session data but keep DEV_OWNER_KEY (persistent after logout)
      await storage.removeItem(USER_ID_KEY);
      await storage.removeItem(USERNAME_KEY);
      await storage.removeItem(ROLE_KEY);
    } catch (err) {
      console.warn('[UserStore] Could not clear session:', err);
    }
    set({ userId: null, username: null, role: null, isLoggedIn: false });
  },

  updateUsername: async (newUsername: string) => {
    try {
      await storage.setItem(USERNAME_KEY, newUsername);
      set((state) => ({ username: newUsername }));
    } catch (err) {
      console.warn('[UserStore] Could not update username:', err);
      throw err;
    }
  },
}));
