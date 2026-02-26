// ─────────────────────────────────────────────
// screens/LoginScreen.tsx
// Entry point: choose custom username or go anonymous
// PUSO Coaches can log in via invite code (new coaches)
// OR simply use their username (returning coaches)
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
  Alert,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { useUser } from '../hooks/useUser';
import { validateUsername } from '../utils/validators';
import { showAlert } from '../utils/alertPlatform';
import type { RootStackParamList } from '../navigation/AppNavigator';

type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;
type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const route = useRoute<LoginScreenRouteProp>();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { loginWithUsername, loginAnonymously, loginAsCoach } = useUser();
  const [customName, setCustomName]           = useState('');
  const [loading, setLoading]                 = useState(false);
  const [focused, setFocused]                 = useState(false);

  // ── Coach panel state ─────────────────────
  const [showCoachPanel, setShowCoachPanel]   = useState(false);
  const [coachName, setCoachName]             = useState('');
  const [coachCode, setCoachCode]             = useState('');
  const [coachNameFocused, setCoachNameFocused] = useState(false);
  const [coachCodeFocused, setCoachCodeFocused] = useState(false);

  // ── Auto-fill code from deep link ─────────
  useEffect(() => {
    // Check route params first (from React Navigation deep linking)
    const codeParam = route.params?.code;
    if (codeParam) {
      setShowCoachPanel(true);
      setCoachCode(codeParam.toUpperCase());
      return;
    }

    // On web, also check URL query params directly
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('code');
      if (codeFromUrl) {
        setShowCoachPanel(true);
        setCoachCode(codeFromUrl.toUpperCase());
      }
    }
  }, [route.params?.code]);

  // ── Handlers ──────────────────────────────

  const handleLoginWithUsername = async () => {
    const err = validateUsername(customName);
    if (err) {
      showAlert('Invalid Username', err);
      return;
    }
    setLoading(true);
    try {
      await loginWithUsername(customName.trim());
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    } catch (err: any) {
      const msg = err?.message ?? 'Could not connect to server. Please try again.';
      showAlert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAnonymously = async () => {
    setLoading(true);
    try {
      await loginAnonymously();
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    } catch (err: any) {
      const msg = err?.message ?? 'Something went wrong. Please try again.';
      showAlert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCoachLogin = async () => {
    const nameErr = validateUsername(coachName);
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
      await loginAsCoach(coachName.trim(), trimmedCode);
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    } catch (err: any) {
      const msg = err?.message ?? err?.response?.data?.error ?? 'Invalid or already-used invite code.';
      showAlert('Coach Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit      = !loading && customName.trim().length >= 2;
  const canSubmitCoach = !loading && coachName.trim().length >= 2 && coachCode.trim().length >= 11;

  // ── Render ────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
    >
      <LinearGradient
        colors={[colors.darkest, colors.deep, colors.ink, colors.fuchsia, colors.hot]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo / Hero ── */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          {/* ── Frosted card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome to PUSO Spaze 👋</Text>
            <Text style={styles.cardSubtitle}>A safe space for your heart</Text>

            {!showCoachPanel && (
              <>
                <Text style={styles.inputLabel}>Your Name</Text>

                {/* Input */}
                <View style={[styles.inputWrapper, focused ? styles.inputWrapperFocused : styles.inputWrapperDefault]}>
                  <Text style={styles.inputIcon}>✏️</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. GracefulSoul"
                    placeholderTextColor={colors.muted5}
                    value={customName}
                    onChangeText={setCustomName}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                    editable={!loading}
                  />
                  {customName.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomName('')} activeOpacity={0.7}>
                      <Text style={styles.clearBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Primary CTA */}
                <TouchableOpacity
                  onPress={handleLoginWithUsername}
                  disabled={!canSubmit}
                  activeOpacity={0.87}
                  style={styles.ctaBtn}
                >
                  <LinearGradient
                    colors={canSubmit ? [colors.hot, colors.fuchsia, colors.ink, colors.deep] : [colors.muted2, colors.muted4]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.ctaText}>
                        Enter as{' '}
                        <Text style={styles.ctaNameHighlight}>{customName.trim() || '…'}</Text>
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or skip it</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Anonymous Button */}
                <TouchableOpacity
                  onPress={handleLoginAnonymously}
                  disabled={loading}
                  activeOpacity={0.87}
                  style={styles.anonBtn}
                >
                  <LinearGradient
                    colors={['rgba(147, 51, 234, 0.15)', 'rgba(192, 38, 211, 0.15)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.anonGradient}
                  >
                    <View style={styles.anonContent}>
                      <Text style={styles.anonIcon}>🎭</Text>
                      <View style={styles.anonTextContainer}>
                        <Text style={styles.anonBtnText}>Enter Anonymously</Text>
                        <Text style={styles.anonSubtext}>100% private, no name needed</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ── Coach toggle ── */}
            <TouchableOpacity
              onPress={() => setShowCoachPanel((v) => !v)}
              activeOpacity={0.7}
              style={styles.coachToggle}
            >
              <Text style={styles.coachToggleText}>
                {showCoachPanel ? '▲ Anonymous User' : '🛡️ PUSO Coach? Enter invite code'}
              </Text>
            </TouchableOpacity>

            {/* ── Coach panel (collapsible) ── */}
            {showCoachPanel && (
              <View style={styles.coachPanel}>
                <View style={styles.coachPanelDivider} />

                <Text style={styles.coachPanelTitle}>Coach Sign In</Text>
                <Text style={styles.coachPanelSubtitle}>
                  Enter your name and the invite code you received.
                </Text>
                <Text style={styles.coachPanelHint}>
                  💡 Returning coaches: Just use your name in the main login above!
                </Text>

                {/* Coach name input */}
                <Text style={styles.inputLabel}>Coach Name</Text>
                <View style={[styles.inputWrapper, coachNameFocused ? styles.inputWrapperFocused : styles.inputWrapperDefault]}>
                  <Text style={styles.inputIcon}>🛡️</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={colors.muted5}
                    value={coachName}
                    onChangeText={setCoachName}
                    onFocus={() => setCoachNameFocused(true)}
                    onBlur={() => setCoachNameFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                    editable={!loading}
                  />
                </View>

                {/* Invite code input */}
                <Text style={styles.inputLabel}>Invite Code</Text>
                <View style={[styles.inputWrapper, coachCodeFocused ? styles.coachCodeFocused : styles.inputWrapperDefault]}>
                  <Text style={styles.inputIcon}>🔑</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="XXXXX-XXXXX"
                    placeholderTextColor={colors.muted5}
                    value={coachCode}
                    onChangeText={(t) => setCoachCode(t.toUpperCase())}
                    onFocus={() => setCoachCodeFocused(true)}
                    onBlur={() => setCoachCodeFocused(false)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={11}
                    editable={!loading}
                  />
                </View>

                {/* Coach CTA */}
                <TouchableOpacity
                  onPress={handleCoachLogin}
                  disabled={!canSubmitCoach}
                  activeOpacity={0.87}
                  style={styles.ctaBtn}
                >
                  <LinearGradient
                    colors={canSubmitCoach
                      ? ['#1a7a4a', '#2ea86a', '#1a7a4a']
                      : [colors.muted2, colors.muted4]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.ctaText}>🛡️ Enter as Coach</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Feature chips */}
          <View style={styles.chipsRow}>
            {['🔒 Private', '🤝 Community', '✨ Uplifting'].map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            All posts are reviewed for safety.{'\n'}Your identity is always protected.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
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
    marginBottom: 16,
  },
  inputWrapperDefault: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputWrapperFocused: {
    borderColor: '#c084fc',
    backgroundColor: 'rgba(192,132,252,0.08)',
  },
  coachCodeFocused: {
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
    fontSize: 16,
    paddingVertical: 12,
  },
  codeInput: {
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  clearBtn: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    paddingLeft: 8,
  },
  ctaBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  ctaGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  ctaTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  ctaNameHighlight: {
    color: '#c084fc',
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginHorizontal: 10,
  },
  anonBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  anonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  anonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  anonIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonIcon: {
    fontSize: 28,
  },
  anonTextContainer: {
    flex: 1,
  },
  anonBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  anonSubtext: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  anonArrow: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
  },
  coachToggle: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  coachToggleText: {
    color: 'rgba(129,140,248,0.8)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  coachPanel: {
    marginTop: 4,
  },
  coachPanelDivider: {
    height: 1,
    backgroundColor: 'rgba(129,140,248,0.25)',
    marginBottom: 16,
  },
  coachPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#a5b4fc',
    marginBottom: 2,
  },
  coachPanelSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
  },
  coachPanelHint: {
    fontSize: 11,
    color: colors.lightAccent,
    backgroundColor: colors.accent + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    lineHeight: 18,
  },
});

