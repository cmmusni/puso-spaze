// ─────────────────────────────────────────────
// screens/PostScreen.tsx
// Submit a prayer or word of encouragement
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Modal,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  colors as defaultColors,
  fonts,
  radii,
  ambientShadow,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { usePosts } from "../hooks/usePosts";
import { useUser } from "../hooks/useUser";
import { useUserStore } from "../context/UserContext";
import { validatePostContent } from "../utils/validators";
import { apiSearchUsers, getBaseUrl } from "../services/api";
import {
  extractTrailingMentionQuery,
  replaceTrailingMention,
} from "../utils/mentions";
import { PrayIcon } from "../components/ReactionIcons";
import type { MentionUser } from "../../../packages/types";

// Gradient avatar (same logic as PostDetailScreen)
function avatarColors(initial: string): [string, string] {
  const palette: [string, string][] = [
    [defaultColors.hot, defaultColors.primary],
    [defaultColors.primary, defaultColors.deep],
    [defaultColors.fuchsia, defaultColors.ink],
    [defaultColors.ink, defaultColors.deep],
    [defaultColors.hot, defaultColors.fuchsia],
  ];
  return palette[initial.charCodeAt(0) % palette.length];
}

const FEELING_OPTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "grateful", emoji: "\u{1F60A}", label: "Grateful" },
  { key: "prayerful", emoji: "\u{1F64F}", label: "Prayerful" },
  { key: "strong", emoji: "\u{1F4AA}", label: "Strong" },
  { key: "struggling", emoji: "\u{1F622}", label: "Struggling" },
  { key: "hopeful", emoji: "\u{1F917}", label: "Hopeful" },
  { key: "heavy-hearted", emoji: "\u{1F614}", label: "Heavy-hearted" },
  { key: "blessed", emoji: "\u2728", label: "Blessed" },
  { key: "loved", emoji: "\u2764\uFE0F", label: "Loved" },
];

const CATEGORY_OPTIONS: {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { key: "prayer", icon: "hand-left-outline", label: "Prayer Request" },
  { key: "encouragement", icon: "sunny-outline", label: "Encouragement" },
  { key: "testimony", icon: "megaphone-outline", label: "Testimony" },
  { key: "question", icon: "help-circle-outline", label: "Question" },
  { key: "reflection", icon: "book-outline", label: "Reflection" },
];

export default function PostScreen() {
  const navigation = useNavigation();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, username, avatarUrl } = useUser();
  const { isAnonymous } = useUserStore();
  const { submitPost } = usePosts();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === "web" && screenWidth >= 900;

  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [feelingPickerVisible, setFeelingPickerVisible] = useState(false);
  const [visibility, setVisibility] = useState<"shared" | "anonymous">(
    isAnonymous ? "anonymous" : "shared",
  );
  const [visibilityMenuVisible, setVisibilityMenuVisible] = useState(false);

  const MAX_CHARS = 500;
  const canSubmit = !loading && content.trim().length >= 3;

  const userInitial = (username ?? "A").charAt(0).toUpperCase();

  // Build final tags from toggles + feeling
  const buildTags = useCallback(() => {
    const result: string[] = [];
    if (selectedCategory) result.push(selectedCategory);
    if (selectedFeeling) result.push(selectedFeeling);
    return result.length > 0 ? result : undefined;
  }, [selectedCategory, selectedFeeling]);

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

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    setMentionQuery(extractTrailingMentionQuery(text));
  }, []);

  const handleSelectMention = useCallback((mentionHandle: string) => {
    setContent((prev) => replaceTrailingMention(prev, mentionHandle));
    setMentionQuery(null);
    setMentionUsers([]);
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }
    if (!userId) {
      Alert.alert("Session Error", "User not found. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const { flagged, underReview, postId: newPostId } = await submitPost({
        userId,
        content: content.trim(),
        tags: buildTags(),
        isAnonymous: visibility === "anonymous",
        imageUri: imageUri ?? undefined,
      });
      if (flagged) {
        setErrorMsg(
          "Your message was flagged by our safety system. Please revise and resubmit.",
        );
      } else if (underReview) {
        setReviewMsg(
          "Your post is under review and will appear in the feed shortly.",
        );
        setTimeout(() => navigation.goBack(), 2800);
      } else {
        setContent("");
        setTags([]);
        setImageUri(null);
        setSelectedCategory(null);
        setSelectedFeeling(null);
        (navigation as any).navigate("Home", { highlightPostId: newPostId });
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to submit post.",
      );
    } finally {
      setLoading(false);
    }
  };

  const feelingObj = selectedFeeling
    ? FEELING_OPTIONS.find((f) => f.key === selectedFeeling)
    : null;

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>PUSO Spaze</Text>
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          style={styles.postBtnWrap}
        >
          <LinearGradient
            colors={
              canSubmit
                ? [colors.primaryContainer, colors.primary]
                : [colors.muted2, colors.muted4]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.postBtn}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.contentColumn, isWide && styles.contentColumnWide]}
          >
            {/* ── Writing card ── */}
            <View style={styles.writingCard}>
              <View style={styles.writerRow}>
                {visibility === "anonymous" ? (
                  <LinearGradient
                    colors={avatarColors(userInitial)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.writerAvatar}
                  >
                    <Text style={styles.writerAvatarText}>?</Text>
                  </LinearGradient>
                ) : avatarUrl ? (
                  <Image
                    source={{ uri: `${getBaseUrl()}${avatarUrl}` }}
                    style={styles.writerAvatar}
                  />
                ) : (
                  <LinearGradient
                    colors={avatarColors(userInitial)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.writerAvatar}
                  >
                    <Text style={styles.writerAvatarText}>{userInitial}</Text>
                  </LinearGradient>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder="What's on your heart?"
                  placeholderTextColor={colors.muted4}
                  value={content}
                  onChangeText={handleContentChange}
                  multiline
                  maxLength={MAX_CHARS}
                  editable={!loading}
                />
              </View>

              {/* ── Image preview inside card ── */}
              {imageUri && (
                <View style={styles.imagePreviewWrap}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => setImageUri(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={26}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Mention suggestions (inside card) ── */}
              {mentionQuery && (mentionLoading || mentionUsers.length > 0) && (
                <View style={styles.mentionBox}>
                  {mentionLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    mentionUsers.map((user) => {
                      const initials = user.displayName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <TouchableOpacity
                          key={user.id}
                          style={styles.mentionItem}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleSelectMention(user.mentionHandle)
                          }
                        >
                          <Ionicons
                            name="at"
                            size={16}
                            color={colors.muted4}
                            style={styles.mentionAtIcon}
                          />
                          <LinearGradient
                            colors={avatarColors(initials.charAt(0) || "A")}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.mentionAvatar}
                          >
                            <Text style={styles.mentionAvatarText}>
                              {initials}
                            </Text>
                          </LinearGradient>
                          <Text style={styles.mentionHandle}>
                            {user.mentionHandle}
                          </Text>
                          <Text style={styles.mentionSuggested}>Suggested</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* ── Actions card ── */}
            <View style={styles.actionsCard}>
              {/* Add Image + Feeling row */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1 }]}
                  onPress={pickImage}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons name="image" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.actionBtnText}>Add Image</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { flex: 1 },
                    !!selectedFeeling && styles.toggleBtnActive,
                  ]}
                  onPress={() => setFeelingPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.actionIconCircle,
                      !!selectedFeeling && styles.actionIconCircleActive,
                    ]}
                  >
                    <Ionicons
                      name="happy"
                      size={18}
                      color={
                        selectedFeeling ? colors.onPrimary : colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.actionBtnText,
                      !!selectedFeeling && styles.toggleBtnTextActive,
                    ]}
                  >
                    {feelingObj
                      ? `${feelingObj.emoji} ${feelingObj.label}`
                      : "Feeling"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.actionDivider} />

              {/* Category label */}
              <Text style={styles.actionSectionLabel}>CATEGORY</Text>

              {/* Category toggles */}
              <View style={styles.actionToggleRow}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.toggleBtn,
                        isActive && styles.toggleBtnActive,
                      ]}
                      onPress={() =>
                        setSelectedCategory(isActive ? null : cat.key)
                      }
                      activeOpacity={0.8}
                    >
                      {cat.key === "prayer" ? (
                        <PrayIcon
                          size={16}
                          color={isActive ? colors.onPrimary : colors.secondary}
                        />
                      ) : (
                        <Ionicons
                          name={cat.icon}
                          size={16}
                          color={isActive ? colors.onPrimary : colors.secondary}
                        />
                      )}
                      <Text
                        style={[
                          styles.toggleBtnText,
                          isActive && styles.toggleBtnTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Visibility card ── */}
            <TouchableOpacity
              style={styles.visibilityCard}
              onPress={() => setVisibilityMenuVisible(true)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.visibilityLabel}>VISIBILITY</Text>
                <View style={styles.visibilityRow}>
                  <Ionicons
                    name={
                      visibility === "shared"
                        ? "globe-outline"
                        : "eye-off-outline"
                    }
                    size={18}
                    color={colors.onSurface}
                  />
                  <Text style={styles.visibilityText}>
                    {visibility === "shared" ? "Shared Spaze" : "Anonymous"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.muted4} />
            </TouchableOpacity>

            {/* ── Error message ── */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons
                  name="warning-outline"
                  size={16}
                  color={colors.errorText}
                />
                <Text style={styles.errorMsg}>{errorMsg}</Text>
              </View>
            )}

            {/* ── Under-review notice ── */}
            {reviewMsg && (
              <View style={styles.reviewBox}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={colors.warningText}
                />
                <Text style={styles.reviewMsg}>{reviewMsg}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Feeling picker modal ── */}
      <Modal
        visible={feelingPickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFeelingPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFeelingPickerVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalSheet}
          >
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <View style={styles.feelingGrid}>
              {FEELING_OPTIONS.map((f) => {
                const isActive = selectedFeeling === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.feelingOption,
                      isActive && styles.feelingOptionActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedFeeling(isActive ? null : f.key);
                      setFeelingPickerVisible(false);
                    }}
                  >
                    <Text style={styles.feelingEmoji}>{f.emoji}</Text>
                    <Text
                      style={[
                        styles.feelingLabel,
                        isActive && styles.feelingLabelActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedFeeling && (
              <TouchableOpacity
                style={styles.feelingClearBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedFeeling(null);
                  setFeelingPickerVisible(false);
                }}
              >
                <Text style={styles.feelingClearText}>Clear feeling</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Visibility picker modal ── */}
      <Modal
        visible={visibilityMenuVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisibilityMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setVisibilityMenuVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalSheet}
          >
            <Text style={styles.modalTitle}>Post visibility</Text>
            <TouchableOpacity
              style={[
                styles.visibilityOption,
                visibility === "shared" && styles.visibilityOptionActive,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                setVisibility("shared");
                setVisibilityMenuVisible(false);
              }}
            >
              <Ionicons
                name="globe-outline"
                size={20}
                color={
                  visibility === "shared"
                    ? colors.primary
                    : colors.onSurfaceVariant
                }
              />
              <View style={styles.visibilityOptionTextWrap}>
                <Text
                  style={[
                    styles.visibilityOptionTitle,
                    visibility === "shared" &&
                      styles.visibilityOptionTitleActive,
                  ]}
                >
                  Shared Spaze
                </Text>
                <Text style={styles.visibilityOptionDesc}>
                  Your display name will be shown
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityOption,
                visibility === "anonymous" && styles.visibilityOptionActive,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                setVisibility("anonymous");
                setVisibilityMenuVisible(false);
              }}
            >
              <Ionicons
                name="eye-off-outline"
                size={20}
                color={
                  visibility === "anonymous"
                    ? colors.primary
                    : colors.onSurfaceVariant
                }
              />
              <View style={styles.visibilityOptionTextWrap}>
                <Text
                  style={[
                    styles.visibilityOptionTitle,
                    visibility === "anonymous" &&
                      styles.visibilityOptionTitleActive,
                  ]}
                >
                  Anonymous
                </Text>
                <Text style={styles.visibilityOptionDesc}>
                  Post without revealing your identity
                </Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const createStyles = (colors: typeof defaultColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // ── Header ───────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surfaceContainerLowest,
      gap: 12,
      width: "100%" as any,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerLogo: { width: 28, height: 28 },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.displayBold,
      color: colors.primary,
    },
    postBtnWrap: { borderRadius: radii.full, overflow: "hidden" },
    postBtn: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    postBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontFamily: fonts.displayBold,
    },

    // ── Body ─────────────────────────────────
    kav: { flex: 1, width: "100%" as any },
    scroll: { flexGrow: 1, paddingBottom: 40 },
    contentColumn: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
    contentColumnWide: {
      maxWidth: 680,
      width: "100%" as any,
      alignSelf: "center" as const,
    },

    // ── Writing card ─────────────────────────
    writingCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 20,
      marginBottom: 16,
      minHeight: 280,
      ...ambientShadow,
    },
    writerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    writerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    writerAvatarText: {
      color: colors.onPrimary,
      fontSize: 18,
      fontFamily: fonts.displayBold,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      fontFamily: fonts.bodyRegular,
      color: colors.onSurface,
      minHeight: 200,
      lineHeight: 26,
      textAlignVertical: "top",
      ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
    },

    // ── Mention box ──────────────────────────
    mentionBox: {
      marginTop: 12,
      gap: 8,
    },
    mentionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainerLow,
    },
    mentionAtIcon: { marginRight: 2 },
    mentionAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    mentionAvatarText: {
      color: colors.onPrimary,
      fontSize: 11,
      fontFamily: fonts.displayBold,
    },
    mentionHandle: {
      flex: 1,
      color: colors.onSurface,
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
    },
    mentionSuggested: {
      color: colors.muted4,
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
      fontStyle: "italic",
    },

    // ── Image preview ────────────────────────
    imagePreviewWrap: {
      borderRadius: radii.lg,
      overflow: "hidden",
      position: "relative",
      marginTop: 16,
    },
    imagePreview: {
      width: "100%" as any,
      height: 200,
      borderRadius: radii.lg,
    },
    imageRemoveBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: colors.card,
      borderRadius: 13,
    },

    // ── Actions card ─────────────────────────
    actionsCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 16,
      marginBottom: 16,
      gap: 10,
      ...ambientShadow,
    },
    actionBtnRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    actionIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryContainer + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    actionIconCircleActive: {
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    actionBtnText: {
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurface,
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant + "30",
      marginVertical: 2,
    },
    actionSectionLabel: {
      fontSize: 11,
      fontFamily: fonts.displayBold,
      color: colors.muted4,
      letterSpacing: 1,
    },
    actionToggleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    toggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.full,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    toggleBtnActive: {
      backgroundColor: colors.secondary,
    },
    toggleBtnText: {
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurfaceVariant,
    },
    toggleBtnTextActive: {
      color: colors.onPrimary,
    },

    // ── Visibility card ──────────────────────
    visibilityCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 18,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...ambientShadow,
    },
    visibilityLabel: {
      fontSize: 11,
      fontFamily: fonts.displayBold,
      color: colors.muted4,
      letterSpacing: 1,
      marginBottom: 4,
    },
    visibilityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    visibilityText: {
      fontSize: 16,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurface,
    },

    // ── Banners ─────────────────────────────
    errorBox: {
      backgroundColor: colors.errorBg,
      borderRadius: radii.lg,
      padding: 14,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    reviewBox: {
      backgroundColor: colors.warningBg,
      borderRadius: radii.lg,
      padding: 14,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    errorMsg: {
      color: colors.errorText,
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      flex: 1,
      lineHeight: 20,
    },
    reviewMsg: {
      color: colors.warningText,
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      flex: 1,
      lineHeight: 20,
    },

    // ── Modals ───────────────────────────────
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: 20,
      gap: 12,
      width: "90%",
      maxWidth: 360,
      ...ambientShadow,
    },
    modalTitle: {
      color: colors.onSurface,
      fontSize: 18,
      fontFamily: fonts.displayBold,
      marginBottom: 4,
    },

    // ── Feeling picker ───────────────────────
    feelingGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    feelingOption: {
      alignItems: "center",
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      width: "31%",
    },
    feelingOptionActive: {
      backgroundColor: colors.primaryContainer + "30",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    feelingEmoji: { fontSize: 24, marginBottom: 4 },
    feelingLabel: {
      fontSize: 12,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurfaceVariant,
    },
    feelingLabelActive: {
      color: colors.primary,
    },
    feelingClearBtn: {
      alignSelf: "center",
      paddingVertical: 10,
    },
    feelingClearText: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: fonts.bodySemiBold,
    },

    // ── Visibility picker ────────────────────
    visibilityOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    visibilityOptionActive: {
      backgroundColor: colors.primaryContainer + "20",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    visibilityOptionTextWrap: { flex: 1 },
    visibilityOptionTitle: {
      fontSize: 15,
      fontFamily: fonts.bodySemiBold,
      color: colors.onSurface,
    },
    visibilityOptionTitleActive: {
      color: colors.primary,
    },
    visibilityOptionDesc: {
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
      color: colors.muted4,
      marginTop: 2,
    },
  });
