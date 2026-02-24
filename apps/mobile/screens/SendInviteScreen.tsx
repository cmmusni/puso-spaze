// ─────────────────────────────────────────────
// screens/SendInviteScreen.tsx
// ADMIN-only: generate and email a coach invite code
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
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { colors } from '../constants/theme';
import { apiSendInviteByEmail } from '../services/api';
import { showAlert } from '../utils/alertPlatform';
import type { CoachDrawerParamList } from '../navigation/CoachDrawerNavigator';

export default function SendInviteScreen() {
  const navigation = useNavigation<DrawerNavigationProp<CoachDrawerParamList>>();
  const [inviteEmail, setInviteEmail]               = useState('');
  const [adminSecret, setAdminSecret]               = useState('');
  const [inviteEmailFocused, setInviteEmailFocused] = useState(false);
  const [adminSecretFocused, setAdminSecretFocused] = useState(false);
  const [sending, setSending]                       = useState(false);

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
      showAlert('Invite Sent ✅', `Invite code ${code} has been emailed to ${emailTrimmed}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to send invite. Check the admin secret and try again.';
      showAlert('Send Failed', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.darkest, colors.deep, '#0a1628']}
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
          <Text style={styles.pageTitle}>📧 Send Coach Invite</Text>
          <Text style={styles.pageSubtitle}>Email a new invite code to an incoming coach.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* ── Email input ── */}
          <Text style={styles.label}>Coach's Email Address</Text>
          <View style={[
            styles.inputWrapper,
            inviteEmailFocused ? styles.inputFocused : styles.inputDefault,
          ]}>
            <Text style={styles.inputIcon}>📧</Text>
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
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Admin secret input ── */}
          <Text style={styles.label}>Admin Secret</Text>
          <View style={[
            styles.inputWrapper,
            adminSecretFocused ? styles.inputFocused : styles.inputDefault,
          ]}>
            <Text style={styles.inputIcon}>🔐</Text>
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
              <Text style={styles.sendBtnText}>📤 Send Invite Code</Text>
            )}
          </TouchableOpacity>

          {/* ── Info hint ── */}
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              A brand-new one-time invite code will be generated and emailed to the address above.
              The recipient opens the PUSO Spaze app and uses it in the Coach login panel.
            </Text>
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
    color: '#a5b4fc',
    letterSpacing: 0.3,
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
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129,140,248,0.08)',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 13,
  },
  clearBtn: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    paddingLeft: 8,
  },

  sendBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 18,
  },
  sendBtnActive: {
    backgroundColor: '#4f46e5',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
});
