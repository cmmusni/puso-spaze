// ─────────────────────────────────────────────
// screens/PostScreen.tsx
// Submit a prayer or word of encouragement
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { usePosts } from '../hooks/usePosts';
import { useUser } from '../hooks/useUser';
import { validatePostContent } from '../utils/validators';
import { apiSearchUsers } from '../services/api';
import { extractTrailingMentionQuery, replaceTrailingMention } from '../utils/mentions';
import type { MentionUser } from '../../../packages/types';

export default function PostScreen() {
  const navigation = useNavigation();
  const { userId, username } = useUser();
  const { submitPost } = usePosts();

  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const MAX_CHARS = 500;
  const charsLeft = MAX_CHARS - content.length;
  const canSubmit = !loading && content.trim().length >= 3;
  const MAX_TAGS = 5;

  useEffect(() => {
    let active = true;

    if (!mentionQuery || mentionQuery.length < 1) {
      setMentionUsers([]);
      setMentionLoading(false);
      return () => {
        active = false;
      };
    }

    setMentionLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { users } = await apiSearchUsers(mentionQuery, 6);
        if (active) {
          setMentionUsers(users);
        }
      } catch {
        if (active) {
          setMentionUsers([]);
        }
      } finally {
        if (active) {
          setMentionLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  const handleContentChange = (text: string) => {
    setContent(text);
    const nextMentionQuery = extractTrailingMentionQuery(text);
    setMentionQuery(nextMentionQuery);
  };

  const handleSelectMention = (mentionHandle: string) => {
    setContent((prev) => replaceTrailingMention(prev, mentionHandle));
    setMentionQuery(null);
    setMentionUsers([]);
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.length >= MAX_TAGS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_TAGS} tags.`);
      return;
    }
    if (tags.includes(trimmed)) {
      Alert.alert('Duplicate', 'This tag is already added.');
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setReviewMsg(null);
    const validationErr = validatePostContent(content);
    if (validationErr) { setErrorMsg(validationErr); return; }
    if (!userId) { Alert.alert('Session Error', 'User not found. Please log in again.'); return; }

    setLoading(true);
    try {
      const { flagged, underReview } = await submitPost({ 
        userId, 
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
        imageUri: imageUri ?? undefined,
      });
      if (flagged) {
        setErrorMsg(
          'Your message was flagged by our safety system. Please revise and resubmit.'
        );
      } else if (underReview) {
          setReviewMsg('Your post is under review and will appear in the feed shortly.');
        setTimeout(() => navigation.goBack(), 2800);
      } else {
        setContent('');
        setTags([]);
        setTagInput('');
        setImageUri(null);
        navigation.goBack();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={[colors.darkest, colors.deep, colors.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back-outline" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>Back to feed</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="heart-outline" size={22} color={colors.card} />
          <Text style={styles.headerTitle}>Share Your Heart</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Posting as{' '}
          <Text style={styles.headerName}>{username ?? 'Anonymous'}</Text>
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Writing card ── */}
          <View style={[styles.writingCard, focused ? styles.writingCardFocused : styles.writingCardDefault]}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Lord, I pray for peace in our community…"
              placeholderTextColor={colors.muted4}
              value={content}
              onChangeText={handleContentChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              maxLength={MAX_CHARS}
              editable={!loading}
            />
          </View>

          {mentionQuery && (mentionLoading || mentionUsers.length > 0) && (
            <View style={styles.mentionBox}>
              {mentionLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                mentionUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.mentionItem}
                    activeOpacity={0.8}
                    onPress={() => handleSelectMention(user.mentionHandle)}
                  >
                    <Text style={styles.mentionHandle}>@{user.mentionHandle}</Text>
                    <Text style={styles.mentionName}>{user.displayName}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ── Character counter ── */}
          <Text style={[styles.charCounter, charsLeft < 50 ? styles.charCounterWarn : styles.charCounterDefault]}>
            {charsLeft}/{MAX_CHARS}
          </Text>

          {/* ── Image picker ── */}
          <View style={styles.imageSection}>
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageUri(null)} activeOpacity={0.8}>
                  <Ionicons name="close-circle" size={26} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} activeOpacity={0.8} disabled={loading}>
                <Ionicons name="image-outline" size={22} color={colors.primary} />
                <Text style={styles.imagePickerText}>Add Photo (optional)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Tags input ── */}
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>📌 Tags (optional, up to {MAX_TAGS})</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="e.g. wellness, prayer, support"
                placeholderTextColor={colors.muted4}
                value={tagInput}
                onChangeText={setTagInput}
                editable={!loading && tags.length < MAX_TAGS}
              />
              <TouchableOpacity
                onPress={addTag}
                disabled={!tagInput.trim() || loading || tags.length >= MAX_TAGS}
                style={[styles.addTagBtn, (!tagInput.trim() || tags.length >= MAX_TAGS) && styles.addTagBtnDisabled]}
              >
                <Text style={styles.addTagBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsList}>
                {tags.map((tag, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => removeTag(idx)}
                    style={styles.tag}
                  >
                    <View style={styles.tagRow}>
                      <Text style={styles.tagText}>{tag}</Text>
                      <Ionicons name="close" size={12} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Error message ── */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={colors.errorText} />
              <Text style={styles.errorMsg}>{errorMsg}</Text>
            </View>
          )}

          {/* ── Under-review notice ── */}
          {reviewMsg && (
            <View style={styles.reviewBox}>
              <Ionicons name="search-outline" size={16} color={colors.warningText} />
              <Text style={styles.reviewMsg}>{reviewMsg}</Text>
            </View>
          )}

          {/* ── Submit ── */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.87}
            style={styles.submitBtn}
          >
            <LinearGradient
              colors={canSubmit ? [colors.hot, colors.fuchsia, colors.ink, colors.deep] : [colors.muted2, colors.muted4]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.submitRow}>
                  <Ionicons name="sparkles-outline" size={16} color={colors.card} />
                  <Text style={styles.submitText}>Post</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Safety notice ── */}
          <View style={styles.safetyBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.ink} />
            <Text style={styles.safetyText}>
              All posts are reviewed by AI before publishing.{' '}
              Content promoting harm will not be shared.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  // ── Header ───────────────────────────────
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.card,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  headerName: { color: colors.accent, fontWeight: '700' },

  // ── Body ─────────────────────────────────
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  writingCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 2,
  },
  writingCardDefault: { borderColor: colors.muted3 },
  writingCardFocused: { borderColor: colors.fuchsia },
  textInput: {
    fontSize: 16,
    color: colors.heading,
    minHeight: 180,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
  mentionBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.muted3,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  mentionItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.muted3,
  },
  mentionHandle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  mentionName: {
    color: colors.muted5,
    fontSize: 12,
    marginTop: 2,
  },
  charCounter: { textAlign: 'right', fontSize: 12, fontWeight: '600', marginBottom: 16 },
  charCounterDefault: { color: colors.muted5 },
  charCounterWarn: { color: colors.danger },

  // ── Image picker ─────────────────────────
  imageSection: { marginBottom: 16 },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.muted3,
    borderStyle: 'dashed',
  },
  imagePickerText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  imagePreviewWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', height: 200, borderRadius: 16 },
  imageRemoveBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.card, borderRadius: 13 },

  // ── Tags ─────────────────────────────────
  tagsSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.muted3,
  },
  tagsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.heading,
    marginBottom: 10,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.heading,
  },
  addTagBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagBtnDisabled: {
    backgroundColor: colors.muted4,
  },
  addTagBtnText: {
    fontSize: 20,
    color: colors.card,
    fontWeight: '700',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    backgroundColor: colors.lightPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // ── Banners ─────────────────────────────
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reviewBox: {
    backgroundColor: colors.warningBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorMsg: { color: colors.errorText, fontSize: 13, flex: 1, lineHeight: 20 },
  reviewMsg: { color: colors.warningText, fontSize: 13, flex: 1, lineHeight: 20 },

  // ── Submit button ─────────────────────────
  submitBtn: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  submitGradient: { paddingVertical: 18, alignItems: 'center', borderRadius: 20 },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submitText: { color: colors.card, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // ── Safety notice ────────────────────────
  safetyBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  safetyText: { fontSize: 12, color: colors.ink, flex: 1, lineHeight: 18 },
});
