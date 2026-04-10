// ─────────────────────────────────────────────
// screens/LoginScreen.tsx
// Entry point: choose custom username or go anonymous
// Coaches who have already redeemed an invite code
// can log in here with their username (device-bound).
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
  useWindowDimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { useUser } from '../hooks/useUser';
import { validateUsername } from '../utils/validators';
import { generateAnonUsername } from '../utils/generateAnonUsername';
import { showAlert, showConfirm } from '../utils/alertPlatform';
import { apiGetOnlineCount, apiCheckUsername } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;
type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const route = useRoute<LoginScreenRouteProp>();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const {
    loginWithUsername,
    loginAnonymously,
    getDeviceOwner,
    clearDeviceOwnerBinding,
  } = useUser();
  const [customName, setCustomName]           = useState('');
  const [loading, setLoading]                 = useState(false);
  const [focused, setFocused]                 = useState(false);

  // ── Anonymous username preview ─────
  const [anonUsername, setAnonUsername] = useState(() => generateAnonUsername());
  const refreshAnon = () => setAnonUsername(generateAnonUsername());

  // ── On load: silently validate the previewed username against the server.
  // If it’s already taken, cycle until we find a free one so the user
  // always sees a name that is guaranteed to be available.
  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      const MAX = 10;
      let name = anonUsername;
      for (let i = 0; i < MAX; i++) {
        const available = await apiCheckUsername(name);
        if (cancelled) return;
        if (available) {
          if (i > 0) setAnonUsername(name); // only update state if we had to cycle
          return;
        }
        name = generateAnonUsername();
      }
      if (!cancelled) setAnonUsername(name);
    };
    validate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Guidelines modal ─────
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // ── Online count ─────
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchOnline = () =>
      apiGetOnlineCount()
        .then((count) => { if (mounted) setOnlineCount(count); })
        .catch(() => {});
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Handlers ──────────────────────────────

  const extractBoundUser = (message: string): string | null => {
    const match = message.match(/bound to user "([^"]+)"/i);
    return match?.[1] ?? null;
  };

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
      const serverError = err?.response?.data?.error;
      const msg = serverError ?? err?.message ?? 'Could not connect to server. Please try again.';

      // Server-side: username owned by a different device
      if (serverError === 'Username is already taken.') {
        showAlert(
          'Username Taken',
          `"${customName.trim()}" is already in use by someone else. Please choose a different username.`
        );
        return;
      }

      // Client-side: device already bound to a different username
      const deviceOwner = extractBoundUser(msg);
      if (deviceOwner) {
        const signInInstead = await showConfirm(
          'Use Existing Account Instead?',
          `This device is currently bound to "${deviceOwner}". ` +
            `Using a different username will not give access to previous posts/comments owned by "${deviceOwner}".\n\n` +
            `Do you want to sign in as "${deviceOwner}" instead?`
        );
        if (signInInstead) {
          setCustomName(deviceOwner);
          showAlert(
            'Username Filled',
            `You can continue by tapping "Enter as ${deviceOwner}" to keep access to your previous posts/comments.`
          );
        }
        return;
      }
      showAlert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAnonymously = async () => {
    const deviceOwner = await getDeviceOwner();
    if (deviceOwner) {
      const confirmed = await showConfirm(
        'Device Already Bound',
        `This device is currently bound to "${deviceOwner}".\n\n` +
          `Signing in anonymously will create a new username, and you won't have access to previous posts/comments under "${deviceOwner}".\n\n` +
          `Do you want to continue?`
      );

      if (!confirmed) {
        const signInInstead = await showConfirm(
          'Use Existing Account Instead?',
          `Do you want to sign in as "${deviceOwner}" instead?`
        );

        if (signInInstead) {
          setCustomName(deviceOwner);
          showAlert(
            'Username Filled',
            `You can continue by tapping "Enter as ${deviceOwner}" to keep access to your previous posts/comments.`
          );
        }
        return;
      }

      try {
        await clearDeviceOwnerBinding();
      } catch {
        showAlert('Binding Error', 'Could not clear existing device binding. Please try again.');
        return;
      }
    }

    setLoading(true);
    try {
      await loginAnonymously(anonUsername);
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    } catch (err: any) {
      const msg = err?.message ?? 'Something went wrong. Please try again.';
      showAlert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && customName.trim().length >= 2;

  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const containerMaxW = isWide ? Math.min(440, width * 0.45) : undefined;

  /** Unified CTA — picks the right login path */
  const handleEnterSpaze = async () => {
    // Custom username path
    if (customName.trim().length >= 2) { handleLoginWithUsername(); return; }
    // Anonymous path
    handleLoginAnonymously();
  };

  // ── Render ────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
    >
      <LinearGradient
        colors={[colors.canvas, colors.surface, colors.muted1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
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
              <View style={styles.logoRing}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
            </View>

            {/* ── Title & Tagline ── */}
            <Text style={styles.title}>PUSO Spaze</Text>
            <Text style={styles.tagline}>
              A Spaze to share, reflect, and connect without judgment.
            </Text>

            {/* ── Identity Card ── */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>IDENTITY</Text>

              {/* Anonymous username preview */}
              <View style={styles.anonCard}>
                <View style={styles.anonAvatar}>
                  <Ionicons name="person" size={18} color={colors.fuchsia} />
                </View>
                <View style={styles.anonInfo}>
                  <Text style={styles.anonName}>{anonUsername}</Text>
                  <Text style={styles.anonHint}>
                    Randomly generated for{'\n'}privacy
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={refreshAnon}
                  style={styles.refreshBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Custom username input */}
              <View
                style={[styles.inputWrapper, focused && styles.inputFocused]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Or enter a custom username"
                  placeholderTextColor={colors.muted4}
                  value={customName}
                  onChangeText={setCustomName}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                  editable={!loading}
                />
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                onPress={handleEnterSpaze}
                disabled={loading}
                activeOpacity={0.87}
                style={styles.ctaWrap}
              >
                <LinearGradient
                  colors={[colors.primary, colors.fuchsia]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaBtn}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>Enter Spaze</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ── Legal ── */}
            <Text style={styles.legalText}>
              By entering, you agree to our{' '}
              <Text
                style={styles.legalLink}
                onPress={() => setShowGuidelines(true)}
              >
                Compassion Guidelines
              </Text>
              .
            </Text>

            {/* ── Compassion Guidelines Modal ── */}
            <Modal
              visible={showGuidelines}
              animationType="slide"
              transparent
              onRequestClose={() => setShowGuidelines(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeader}>
                      <Ionicons name="heart" size={28} color={colors.primary} />
                      <Text style={styles.modalTitle}>Compassion Guidelines</Text>
                      <Text style={styles.modalSubtitle}>
                        PUSO Spaze is a safe space. To keep it that way, we ask everyone to follow these guidelines.
                      </Text>
                    </View>

                    {[
                      {
                        icon: 'shield-checkmark' as const,
                        title: 'Be Kind & Respectful',
                        body: 'Treat every person with dignity. No bullying, shaming, or hurtful language — even if you disagree.',
                      },
                      {
                        icon: 'eye-off' as const,
                        title: 'Respect Privacy',
                        body: 'Never share someone\'s identity or personal details outside of PUSO Spaze. What\'s shared here stays here.',
                      },
                      {
                        icon: 'chatbubble-ellipses' as const,
                        title: 'Encourage, Don\'t Judge',
                        body: 'Respond with empathy and encouragement. Avoid unsolicited advice, criticism, or dismissing someone\'s feelings.',
                      },
                      {
                        icon: 'hand-left' as const,
                        title: 'No Hate Speech or Discrimination',
                        body: 'Racism, sexism, homophobia, and any form of discrimination are strictly prohibited.',
                      },
                      {
                        icon: 'alert-circle' as const,
                        title: 'Report Harmful Content',
                        body: 'If you see something that violates these guidelines or could put someone at risk, report it immediately. Our coaches review flagged content.',
                      },
                      {
                        icon: 'medical' as const,
                        title: 'Not a Substitute for Professional Help',
                        body: 'PUSO Spaze is a peer support community, not a replacement for therapy or medical advice. If you or someone you know is in crisis, please reach out to a mental health professional.',
                      },
                      {
                        icon: 'sparkles' as const,
                        title: 'Share Hope',
                        body: 'Your words matter. A single encouraging message can change someone\'s day — or even their life. Spread hope freely.',
                      },
                    ].map((g) => (
                      <View key={g.title} style={styles.guidelineRow}>
                        <View style={styles.guidelineIcon}>
                          <Ionicons name={g.icon} size={18} color={colors.fuchsia} />
                        </View>
                        <View style={styles.guidelineContent}>
                          <Text style={styles.guidelineTitle}>{g.title}</Text>
                          <Text style={styles.guidelineBody}>{g.body}</Text>
                        </View>
                      </View>
                    ))}

                    <Text style={styles.guidelineFooter}>
                      Violations may result in content removal or account restrictions. Let\'s protect this space together. 💜
                    </Text>
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setShowGuidelines(false)}
                    activeOpacity={0.87}
                    style={styles.modalCloseBtn}
                  >
                    <Text style={styles.modalCloseBtnText}>I Understand</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* ── Footer links ── */}
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink} onPress={() => setShowAbout(true)}>About the Spaze</Text>
              <Text style={styles.footerLink} onPress={() => setShowPrivacy(true)}>Privacy</Text>
            </View>

            {/* ── About the Spaze Modal ── */}
            <Modal
              visible={showAbout}
              animationType="slide"
              transparent
              onRequestClose={() => setShowAbout(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeader}>
                      <Ionicons name="heart-circle" size={32} color={colors.primary} />
                      <Text style={styles.modalTitle}>About PUSO Spaze</Text>
                      <Text style={styles.modalSubtitle}>
                        A safe space for hearts that need to be heard.
                      </Text>
                    </View>

                    {[
                      {
                        icon: 'people' as const,
                        title: 'What is PUSO Spaze?',
                        body: 'PUSO Spaze ("puso" means heart in Filipino) is an anonymous peer support community where you can share your struggles, receive encouragement, and find hope \u2014 without fear of judgment.',
                      },
                      {
                        icon: 'sparkles' as const,
                        title: 'AI-Powered Encouragement',
                        body: 'Our \"Hourly Hope\" feature delivers AI-generated biblical encouragement in Taglish (Tagalog + English), crafted for Gen Z hearts that need a reminder they\'re not alone.',
                      },
                      {
                        icon: 'eye-off' as const,
                        title: 'Truly Anonymous',
                        body: 'Post with a randomly generated username or choose your own. Your real identity is never revealed. Share freely, heal openly.',
                      },
                      {
                        icon: 'shield-checkmark' as const,
                        title: 'Coach-Moderated Safety',
                        body: 'Trained PUSO Coaches review flagged content to keep the community safe. Harmful posts are caught by AI moderation and human review.',
                      },
                      {
                        icon: 'chatbubbles' as const,
                        title: 'React & Support',
                        body: 'Show support through Pray and Care reactions. Leave encouraging comments with @mentions. Every interaction is a chance to lift someone up.',
                      },
                      {
                        icon: 'globe' as const,
                        title: 'Built for Filipinos',
                        body: 'Designed with the Filipino Gen Z community in mind \u2014 blending faith, culture, and mental health support in one compassionate platform.',
                      },
                    ].map((item) => (
                      <View key={item.title} style={styles.guidelineRow}>
                        <View style={styles.guidelineIcon}>
                          <Ionicons name={item.icon} size={18} color={colors.fuchsia} />
                        </View>
                        <View style={styles.guidelineContent}>
                          <Text style={styles.guidelineTitle}>{item.title}</Text>
                          <Text style={styles.guidelineBody}>{item.body}</Text>
                        </View>
                      </View>
                    ))}

                    <Text style={styles.guidelineFooter}>
                      Made with \ud83d\udc9c by the PUSO Spaze team. You are not alone.
                    </Text>
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setShowAbout(false)}
                    activeOpacity={0.87}
                    style={styles.modalCloseBtn}
                  >
                    <Text style={styles.modalCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* ── Privacy Modal ── */}
            <Modal
              visible={showPrivacy}
              animationType="slide"
              transparent
              onRequestClose={() => setShowPrivacy(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeader}>
                      <Ionicons name="lock-closed" size={28} color={colors.primary} />
                      <Text style={styles.modalTitle}>Privacy Policy</Text>
                      <Text style={styles.modalSubtitle}>
                        Your privacy and safety are our top priorities.
                      </Text>
                    </View>

                    {[
                      {
                        icon: 'finger-print' as const,
                        title: 'No Personal Data Collected',
                        body: 'We do not collect your real name, email, phone number, or location. Your identity within PUSO Spaze is limited to your chosen or auto-generated username.',
                      },
                      {
                        icon: 'phone-portrait' as const,
                        title: 'Device Binding',
                        body: 'Your username is linked to your device via a secure, randomly generated device ID stored locally. This helps you keep your identity across sessions without creating an account.',
                      },
                      {
                        icon: 'cloud' as const,
                        title: 'What We Store',
                        body: 'We store your posts, comments, and reactions on our secure servers. Posts go through AI moderation to ensure community safety before being published.',
                      },
                      {
                        icon: 'trash' as const,
                        title: 'Data Deletion',
                        body: 'You can clear your device binding at any time from your Profile. Coaches and admins can remove individual posts or comments. Contact us to request full data deletion.',
                      },
                      {
                        icon: 'shield' as const,
                        title: 'AI Moderation',
                        body: 'Posts are reviewed by OpenAI\'s content moderation API to detect harmful content. This is done to protect the community \u2014 no personal data is shared beyond the post text.',
                      },
                      {
                        icon: 'notifications-off' as const,
                        title: 'Push Notifications',
                        body: 'Push notifications are opt-in and only used for reactions, comments, and mentions on your posts. You can disable them at any time.',
                      },
                      {
                        icon: 'analytics' as const,
                        title: 'No Tracking or Ads',
                        body: 'PUSO Spaze does not use analytics trackers, advertising networks, or sell any user data to third parties. Ever.',
                      },
                    ].map((item) => (
                      <View key={item.title} style={styles.guidelineRow}>
                        <View style={styles.guidelineIcon}>
                          <Ionicons name={item.icon} size={18} color={colors.fuchsia} />
                        </View>
                        <View style={styles.guidelineContent}>
                          <Text style={styles.guidelineTitle}>{item.title}</Text>
                          <Text style={styles.guidelineBody}>{item.body}</Text>
                        </View>
                      </View>
                    ))}

                    <Text style={styles.guidelineFooter}>
                      Questions? Reach out to the PUSO Spaze team. We\'re here to help.
                    </Text>
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setShowPrivacy(false)}
                    activeOpacity={0.87}
                    style={styles.modalCloseBtn}
                  >
                    <Text style={styles.modalCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* ── Online counter ── */}
            {onlineCount !== null && onlineCount > 0 && (
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>
                  {onlineCount.toLocaleString()} {onlineCount === 1 ? 'SOUL' : 'SOULS'} ONLINE NOW
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
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
    paddingTop: 56,
    paddingBottom: 40,
  },

  // ── Logo ────────────────────────────────────
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: 'rgba(129,73,166,0.3)',
    overflow: 'hidden',
    shadowColor: colors.fuchsia,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  logo: {
    width: 124,
    height: 124,
    borderRadius: 62,
  },

  // ── Title & Tagline ─────────────────────────
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: colors.subtle,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },

  // ── Card ────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
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
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.heading,
    letterSpacing: 2,
    marginBottom: 16,
  },

  // ── Anonymous preview ───────────────────────
  anonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  anonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.lightFuchsia}40`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  anonInfo: {
    flex: 1,
  },
  anonName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.heading,
  },
  anonHint: {
    fontSize: 12,
    color: colors.subtle,
    marginTop: 2,
    lineHeight: 17,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Inputs ──────────────────────────────────
  inputWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: colors.fuchsia,
    backgroundColor: colors.canvas,
  },
  input: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 14,
  },
  codeInput: {
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },

  // ── CTA Button ──────────────────────────────
  ctaWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 20,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },

  // ── Legal / Footer ──────────────────────────
  legalText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.subtle,
    lineHeight: 20,
    marginBottom: 28,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 28,
  },
  footerLink: {
    fontSize: 14,
    color: colors.subtle,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.heading,
  },

  // ── Guidelines Modal ────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24 }
      : { elevation: 12 }),
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.heading,
    marginTop: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  guidelineRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 12,
  },
  guidelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  guidelineContent: {
    flex: 1,
  },
  guidelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 4,
  },
  guidelineBody: {
    fontSize: 13,
    color: colors.subtle,
    lineHeight: 19,
  },
  guidelineFooter: {
    fontSize: 13,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});

