// ─────────────────────────────────────────────
// screens/CoachLoginScreen.tsx
// Coach invitation redemption screen.
// Reached via deep link: ?code=XXXXX-XXXXX
// After redeeming, device is bound and the coach
// can log in via the regular login form with their username.
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, radii } from '../constants/theme';
import { useUser } from '../hooks/useUser';
import { validateUsername } from '../utils/validators';
import { showAlert } from '../utils/alertPlatform';
import { apiGetInviteEmail } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CoachLoginRouteProp = RouteProp<RootStackParamList, 'CoachLogin'>;
type CoachLoginNavProp = NativeStackNavigationProp<RootStackParamList, 'CoachLogin'>;

export default function CoachLoginScreen() {
  const route = useRoute<CoachLoginRouteProp>();
  const navigation = useNavigation<CoachLoginNavProp>();
  const { loginAsCoach } = useUser();

  const [coachName, setCoachName] = useState('');
  const [coachCode, setCoachCode] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [emailPrefilled, setEmailPrefilled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const containerMaxW = isWide ? Math.min(440, width * 0.45) : undefined;

  // ── Pre-fill code from deep link ──────────
  useEffect(() => {
    const codeParam = route.params?.code;
    if (codeParam) {
      setCoachCode(codeParam.toUpperCase());
      return;
    }
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('code');
      if (codeFromUrl) {
        setCoachCode(codeFromUrl.toUpperCase());
      }
    }
  }, [route.params?.code]);

  // ── Fetch email when code is complete ──────
  useEffect(() => {
    const trimmed = coachCode.trim().toUpperCase();
    if (trimmed.length !== 11) return;

    let cancelled = false;
    apiGetInviteEmail(trimmed)
      .then((res) => {
        if (cancelled) return;
        if (res.email) {
          setCoachEmail(res.email);
          setEmailPrefilled(true);
        }
      })
      .catch((err) => {
        console.warn('[CoachLogin] Failed to fetch invite email:', err?.message ?? err);
      });
    return () => { cancelled = true; };
  }, [coachCode]);

  // ── Handlers ──────────────────────────────
  const canSubmit = !loading && coachName.trim().length >= 2 && coachCode.trim().length >= 11;

  const handleRedeem = async () => {
    const nameErr = validateUsername(coachName.trim());
    if (nameErr) {
      showAlert('Invalid Name', nameErr);
      return;
    }
    const trimmedCode = coachCode.trim().toUpperCase();
    if (trimmedCode.length < 11) {
      showAlert('Invalid Code', 'Enter the full invite code — format XXXXX-XXXXX.');
      return;
    }
    setLoading(true);
    try {
      await loginAsCoach(coachName.trim(), trimmedCode, coachEmail.trim() || undefined);
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    } catch (err: any) {
      const msg =
        err?.message ??
        err?.response?.data?.error ??
        'Invalid or already-used invite code.';
      showAlert('Coach Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
    >
      <ImageBackground
        source={require('../assets/background-image.png')}
        style={styles.gradient}
        resizeMode="cover"
        imageStyle={{ opacity: 0.45 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isWide && { alignItems: 'center' as const },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={isWide ? { width: containerMaxW } : undefined}>
            {/* ── Logo ── */}
            <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
            </View>

            {/* ── Title ── */}
            <Text style={styles.title}>PUSO Spaze</Text>
            <Text style={styles.tagline}>Coach Invitation</Text>

            {/* ── Card ── */}
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="shield-checkmark" size={16} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Welcome, Coach!</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Enter your name and the invite code from your email to activate
                your coach account.
              </Text>

              {/* Coach name */}
              <View
                style={[styles.inputWrapper, nameFocused && styles.inputFocused]}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={colors.muted4}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Choose your Coach username"
                  placeholderTextColor={colors.muted4}
                  value={coachName}
                  onChangeText={setCoachName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                  editable={!loading}
                />
              </View>

              {/* Invite code */}
              <View
                style={[styles.inputWrapper, codeFocused && styles.inputFocused]}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={colors.muted4}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="XXXXX-XXXXX"
                  placeholderTextColor={colors.muted4}
                  value={coachCode}
                  onChangeText={(t) => {
                    setCoachCode(t.toUpperCase());
                    // Reset email if code changes
                    if (t.toUpperCase() !== coachCode) {
                      setCoachEmail('');
                      setEmailPrefilled(false);
                    }
                  }}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={11}
                  editable={!loading}
                />
              </View>

              {/* Email (prefilled from invite or editable) */}
              {coachCode.trim().length === 11 && (
                <View
                  style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputFocused,
                    emailPrefilled && styles.inputPrefilled,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={emailPrefilled ? colors.fuchsia : colors.muted4}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, emailPrefilled && styles.prefilledText]}
                    placeholder="coach@email.com"
                    placeholderTextColor={colors.muted4}
                    value={coachEmail}
                    onChangeText={setCoachEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  {emailPrefilled && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.fuchsia}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              )}

              {/* Hint */}
              <View style={styles.hintRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={colors.fuchsia}
                />
                <Text style={styles.hintText}>
                  After activating, you can sign in with your username on the
                  regular login screen. Your device will be bound to your coach
                  account.
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity
                onPress={handleRedeem}
                disabled={!canSubmit}
                activeOpacity={0.87}
                style={styles.ctaWrap}
              >
                <LinearGradient
                  colors={
                    canSubmit
                      ? [colors.primary, colors.fuchsia]
                      : [colors.muted2, colors.muted2]
                  }
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaBtn}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="shield-checkmark"
                        size={18}
                        color={canSubmit ? '#fff' : colors.muted4}
                      />
                      <Text
                        style={[
                          styles.ctaText,
                          !canSubmit && styles.ctaTextDisabled,
                        ]}
                      >
                        Activate Coach Account
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ── Back link ── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login', {})}
              style={styles.backLink}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color={colors.subtle} />
              <Text style={styles.backLinkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  kav: { flex: 1 },
  gradient: { flex: 1, width: '100%' as any, height: '100%' as any },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },

  // ── Logo ────────────────────────────────────
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 14 },

  // ── Title ───────────────────────────────────
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 30,
    color: colors.heading,
    marginBottom: 4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.fuchsia,
    textAlign: 'center',
    marginBottom: 28,
  },

  // ── Card ────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } as any)
      : Platform.OS === 'ios'
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
          }
        : { elevation: 8 }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.heading,
  },
  cardSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 21,
    marginBottom: 20,
  },

  // ── Inputs ──────────────────────────────────
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: colors.fuchsia,
    backgroundColor: colors.canvas,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 14,
    outlineWidth: 0,
    outlineStyle: 'none',
  } as any,
  codeInput: {
    fontFamily: fonts.displayBold,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  inputPrefilled: {
    backgroundColor: '#FDF2F8',
    borderColor: colors.fuchsia,
    borderWidth: 1,
  },
  prefilledText: {
    color: colors.fuchsia,
  },

  // ── Hint ────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: colors.fuchsia,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.subtle,
    lineHeight: 17,
  },

  // ── CTA ─────────────────────────────────────
  ctaWrap: { borderRadius: 20, overflow: 'hidden' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 20,
  },
  ctaText: {
    fontFamily: fonts.displayBold,
    color: '#ffffff',
    fontSize: 16,
  },
  ctaTextDisabled: {
    color: colors.muted4,
  },

  // ── Back link ───────────────────────────────
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  backLinkText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.subtle,
  },
});
