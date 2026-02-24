// ─────────────────────────────────────────────
// screens/ProfileScreen.tsx
// User profile & device settings
// Shows device binding info and option to clear it
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Platform as RNPlatform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors } from '../constants/theme';
import { useUserStore } from '../context/UserContext';
import { showAlert, showConfirm } from '../utils/alertPlatform';
import { apiUpdateUsername } from '../services/api';
import type { MainDrawerParamList } from '../navigation/MainDrawerNavigator';

type Nav = DrawerNavigationProp<MainDrawerParamList>;

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (RNPlatform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    if (RNPlatform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { username, userId, updateUsername, logoutUser } = useUserStore();
  const [deviceOwner, setDeviceOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username ?? '');
  const [savingUsername, setSavingUsername] = useState(false);

  const loadDeviceOwner = async () => {
    try {
      const owner = await storage.getItem('puso_device_owner');
      setDeviceOwner(owner);
    } catch (err) {
      console.warn('[ProfileScreen] Could not load device owner:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadDeviceOwner();
      setLoading(false);
    };
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeviceOwner();
    setRefreshing(false);
  };

  const handleClearDeviceBinding = async () => {
    const confirmed = await showConfirm(
      'Clear Device Binding?',
      'This will allow a different username to be used on this device.\n\n' +
      'Current username will be disconnected permanently. This action cannot be undone.'
    );

    if (!confirmed) return;

    setClearing(true);
    try {
      await storage.removeItem('puso_device_owner');
      setDeviceOwner(null);
      showAlert('Success', 'Device binding cleared. You can now use a different username.');
    } catch (err) {
      showAlert('Error', 'Failed to clear device binding. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const handleOpenDrawer = () => {
    navigation.openDrawer();
  };

  const handleEditUsername = () => {
    setEditedUsername(username ?? '');
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setEditedUsername(username ?? '');
  };

  const handleSaveUsername = async () => {
    if (!editedUsername.trim()) {
      showAlert('Invalid', 'Username cannot be empty.');
      return;
    }

    if (editedUsername === username) {
      setIsEditingUsername(false);
      return;
    }

    if (!userId) {
      showAlert('Error', 'User session not found. Please sign out and sign back in.');
      return;
    }

    setSavingUsername(true);
    try {
      await apiUpdateUsername(userId, editedUsername);
      await updateUsername(editedUsername);
      showAlert('Success', `Username updated to "${editedUsername}".`);
      setIsEditingUsername(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error
        ?? err?.response?.data?.errors?.[0]?.msg
        ?? err?.message
        ?? 'Failed to update username. Please try again.';
      showAlert('Error', msg);
    } finally {
      setSavingUsername(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.darkest, colors.deep, colors.ink]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleOpenDrawer} style={styles.hamburger} activeOpacity={0.7}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>👤 Profile</Text>
          <Text style={styles.headerSubtitle}>Account Settings</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Current Session ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Session</Text>
          <View style={styles.card}>
            {isEditingUsername ? (
              <>
                <Text style={styles.label}>Edit Username</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={editedUsername}
                  onChangeText={setEditedUsername}
                  placeholder="Enter new username"
                  placeholderTextColor={colors.muted5}
                  editable={!savingUsername}
                />
                <View style={styles.editButtonRow}>
                  <TouchableOpacity
                    onPress={handleCancelEditUsername}
                    disabled={savingUsername}
                    style={[styles.editActionBtn, styles.cancelBtn]}
                  >
                    <Text style={styles.editActionBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveUsername}
                    disabled={savingUsername}
                    style={[styles.editActionBtn, styles.saveBtn]}
                  >
                    {savingUsername ? (
                      <ActivityIndicator size="small" color={colors.card} />
                    ) : (
                      <Text style={styles.editActionBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Username</Text>
                  <Text style={styles.value}>{username ?? '—'}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleEditUsername}
                  style={[styles.actionBtn, styles.editBtn]}
                >
                  <Text style={styles.actionBtnIcon}>✏️</Text>
                  <Text style={styles.actionBtnText}>Edit Username</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Device Binding ── */}
        <View style={[styles.section, { display: 'none' }]}>
          <Text style={styles.sectionTitle}>Device Binding</Text>
          <View style={styles.card}>
            <Text style={styles.explanation}>
              This device is bound to the first username that logs in. Only that user can access this device.
            </Text>

            {loading ? (
              <ActivityIndicator size="small" color={colors.fuchsia} style={styles.loader} />
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Bound To</Text>
                  <Text style={styles.value}>{deviceOwner ?? 'Not set'}</Text>
                </View>

                {deviceOwner && (
                  <TouchableOpacity
                    onPress={handleClearDeviceBinding}
                    disabled={clearing}
                    style={[styles.actionBtn, styles.dangerBtn]}
                  >
                    {clearing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>🔓</Text>
                        <Text style={styles.actionBtnText}>Clear Device Binding</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 20 : Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  hamburger: {
    justifyContent: 'center',
    gap: 5,
    padding: 4,
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.muted5,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted5,
    marginTop: 4,
  },

  // ── Content ──────────────────────────────
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.fuchsia + '40',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted5,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted5,
  },

  explanation: {
    fontSize: 12,
    color: colors.muted5,
    lineHeight: 18,
    marginBottom: 16,
  },

  loader: {
    marginVertical: 16,
  },

  // ── Username input ──────────────────────
  usernameInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '60',
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
    marginVertical: 12,
  },

  editButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  editActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 11,
  },

  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  saveBtn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  editActionBtnText: {
    color: colors.card,
    fontWeight: '700',
    fontSize: 12,
  },

  // ── Action buttons ──────────────────────
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 16,
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  dangerBtn: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.ink + 'cc',
  },
  editBtn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
});
