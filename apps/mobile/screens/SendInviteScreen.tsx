// ─────────────────────────────────────────────
// screens/SendInviteScreen.tsx
// ADMIN-only: central settings (invite tools + Hourly Hope controls)
// Accessible via the Coach Drawer (ADMIN role only)
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { colors } from '../constants/theme';
import { apiGetHourlyHopeStatus, apiSendInviteByEmail, apiSetHourlyHopeStatus } from '../services/api';
import { showAlert } from '../utils/alertPlatform';
import type { MainDrawerParamList } from '../navigation/MainDrawerNavigator';

export default function SendInviteScreen() {
  const navigation = useNavigation<DrawerNavigationProp<MainDrawerParamList>>();
  const [inviteEmail, setInviteEmail]               = useState('');
  const [adminSecret, setAdminSecret]               = useState('');
  const [inviteEmailFocused, setInviteEmailFocused] = useState(false);
  const [adminSecretFocused, setAdminSecretFocused] = useState(false);
  const [sending, setSending]                       = useState(false);
  const [hourlyHopePostingEnabled, setHourlyHopePostingEnabled] = useState<boolean | null>(null);
  const [hourlyHopeVisible, setHourlyHopeVisible]   = useState<boolean | null>(null);
  const [loadingHopeStatus, setLoadingHopeStatus]   = useState(false);
  const [updatingHopeStatus, setUpdatingHopeStatus] = useState(false);

  const canSend = !sending && inviteEmail.trim().length > 0 && adminSecret.trim().length > 0;

  const handleSend = async () => {
    const emailTrimmed  = inviteEmail.trim();
    const secretTrimmed = adminSecret.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!secretTrimmed) {
      showAlert('Admin Secret Required', 'Enter your admin secret to authorise this action.');
      return;
    }

    setSending(true);
    try {
      const { code } = await apiSendInviteByEmail(emailTrimmed, secretTrimmed);
      setInviteEmail('');
      setAdminSecret('');
      showAlert('Invite Sent', `Invite code ${code} has been emailed to ${emailTrimmed}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to send invite. Check the admin secret and try again.';
      showAlert('Send Failed', msg);
    } finally {
      setSending(false);
    }
  };

  const loadHourlyHopeStatus = async () => {
    const secretTrimmed = adminSecret.trim();
    if (!secretTrimmed) {
      showAlert('Admin Secret Required', 'Enter your admin secret first to check Hourly Hope status.');
      return;
    }

    setLoadingHopeStatus(true);
    try {
      const { postingEnabled, visible } = await apiGetHourlyHopeStatus(secretTrimmed);
      setHourlyHopePostingEnabled(postingEnabled);
      setHourlyHopeVisible(visible);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to load Hourly Hope status.';
      showAlert('Status Load Failed', msg);
    } finally {
      setLoadingHopeStatus(false);
    }
  };

  const toggleHourlyHopePosting = async () => {
    const secretTrimmed = adminSecret.trim();
    if (!secretTrimmed) {
      showAlert('Admin Secret Required', 'Enter your admin secret first to update Hourly Hope settings.');
      return;
    }

    if (hourlyHopePostingEnabled === null) {
      showAlert('Load Status First', 'Tap “Check Status” before updating Hourly Hope settings.');
      return;
    }

    setUpdatingHopeStatus(true);
    try {
      const nextValue = !hourlyHopePostingEnabled;
      const { postingEnabled } = await apiSetHourlyHopeStatus({ postingEnabled: nextValue }, secretTrimmed);
      setHourlyHopePostingEnabled(postingEnabled);
      showAlert(
        'Posting Updated',
        postingEnabled
          ? 'Hourly Hope posting is now active. Scheduled posts can be created again.'
          : 'Hourly Hope posting is paused. No new scheduled Hourly Hope posts will be created.'
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to update Hourly Hope status.';
      showAlert('Update Failed', msg);
    } finally {
      setUpdatingHopeStatus(false);
    }
  };

  const toggleHourlyHopeVisibility = async () => {
    const secretTrimmed = adminSecret.trim();
    if (!secretTrimmed) {
      showAlert('Admin Secret Required', 'Enter your admin secret first to update Hourly Hope settings.');
      return;
    }

    if (hourlyHopeVisible === null) {
      showAlert('Load Status First', 'Tap “Check Status” before updating Hourly Hope settings.');
      return;
    }

    setUpdatingHopeStatus(true);
    try {
      const nextValue = !hourlyHopeVisible;
      const { visible } = await apiSetHourlyHopeStatus({ visible: nextValue }, secretTrimmed);
      setHourlyHopeVisible(visible);
      showAlert(
        'Visibility Updated',
        visible
          ? 'Hourly Hope posts are now visible in the feed.'
          : 'Hourly Hope posts are now hidden from the feed.'
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to update Hourly Hope status.';
      showAlert('Update Failed', msg);
    } finally {
      setUpdatingHopeStatus(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.darkest, colors.deep, colors.darkest]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.hamburger} activeOpacity={0.7}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <View style={styles.pageTitleRow}>
            <Ionicons name="settings-outline" size={18} color="#ffffff" />
            <Text style={styles.pageTitle}>Admin Settings</Text>
          </View>
          <Text style={styles.pageSubtitle}>Manage invite tools and Hourly Hope controls.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Coach Invite</Text>

          {/* ── Email input ── */}
          <Text style={styles.label}>Coach's Email Address</Text>
          <View style={[
            styles.inputWrapper,
            inviteEmailFocused ? styles.inputFocused : styles.inputDefault,
          ]}>
            <Ionicons name="mail-outline" size={16} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="coach@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              onFocus={() => setInviteEmailFocused(true)}
              onBlur={() => setInviteEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sending}
            />
            {inviteEmail.length > 0 && (
              <TouchableOpacity onPress={() => setInviteEmail('')} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" style={styles.clearBtn} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Admin secret input ── */}
          <Text style={styles.label}>Admin Secret</Text>
          <View style={[
            styles.inputWrapper,
            adminSecretFocused ? styles.inputFocused : styles.inputDefault,
          ]}>
            <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter admin secret"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={adminSecret}
              onChangeText={setAdminSecret}
              onFocus={() => setAdminSecretFocused(true)}
              onBlur={() => setAdminSecretFocused(false)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sending}
            />
          </View>

          {/* ── Send button ── */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.85}
            style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.sendBtnRow}>
                <Ionicons name="paper-plane-outline" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>Send Invite Code</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Info hint ── */}
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              A brand-new one-time invite code will be generated and emailed to the address above.
              The recipient opens the PUSO Spaze app and uses it in the Coach login panel.
            </Text>
          </View>

          <View style={styles.adminSectionDivider} />

          <Text style={styles.sectionHeading}>Content Controls</Text>
          <Text style={styles.label}>Hourly Hope Controls</Text>
          <View style={styles.hopeActionRow}>
            <TouchableOpacity
              onPress={loadHourlyHopeStatus}
              disabled={loadingHopeStatus || updatingHopeStatus}
              activeOpacity={0.85}
              style={styles.hopeSecondaryBtn}
            >
              {loadingHopeStatus ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.hopeSecondaryBtnText}>Check Status</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.hopeControlCard}>
            <View style={styles.hopeStatusRow}>
              <Text style={styles.hopeStatusLabel}>Pause Hourly Hope Posting</Text>
              <View
                style={[
                  styles.hopeStatusBadge,
                  hourlyHopePostingEnabled === null
                    ? styles.hopeStatusUnknown
                    : hourlyHopePostingEnabled
                      ? styles.hopeStatusActive
                      : styles.hopeStatusPaused,
                ]}
              >
                <Text style={styles.hopeStatusBadgeText}>
                  {hourlyHopePostingEnabled === null
                    ? 'Unknown'
                    : hourlyHopePostingEnabled
                      ? 'Active'
                      : 'Paused'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleHourlyHopePosting}
              disabled={loadingHopeStatus || updatingHopeStatus || hourlyHopePostingEnabled === null}
              activeOpacity={0.85}
              style={[
                styles.hopePrimaryBtn,
                hourlyHopePostingEnabled ? styles.hopePauseBtn : styles.hopeResumeBtn,
                (loadingHopeStatus || updatingHopeStatus || hourlyHopePostingEnabled === null) &&
                  styles.hopeBtnDisabled,
              ]}
            >
              {updatingHopeStatus ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.hopePrimaryBtnText}>
                  {hourlyHopePostingEnabled ? 'Pause Posting' : 'Resume Posting'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.hopeControlCard}>
            <View style={styles.hopeStatusRow}>
              <Text style={styles.hopeStatusLabel}>Hide Hourly Hope Posts</Text>
              <View
                style={[
                  styles.hopeStatusBadge,
                  hourlyHopeVisible === null
                    ? styles.hopeStatusUnknown
                    : hourlyHopeVisible
                      ? styles.hopeStatusActive
                      : styles.hopeStatusPaused,
                ]}
              >
                <Text style={styles.hopeStatusBadgeText}>
                  {hourlyHopeVisible === null ? 'Unknown' : hourlyHopeVisible ? 'Visible' : 'Hidden'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleHourlyHopeVisibility}
              disabled={loadingHopeStatus || updatingHopeStatus || hourlyHopeVisible === null}
              activeOpacity={0.85}
              style={[
                styles.hopePrimaryBtn,
                hourlyHopeVisible ? styles.hopePauseBtn : styles.hopeResumeBtn,
                (loadingHopeStatus || updatingHopeStatus || hourlyHopeVisible === null) &&
                  styles.hopeBtnDisabled,
              ]}
            >
              {updatingHopeStatus ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.hopePrimaryBtnText}>
                  {hourlyHopeVisible ? 'Hide Posts' : 'Show Posts'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
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
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightPrimary,
    letterSpacing: 0.3,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.25)',
  },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  inputDefault: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,68,106,0.08)',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 13,
  },
  clearBtn: {
    paddingLeft: 8,
  },

  sendBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 18,
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  sendBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  hintBox: {
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 18,
    textAlign: 'center',
  },

  adminSectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 18,
  },
  hopeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hopeStatusLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  hopeStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  hopeStatusActive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  hopeStatusPaused: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  hopeStatusUnknown: {
    backgroundColor: 'rgba(148,163,184,0.18)',
    borderColor: 'rgba(148,163,184,0.4)',
  },
  hopeStatusBadgeText: {
    color: colors.card,
    fontWeight: '700',
    fontSize: 12,
  },
  hopeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  hopeControlCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 12,
    marginBottom: 10,
  },
  hopeSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  hopeSecondaryBtnText: {
    color: colors.card,
    fontWeight: '700',
    fontSize: 13,
  },
  hopePrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hopePauseBtn: {
    backgroundColor: '#b91c1c',
  },
  hopeResumeBtn: {
    backgroundColor: '#166534',
  },
  hopeBtnDisabled: {
    opacity: 0.5,
  },
  hopePrimaryBtnText: {
    color: colors.card,
    fontWeight: '700',
    fontSize: 13,
  },
});
