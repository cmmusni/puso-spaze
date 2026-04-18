// ─────────────────────────────────────────────
// screens/ProfileScreen.tsx
// User profile — Spaze social profile design
// ─────────────────────────────────────────────

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
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
  Switch,
  Image,
  Modal,
  Linking,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import {
  colors as defaultColors,
  fonts,
  spacing,
  radii,
  ambientShadow,
} from "../constants/theme";
import { useUserStore } from "../context/UserContext";
import { useThemeStore } from "../context/ThemeContext";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import {
  apiUpdateUsername,
  apiUpdateBio,
  apiGetContacts,
  apiUpdateContacts,
  apiUploadAvatar,
  apiUploadBanner,
  apiGetPin,
  apiUpdatePin,
  apiGetUserStats,
  apiGetOrCreateConversation,
  apiGetUserById,
  getBaseUrl,
  resolveAvatarUrl,
  apiFetchPublicJournals,
} from "../services/api";
import { usePosts } from "../hooks/usePosts";
import { useScrollBarVisibility } from "../hooks/useScrollBarVisibility";
import PostCard from "../components/PostCard";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";
import type { Journal, ContactInfo } from "../../../packages/types";

type Nav = DrawerNavigationProp<MainDrawerParamList>;
type ProfileRoute = RouteProp<MainDrawerParamList, "Profile">;

const ROLE_LABELS: Record<string, string> = {
  USER: "Member",
  COACH: "Coach",
  ADMIN: "Admin",
};

const BIO_DEFAULT =
  "Embracing the journey of self-discovery one reflection at a time. Safe in the sanctuary.";

const ABOUT_ME_LABEL = "ABOUT ME";

const PROFILE_TABS = ["TIMELINE", "ABOUT", "CONTACT", "PREFERENCES"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const CONTACT_FIELDS = [
  { key: "phone", icon: "call-outline", label: "Phone", placeholder: "+1 234 567 8900", scheme: "tel:" },
  { key: "contactEmail", icon: "mail-outline", label: "Email", placeholder: "you@example.com", scheme: "mailto:" },
  { key: "facebook", icon: "logo-facebook", label: "Facebook", placeholder: "facebook.com/username", scheme: "" },
  { key: "instagram", icon: "logo-instagram", label: "Instagram", placeholder: "@yourusername", scheme: "" },
  { key: "linkedin", icon: "logo-linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you", scheme: "" },
  { key: "twitter", icon: "logo-twitter", label: "Twitter / X", placeholder: "@yourusername", scheme: "" },
  { key: "tiktok", icon: "musical-notes-outline", label: "TikTok", placeholder: "@yourusername", scheme: "" },
  { key: "youtube", icon: "logo-youtube", label: "YouTube", placeholder: "youtube.com/@channel", scheme: "" },
  { key: "website", icon: "globe-outline", label: "Website", placeholder: "yourwebsite.com", scheme: "" },
] as const;

/** Pure date formatter — no component deps, safe to hoist */
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ProfileRoute>();
  const {
    username,
    userId,
    role,
    avatarUrl,
    bannerUrl,
    bio,
    contacts,
    isAnonymous,
    notificationsEnabled,
    updateUsername,
    updateAvatarUrl,
    updateBannerUrl,
    updateBio,
    updateContacts,
    logoutUser,
    toggleAnonymous,
    toggleNotifications,
  } = useUserStore();

  // ── Determine which user to show ──────────
  const routeUserId = route.params?.userId;
  const isOwner = !routeUserId || routeUserId === userId;
  const profileUserId = isOwner ? userId : routeUserId;
  const { isDark, toggleDarkMode } = useThemeStore();
  const colors = useThemeStore((s) => s.colors);
  const s = useMemo(() => createStyles(colors), [colors]);
  const { posts, fetchPosts } = usePosts();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMedium = width < 900 && width >= 600;
  const isSmall = width < 600;

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToTopTrigger = useScrollBarVisibility(
    (s) => s.scrollToTopTrigger,
  );
  const scrollToTopRef = useRef(scrollToTopTrigger);
  useEffect(() => {
    if (
      scrollToTopTrigger > 0 &&
      scrollToTopTrigger !== scrollToTopRef.current
    ) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
    scrollToTopRef.current = scrollToTopTrigger;
  }, [scrollToTopTrigger]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [encouragementsGiven, setEncouragementsGiven] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [streak, setStreak] = useState(0);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // ── Edit username state ───────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username ?? "");
  const [savingUsername, setSavingUsername] = useState(false);

  // ── Avatar upload state ───────────────────
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);

  // ── Banner upload state ───────────────────
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // ── Bio edit state ────────────────────────
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(bio ?? BIO_DEFAULT);
  const [savingBio, setSavingBio] = useState(false);

  // ── Contacts edit state ───────────────────
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [editedContacts, setEditedContacts] = useState<ContactInfo>(
    contacts ?? {},
  );
  const [savingContacts, setSavingContacts] = useState(false);

  // ── Coach chat state ─────────────────────
  const [startingCoachChat, setStartingCoachChat] = useState(false);

  // ── PIN state ─────────────────────────────
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editedPin, setEditedPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  // ── Tab state ─────────────────────────────
  const [activeTab, setActiveTab] = useState<ProfileTab>("TIMELINE");

  // ── Other user profile data ───────────────
  const [otherUser, setOtherUser] = useState<{
    displayName: string;
    role: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    createdAt: string;
    phone?: string | null;
    contactEmail?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    tiktok?: string | null;
    youtube?: string | null;
    website?: string | null;
  } | null>(null);

  // ── Resolved profile values (owner vs other) ──
  const displayName = isOwner ? (username ?? "User") : (otherUser?.displayName ?? "User");
  const profileRole = isOwner ? role : otherUser?.role;
  const profileAvatarUrl = isOwner ? avatarUrl : otherUser?.avatarUrl;
  const profileBannerUrl = isOwner ? bannerUrl : otherUser?.bannerUrl;
  const profileBio = isOwner ? bio : otherUser?.bio;
  const profileContacts: ContactInfo = isOwner
    ? (contacts ?? {})
    : {
        phone: otherUser?.phone,
        contactEmail: otherUser?.contactEmail,
        facebook: otherUser?.facebook,
        instagram: otherUser?.instagram,
        linkedin: otherUser?.linkedin,
        twitter: otherUser?.twitter,
        tiktok: otherUser?.tiktok,
        youtube: otherUser?.youtube,
        website: otherUser?.website,
      };
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[profileRole ?? "USER"] ?? "Spaze Member";

  // ── Responsive avatar size ────────────────
  const avatarSize = isMedium ? 100 : 88;

  // ── Load data ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      await fetchPosts();
      if (profileUserId) {
        const fetches: Promise<any>[] = [
          apiFetchPublicJournals(profileUserId),
          apiGetUserStats(profileUserId).catch(() => ({
            encouragementsGiven: 0,
            totalReflections: 0,
            streak: 0,
            createdAt: null,
          })),
        ];
        if (isOwner) {
          fetches.push(
            apiGetPin(profileUserId).catch(() => ({ pin: null })),
            apiGetContacts(profileUserId).catch(() => ({ contacts: {} })),
          );
        } else {
          fetches.push(
            apiGetUserById(profileUserId).catch(() => ({ user: null })),
          );
        }
        const results = await Promise.all(fetches);
        const journalRes = results[0];
        const statsRes = results[1];
        setJournals(journalRes.journals);
        setEncouragementsGiven(statsRes.encouragementsGiven);
        setTotalReflections(statsRes.totalReflections);
        setStreak(statsRes.streak);
        setCreatedAt(statsRes.createdAt ?? "");
        if (isOwner) {
          const pinRes = results[2];
          const contactsRes = results[3];
          setPinCode(pinRes.pin);
          await updateContacts(contactsRes.contacts);
          setEditedContacts(contactsRes.contacts);
        } else {
          const userRes = results[2];
          if (userRes.user) setOtherUser(userRes.user);
        }
      }
    } catch (err) {
      console.warn("[ProfileScreen] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPosts, profileUserId, isOwner]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Stats ─────────────────────────────────
  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === profileUserId),
    [posts, profileUserId],
  );

  const handlePostDeleted = useCallback(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ── Banner upload ─────────────────────────
  const handlePickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.uri || !userId) return;

    setUploadingBanner(true);
    try {
      const { bannerUrl: newUrl } = await apiUploadBanner(
        userId,
        result.assets[0].uri,
      );
      await updateBannerUrl(newUrl);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to upload banner.";
      showAlert("Error", msg);
    } finally {
      setUploadingBanner(false);
    }
  };

  // ── Avatar upload ─────────────────────────
  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri || !userId) return;

    setUploadingAvatar(true);
    try {
      const { avatarUrl: newUrl } = await apiUploadAvatar(
        userId,
        result.assets[0].uri,
      );
      await updateAvatarUrl(newUrl);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to upload avatar.";
      showAlert("Error", msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Username editing ──────────────────────
  const handleEditProfile = () => {
    setEditedUsername(username ?? "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedUsername(username ?? "");
  };

  const handleSaveUsername = async () => {
    if (!editedUsername.trim()) {
      showAlert("Invalid", "Username cannot be empty.");
      return;
    }
    if (editedUsername === username) {
      setIsEditing(false);
      return;
    }
    if (!userId) {
      showAlert("Error", "User session not found.");
      return;
    }
    setSavingUsername(true);
    try {
      await apiUpdateUsername(userId, editedUsername);
      await updateUsername(editedUsername);
      showAlert("Success", `Username updated to "${editedUsername}".`);
      setIsEditing(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Failed to update username.";
      showAlert("Error", msg);
    } finally {
      setSavingUsername(false);
    }
  };

  // ── Bio editing ───────────────────────────
  const handleEditBio = () => {
    setEditedBio(bio ?? BIO_DEFAULT);
    setIsEditingBio(true);
  };

  const handleCancelBio = () => {
    setIsEditingBio(false);
    setEditedBio(bio ?? BIO_DEFAULT);
  };

  const handleSaveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    try {
      const res = await apiUpdateBio(userId, editedBio);
      await updateBio(res.bio);
      setIsEditingBio(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? err?.message ?? "Failed to update bio.";
      showAlert("Error", msg);
    } finally {
      setSavingBio(false);
    }
  };

  // ── Coach chat ───────────────────────────
  const handleMessageCoach = async (coachId: string) => {
    if (!userId) return;
    setStartingCoachChat(true);
    try {
      const res = await apiGetOrCreateConversation({ userId, coachId });
      navigation.navigate("Chat" as any, {
        conversationId: res.conversation.id,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? err?.message ?? "Could not open chat.";
      showAlert("Error", msg);
    } finally {
      setStartingCoachChat(false);
    }
  };

  // ── Contacts editing ──────────────────────
  const handleEditContacts = () => {
    setEditedContacts(contacts ?? {});
    setIsEditingContacts(true);
  };

  const handleCancelContacts = () => {
    setIsEditingContacts(false);
    setEditedContacts(contacts ?? {});
  };

  const handleSaveContacts = async () => {
    if (!userId) return;
    setSavingContacts(true);
    try {
      const res = await apiUpdateContacts(userId, editedContacts);
      await updateContacts(res.contacts);
      setIsEditingContacts(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        "Failed to update contacts.";
      showAlert("Error", msg);
    } finally {
      setSavingContacts(false);
    }
  };

  // ── PIN editing ───────────────────────────
  const handleEditPin = () => {
    setEditedPin(pinCode ?? "");
    setIsEditingPin(true);
  };

  const handleCancelPin = () => {
    setIsEditingPin(false);
    setEditedPin("");
  };

  const handleSavePin = async () => {
    if (!/^\d{6}$/.test(editedPin)) {
      showAlert("Invalid PIN", "PIN must be exactly 6 digits.");
      return;
    }
    if (editedPin === pinCode) {
      setIsEditingPin(false);
      return;
    }
    if (!userId) {
      showAlert("Error", "User session not found.");
      return;
    }
    setSavingPin(true);
    try {
      const res = await apiUpdatePin(userId, editedPin);
      setPinCode(res.pin);
      showAlert("Success", "PIN updated successfully.");
      setIsEditingPin(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? err?.message ?? "Failed to update PIN.";
      showAlert("Error", msg);
    } finally {
      setSavingPin(false);
    }
  };

  const resolvedAvatarUri = useMemo(
    () => resolveAvatarUrl(profileAvatarUrl) || null,
    [profileAvatarUrl],
  );
  const resolvedBannerUri = useMemo(
    () => resolveAvatarUrl(profileBannerUrl) || null,
    [profileBannerUrl],
  );

  // ═══════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView
        style={[s.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={s.scrollContent}
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
        {/* ── Gradient Banner ── */}
        <View style={[s.bannerWrap, isWide && s.bannerWrapWide]}>
          {resolvedBannerUri ? (
            <Image
              source={{ uri: resolvedBannerUri }}
              style={[s.banner, isWide && s.bannerWide]}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={
                isWide
                  ? [colors.primaryContainer, colors.secondary]
                  : [colors.primary, colors.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={isWide ? { x: 0, y: 1 } : { x: 1, y: 1 }}
              style={[s.banner, isWide && s.bannerWide]}
            />
          )}
          {uploadingBanner && (
            <View style={s.bannerUploadOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </View>

        {/* ── Profile Info (overlaps banner) ── */}
        <View
          style={[
            s.profileSectionBase,
            isMedium && s.profileSectionMedium,
            isSmall && s.profileSectionSmall,
          ]}
        >
          {isOwner && (
            <TouchableOpacity
              onPress={handlePickBanner}
              disabled={uploadingBanner}
              style={[s.bannerCameraBtn]}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={[s.profileHeader, isMedium && s.profileHeaderMedium]}>
            {/* Avatar */}
            <TouchableOpacity
              onPress={() => {
                if (resolvedAvatarUri) setAvatarPreviewVisible(true);
              }}
              activeOpacity={resolvedAvatarUri ? 0.7 : 1}
              style={s.avatarOuter}
            >
              <View
                style={[
                  s.avatarFrame,
                  { width: avatarSize, height: avatarSize },
                ]}
              >
                {resolvedAvatarUri ? (
                  <Image
                    source={{ uri: resolvedAvatarUri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[
                      colors.surfaceContainerHigh,
                      colors.surfaceVariant,
                    ]}
                    style={[
                      StyleSheet.absoluteFillObject,
                      s.avatarPlaceholder,
                    ]}
                  >
                    <Text
                      style={[
                        s.avatarInitial,
                        {
                          color: colors.onSurface,
                          fontSize: avatarSize * 0.38,
                        },
                      ]}
                    >
                      {initial}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View style={[s.onlineDot, { borderColor: colors.card }]} />
              {uploadingAvatar && (
                <View style={s.avatarUploadOverlay}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                </View>
              )}
              {/* Camera badge */}
              {isOwner && (
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  style={[
                    s.cameraBadge,
                    { backgroundColor: colors.primary, borderColor: colors.card },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={14} color={colors.onPrimary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Name + Actions */}
            <View style={s.profileMeta}>
              {isEditing ? (
                isMedium ? (
                  <View style={s.editRow}>
                    <TextInput
                      style={[
                        s.editInput,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          color: colors.onSurface,
                        },
                      ]}
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      placeholder="New username"
                      placeholderTextColor={colors.muted3}
                      editable={!savingUsername}
                      autoFocus
                    />
                    <View style={s.editActions}>
                      <TouchableOpacity
                        onPress={handleCancelEdit}
                        style={[s.cancelBtn, { borderColor: colors.outline }]}
                      >
                        <Text
                          style={[
                            s.cancelBtnText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveUsername}
                        disabled={savingUsername}
                        style={[s.saveBtn, { backgroundColor: colors.primary }]}
                      >
                        {savingUsername ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onPrimary}
                          />
                        ) : (
                          <Text
                            style={[s.saveBtnText, { color: colors.onPrimary }]}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={s.editRowMobile}>
                    <TextInput
                      style={[
                        s.editInputMobile,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          color: colors.onSurface,
                          borderColor: colors.primary,
                        },
                      ]}
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      placeholder="New username"
                      placeholderTextColor={colors.muted3}
                      editable={!savingUsername}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      style={[
                        s.editIconBtn,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outline,
                        },
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={17}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveUsername}
                      disabled={savingUsername}
                      style={[
                        s.editIconBtn,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      {savingUsername ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.onPrimary}
                        />
                      ) : (
                        <Ionicons
                          name="checkmark"
                          size={17}
                          color={colors.onPrimary}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                <>
                  <View style={s.nameActionRow}>
                    {isOwner ? (
                      <TouchableOpacity
                        onPress={handleEditProfile}
                        style={s.nameEditRow}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            s.displayName,
                            { color: colors.onSurface },
                            isMedium && s.displayNameMedium,
                          ]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <Ionicons
                          name="pencil"
                          size={isMedium ? 16 : 13}
                          color={colors.onSurfaceVariant}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={s.nameEditRow}>
                        <Text
                          style={[
                            s.displayName,
                            { color: colors.onSurface },
                            isMedium && s.displayNameMedium,
                          ]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                      </View>
                    )}
                    <View style={s.actionBtns}>
                      {isOwner && !isWide && (
                        <TouchableOpacity
                          onPress={logoutUser}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={isSmall ? s.signOutBtnMobile : s.signOutBtn}
                          >
                            {isSmall ? (
                              <Ionicons
                                name="log-out-outline"
                                size={16}
                                color={colors.onPrimary}
                              />
                            ) : (
                              <Text
                                style={[
                                  s.signOutBtnText,
                                  { color: colors.onPrimary },
                                ]}
                              >
                                Sign Out
                              </Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={s.badgeRow}>
                    <View
                      style={[
                        s.roleBadge,
                        { backgroundColor: colors.secondaryFixed },
                      ]}
                    >
                      <Text
                        style={[
                          s.roleBadgeText,
                          { color: colors.onSecondaryFixed },
                        ]}
                      >
                        {roleLabel}
                      </Text>
                    </View>
                    {createdAt && (
                      <View style={s.joinedRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            s.joinedText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Joined{" "}
                          {new Date(createdAt).toLocaleDateString([], {
                            month: "long",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Journey ── */}
        <View style={[s.statsSection, isWide && s.statsSectionWide]}>
          <View style={s.journeyHeading}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[s.journeyTitle, { color: colors.onSurface }]}>
              Journey
            </Text>
          </View>
          <View style={[s.statsRow, isMedium && s.statsRowMedium]}>
            <View style={[s.statCard, { backgroundColor: colors.card }]}>
              <Ionicons
                name="flame"
                size={24}
                color={colors.primary}
                style={s.statIcon}
              />
              <Text style={[s.statNumber, { color: colors.onSurface }]}>
                {streak} Day
              </Text>
              <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>
                Streak
              </Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card }]}>
              <Ionicons
                name="book"
                size={24}
                color={colors.secondary}
                style={s.statIcon}
              />
              <Text style={[s.statNumber, { color: colors.onSurface }]}>
                {totalReflections}
              </Text>
              <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>
                Total Reflections
              </Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card }]}>
              <Ionicons
                name="heart"
                size={24}
                color={colors.tertiary}
                style={s.statIcon}
              />
              <Text style={[s.statNumber, { color: colors.onSurface }]}>
                {encouragementsGiven}
              </Text>
              <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>
                Encouragements Given
              </Text>
            </View>
          </View>
        </View>

        {/* ── Tab Bar ── */}
        <View style={[s.tabBarWrap, isWide && s.tabBarWrapWide]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabBar}
          >
            {PROFILE_TABS.filter(
              (tab) => isOwner || tab !== "PREFERENCES",
            ).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={s.tabItem}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color:
                        activeTab === tab
                          ? colors.onSurface
                          : colors.onSurfaceVariant,
                    },
                    activeTab === tab && s.tabTextActive,
                  ]}
                >
                  {tab}
                </Text>
                {activeTab === tab && (
                  <View
                    style={[
                      s.tabIndicator,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Tab Content ── */}
        <View style={[s.contentArea, isWide && s.contentAreaWide]}>
          {/* ── Main Column ── */}
          <View style={[s.mainCol, isWide && s.mainColWide]}>
            {/* TIMELINE Tab */}
            {activeTab === "TIMELINE" && (
              <>
                {/* Public Journal Entries */}
                {journals.length > 0 && (
                  <>
                    <Text
                      style={[
                        s.sectionLabel,
                        {
                          color: colors.onSurfaceVariant,
                          marginBottom: spacing.sm,
                        },
                      ]}
                    >
                      JOURNAL ENTRIES
                    </Text>
                    {journals.map((journal) => (
                      <TouchableOpacity
                        key={journal.id}
                        style={[
                          s.journalCard,
                          { backgroundColor: colors.surfaceContainerLowest },
                        ]}
                        onPress={() =>
                          navigation.navigate("Journal", {
                            highlightJournalId: journal.id,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={s.journalHeader}>
                          <Text
                            style={[
                              s.journalTitle,
                              { color: colors.onSurface },
                            ]}
                            numberOfLines={2}
                          >
                            {journal.title || "Journal Entry"}
                          </Text>
                          <Text
                            style={[
                              s.journalDate,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {formatDate(journal.createdAt)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            s.journalQuote,
                            { color: colors.onSurfaceVariant },
                          ]}
                          numberOfLines={4}
                        >
                          {"\u201C"}
                          {journal.content?.slice(0, 200)}
                          {journal.content && journal.content.length > 200
                            ? "..."
                            : ""}
                          {"\u201D"}
                        </Text>
                        {journal.tags && journal.tags.length > 0 && (
                          <View style={s.tagRow}>
                            {journal.tags.map((tag: string) => (
                              <View
                                key={tag}
                                style={[
                                  s.tagPill,
                                  { backgroundColor: colors.secondaryFixed },
                                ]}
                              >
                                <Text
                                  style={[s.tagText, { color: colors.primary }]}
                                >
                                  #{tag}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Recent Reflections */}
                <Text
                  style={[s.sectionLabel, { color: colors.onSurfaceVariant }]}
                >
                  REFLECTIONS
                </Text>
                {myPosts.length === 0 ? (
                  <Text style={[s.emptyText, { color: colors.muted4 }]}>
                    No reflections yet. Start sharing!
                  </Text>
                ) : (
                  myPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onDelete={handlePostDeleted}
                      openedFrom="profile"
                    />
                  ))
                )}
              </>
            )}

            {/* ABOUT Tab */}
            {activeTab === "ABOUT" && (
              <View
                style={[
                  s.tabCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <View style={s.aboutHeader}>
                  <Text style={[s.tabCardLabel, { color: colors.primary }]}>
                    {ABOUT_ME_LABEL}
                  </Text>
                  {!isEditingBio && isOwner && (
                    <TouchableOpacity
                      onPress={handleEditBio}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="pencil"
                        size={15}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {isEditingBio ? (
                  <>
                    <TextInput
                      style={[
                        s.bioInput,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          color: colors.onSurface,
                          borderColor: colors.primary,
                        },
                      ]}
                      value={editedBio}
                      onChangeText={setEditedBio}
                      multiline
                      maxLength={500}
                      placeholder="Write something about yourself..."
                      placeholderTextColor={colors.muted3}
                      editable={!savingBio}
                      autoFocus
                    />
                    <View style={s.bioEditActions}>
                      <TouchableOpacity
                        onPress={handleCancelBio}
                        style={[s.cancelBtn, { borderColor: colors.outline }]}
                      >
                        <Text
                          style={[
                            s.cancelBtnText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveBio}
                        disabled={savingBio}
                        style={[s.saveBtn, { backgroundColor: colors.primary }]}
                      >
                        {savingBio ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onPrimary}
                          />
                        ) : (
                          <Text
                            style={[s.saveBtnText, { color: colors.onPrimary }]}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={[s.aboutText, { color: colors.onSurface }]}>
                    {profileBio ?? BIO_DEFAULT}
                  </Text>
                )}
              </View>
            )}

            {/* CONTACT Tab */}
            {activeTab === "CONTACT" && (
              <View
                style={[
                  s.tabCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                {/* Header */}
                <View style={s.aboutHeader}>
                  <Text style={[s.tabCardLabel, { color: colors.primary }]}>
                    CONNECTION
                  </Text>
                  {isOwner && !isEditingContacts && (
                    <TouchableOpacity
                      onPress={handleEditContacts}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="pencil"
                        size={15}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {isOwner && isEditingContacts ? (
                  // ── Edit mode (owner only) ────────────────────
                  <>
                    {CONTACT_FIELDS.map(({ key, icon, label, placeholder }) => (
                      <View key={key} style={s.contactFieldRow}>
                        <Ionicons
                          name={icon as any}
                          size={18}
                          color={colors.onSurfaceVariant}
                          style={s.contactFieldIcon}
                        />
                        <View style={s.contactFieldBody}>
                          <Text
                            style={[
                              s.contactFieldLabel,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {label}
                          </Text>
                          <TextInput
                            style={[
                              s.contactInput,
                              {
                                backgroundColor: colors.surfaceContainerHigh,
                                color: colors.onSurface,
                                borderColor: colors.outline,
                              },
                            ]}
                            value={editedContacts[key] ?? ""}
                            onChangeText={(v) =>
                              setEditedContacts((prev) => ({
                                ...prev,
                                [key]: v,
                              }))
                            }
                            placeholder={placeholder}
                            placeholderTextColor={colors.muted3}
                            editable={!savingContacts}
                            keyboardType={
                              key === "phone"
                                ? "phone-pad"
                                : key === "contactEmail"
                                  ? "email-address"
                                  : "default"
                            }
                            autoCapitalize="none"
                          />
                        </View>
                      </View>
                    ))}
                    <View style={s.bioEditActions}>
                      <TouchableOpacity
                        onPress={handleCancelContacts}
                        style={[s.cancelBtn, { borderColor: colors.outline }]}
                      >
                        <Text
                          style={[
                            s.cancelBtnText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveContacts}
                        disabled={savingContacts}
                        style={[s.saveBtn, { backgroundColor: colors.primary }]}
                      >
                        {savingContacts ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onPrimary}
                          />
                        ) : (
                          <Text
                            style={[s.saveBtnText, { color: colors.onPrimary }]}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  // ── Read-only view ────────────────────────────
                  (() => {
                    const filled = CONTACT_FIELDS.filter(
                      (r) => !!(profileContacts as any)?.[r.key],
                    );
                    if (filled.length === 0) {
                      return (
                        <Text
                          style={[s.contactEmptyText, { color: colors.muted4 }]}
                        >
                          {isOwner
                            ? "Tap the pencil to add your contact info."
                            : "No contact info shared yet."}
                        </Text>
                      );
                    }
                    return (
                      <>
                        {filled.map(({ key, icon, label, scheme }) => {
                          const value = (profileContacts as any)[key] as string;
                          const isUrl =
                            /^https?:\/\//i.test(value) ||
                            scheme === "tel:" ||
                            scheme === "mailto:";
                          const href = scheme
                            ? value.startsWith(scheme)
                              ? value
                              : scheme + value
                            : /^https?:\/\//i.test(value)
                              ? value
                              : "https://" + value;
                          return (
                            <View key={key} style={s.contactReadRow}>
                              <Ionicons
                                name={icon as any}
                                size={18}
                                color={colors.primary}
                                style={s.contactFieldIcon}
                              />
                              <View style={s.contactFieldBody}>
                                <Text
                                  style={[
                                    s.contactFieldLabel,
                                    { color: colors.onSurfaceVariant },
                                  ]}
                                >
                                  {label}
                                </Text>
                                <Text
                                  style={[
                                    s.contactReadValue,
                                    {
                                      color: isUrl
                                        ? colors.primary
                                        : colors.onSurface,
                                    },
                                    isUrl && s.contactLink,
                                  ]}
                                  numberOfLines={1}
                                  onPress={
                                    isUrl
                                      ? () => Linking.openURL(href)
                                      : undefined
                                  }
                                >
                                  {value}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </>
                    );
                  })()
                )}

                {/* Coach / Admin contact CTA — visible only to non-coach viewers */}
                {!isOwner &&
                  (profileRole === "COACH" || profileRole === "ADMIN") &&
                  !isEditingContacts && (
                    <View
                      style={[
                        s.coachCtaWrap,
                        { borderTopColor: colors.surfaceVariant },
                      ]}
                    >
                      <View style={s.coachCtaInfo}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={18}
                          color={colors.secondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              s.coachCtaTitle,
                              { color: colors.onSurface },
                            ]}
                          >
                            {profileRole === "ADMIN"
                              ? "Admin Channel"
                              : "Available for Coaching"}
                          </Text>
                          <Text
                            style={[
                              s.coachCtaDesc,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {profileRole === "ADMIN"
                              ? "Reach out through the secure admin channel."
                              : "Send a message to start a private coaching session."}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          s.messageCoachBtn,
                          { backgroundColor: colors.secondary },
                        ]}
                        onPress={() => profileUserId && handleMessageCoach(profileUserId)}
                        disabled={startingCoachChat}
                        activeOpacity={0.7}
                      >
                        {startingCoachChat ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onPrimary}
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="chatbubble-ellipses"
                              size={18}
                              color={colors.onPrimary}
                            />
                            <Text
                              style={[
                                s.messageCoachText,
                                { color: colors.onPrimary },
                              ]}
                            >
                              {profileRole === "ADMIN"
                                ? "Open Admin Channel"
                                : "Message Coach"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
              </View>
            )}

            {/* PREFERENCES Tab */}
            {activeTab === "PREFERENCES" && isOwner && (
              <View
                style={[
                  s.tabCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <View
                  style={[
                    s.prefRow,
                    { borderBottomColor: colors.surfaceVariant },
                  ]}
                >
                  <View style={s.prefInfo}>
                    <Text style={[s.prefLabel, { color: colors.onSurface }]}>
                      Anonymous Mode
                    </Text>
                    <Text
                      style={[s.prefDesc, { color: colors.onSurfaceVariant }]}
                    >
                      Hide identity from community
                    </Text>
                  </View>
                  <Switch
                    value={isAnonymous}
                    onValueChange={(val) =>
                      toggleAnonymous(val).catch(() =>
                        showAlert("Error", "Could not toggle anonymous mode."),
                      )
                    }
                    trackColor={{
                      false: colors.surfaceVariant,
                      true: colors.primary,
                    }}
                    thumbColor={colors.onPrimary}
                  />
                </View>

                <View
                  style={[
                    s.prefRow,
                    { borderBottomColor: colors.surfaceVariant },
                  ]}
                >
                  <View style={s.prefInfo}>
                    <Text style={[s.prefLabel, { color: colors.onSurface }]}>
                      Notifications
                    </Text>
                    <Text
                      style={[s.prefDesc, { color: colors.onSurfaceVariant }]}
                    >
                      Daily reflection reminders
                    </Text>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={(val) =>
                      toggleNotifications(val).catch(() =>
                        showAlert("Error", "Could not toggle notifications."),
                      )
                    }
                    trackColor={{
                      false: colors.surfaceVariant,
                      true: colors.primary,
                    }}
                    thumbColor={colors.onPrimary}
                  />
                </View>

                <View
                  style={[
                    s.prefRow,
                    { borderBottomColor: colors.surfaceVariant },
                  ]}
                >
                  <View style={s.prefInfo}>
                    <Text style={[s.prefLabel, { color: colors.onSurface }]}>
                      Dark Mode
                    </Text>
                    <Text
                      style={[s.prefDesc, { color: colors.onSurfaceVariant }]}
                    >
                      Gentle on your eyes
                    </Text>
                  </View>
                  <Switch
                    value={isDark}
                    onValueChange={(val) => toggleDarkMode(val)}
                    trackColor={{
                      false: colors.surfaceVariant,
                      true: colors.primary,
                    }}
                    thumbColor={colors.onPrimary}
                  />
                </View>

                {/* PIN Code */}
                <View style={[s.prefRow, { borderBottomWidth: 0 }]}>
                  <View style={s.prefInfo}>
                    <Text style={[s.prefLabel, { color: colors.onSurface }]}>
                      Login PIN
                    </Text>
                    <Text
                      style={[s.prefDesc, { color: colors.onSurfaceVariant }]}
                    >
                      Use this PIN to log in from another device
                    </Text>
                  </View>
                </View>
                {isEditingPin ? (
                  <View style={[s.pinEditRow, !isMedium && s.pinEditRowMobile]}>
                    <TextInput
                      style={[
                        s.editInput,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          color: colors.onSurface,
                        },
                      ]}
                      value={editedPin}
                      onChangeText={(t) =>
                        setEditedPin(t.replace(/[^0-9]/g, "").slice(0, 6))
                      }
                      placeholder="6-digit PIN"
                      placeholderTextColor={colors.muted3}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!savingPin}
                      autoFocus
                    />
                    <View style={s.editActions}>
                      <TouchableOpacity
                        onPress={handleCancelPin}
                        style={[s.cancelBtn, { borderColor: colors.outline }]}
                      >
                        <Text
                          style={[
                            s.cancelBtnText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSavePin}
                        disabled={savingPin}
                        style={[s.saveBtn, { backgroundColor: colors.primary }]}
                      >
                        {savingPin ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onPrimary}
                          />
                        ) : (
                          <Text
                            style={[s.saveBtnText, { color: colors.onPrimary }]}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={s.pinDisplayRow}>
                    <TouchableOpacity
                      onPress={() => setPinVisible(!pinVisible)}
                      style={s.pinValueWrap}
                    >
                      <Text style={[s.pinValue, { color: colors.onSurface }]}>
                        {pinCode
                          ? pinVisible
                            ? pinCode
                            : "••••••"
                          : "No PIN set"}
                      </Text>
                      <Ionicons
                        name={pinVisible ? "eye-off" : "eye"}
                        size={18}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleEditPin}
                      style={[s.editPinBtn, { borderColor: colors.outline }]}
                    >
                      <Ionicons
                        name="pencil"
                        size={14}
                        color={colors.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          s.editPinBtnText,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Side Panel (wide screens) ── */}
          {isWide && !["ABOUT", "CONTACT"].includes(activeTab) && (
            <View
              style={[
                s.sideCol,
                activeTab === "PREFERENCES" && { marginTop: 0 },
              ]}
            >
              <View
                style={[
                  s.sideCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Text style={[s.tabCardLabel, { color: colors.primary }]}>
                  {ABOUT_ME_LABEL}
                </Text>
                <Text style={[s.sideText, { color: colors.onSurface }]}>
                  {profileBio ?? BIO_DEFAULT}
                </Text>
              </View>

              {!isOwner && (profileRole === "COACH" || profileRole === "ADMIN") && (
                <View
                  style={[
                    s.sideCard,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ]}
                >
                  <Text style={[s.tabCardLabel, { color: colors.primary }]}>
                    CONNECTION
                  </Text>
                  <Text
                    style={[s.contactNote, { color: colors.onSurfaceVariant }]}
                  >
                    {profileRole === "ADMIN"
                      ? "Reach out through the secure admin channel."
                      : "Send a message to start a private coaching session."}
                  </Text>
                  <TouchableOpacity
                    style={[
                      s.messageCoachBtn,
                      { backgroundColor: colors.secondary },
                    ]}
                    onPress={() => profileUserId && handleMessageCoach(profileUserId)}
                    disabled={startingCoachChat}
                    activeOpacity={0.7}
                  >
                    {startingCoachChat ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.onPrimary}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={18}
                          color={colors.onPrimary}
                        />
                        <Text
                          style={[
                            s.messageCoachText,
                            { color: colors.onPrimary },
                          ]}
                        >
                          {profileRole === "ADMIN"
                            ? "Open Admin Channel"
                            : "Message Coach"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Avatar Preview Modal ── */}
      {resolvedAvatarUri && (
        <Modal
          visible={avatarPreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAvatarPreviewVisible(false)}
        >
          <TouchableOpacity
            style={s.previewOverlay}
            activeOpacity={1}
            onPress={() => setAvatarPreviewVisible(false)}
          >
            <Image
              source={{ uri: resolvedAvatarUri }}
              style={s.previewImage}
              resizeMode="cover"
            />
            {isOwner && (
              <TouchableOpacity
                style={[s.previewEditBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setAvatarPreviewVisible(false);
                  handlePickAvatar();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={18} color={colors.onPrimary} />
                <Text style={[s.previewEditText, { color: colors.onPrimary }]}>
                  Edit Photo
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    scrollContent: {
      paddingBottom: 80,
      ...(Platform.OS === "web"
        ? { maxWidth: 960, alignSelf: "center" as any, width: "100%" as any }
        : {}),
    },

    // ── Banner ──────────────────────────────
    bannerWrap: {
      position: "relative" as any,
    },
    bannerWrapWide: {},
    banner: {
      height: 225,
      borderBottomLeftRadius: radii.xl,
      borderBottomRightRadius: radii.xl,
    },
    bannerWide: {
      borderBottomLeftRadius: radii.xl,
      borderBottomRightRadius: radii.xl,
    },
    bannerUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderBottomLeftRadius: radii.xl,
      borderBottomRightRadius: radii.xl,
      alignItems: "center" as any,
      justifyContent: "center" as any,
    },
    bannerCameraBtn: {
      position: "absolute" as any,
      top: 0,
      marginTop: -spacing.sm,
      right: spacing.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center" as any,
      justifyContent: "center" as any,
    },

    // ── Profile Section ─────────────────────
    profileSectionBase: {
      position: "relative" as any,
      marginTop: -28,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    profileSectionMedium: {
      marginTop: -28,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    profileSectionSmall: {
      marginTop: -28,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.md,
    },
    profileHeaderMedium: { gap: spacing.lg },

    // ── Avatar ──────────────────────────────
    avatarOuter: { position: "relative" },
    avatarFrame: {
      borderRadius: radii.full,
      borderWidth: 4,
      borderColor: colors.card,
      overflow: "hidden",
      ...ambientShadow,
    },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontFamily: fonts.displayBold },
    onlineDot: {
      position: "absolute",
      bottom: 4,
      left: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#22C55E",
      borderWidth: 2.5,
      borderColor: colors.card,
    },
    avatarUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    cameraBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xl,
    },
    previewImage: {
      width: 240,
      height: 240,
      borderRadius: radii.full,
    },
    previewEditBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      borderRadius: radii.full,
    },
    previewEditText: {
      fontSize: 15,
      fontFamily: fonts.displaySemiBold,
    },

    // ── Profile Meta ────────────────────────
    profileMeta: { flex: 1, paddingBottom: spacing.xs },
    nameActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    nameEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    displayName: { fontSize: 18, fontFamily: fonts.displayBold },
    displayNameMedium: { fontSize: 24 },
    actionBtns: { flexDirection: "row", gap: spacing.sm },
    signOutBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: radii.full,
    },
    signOutBtnMobile: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center" as any,
      justifyContent: "center" as any,
    },
    signOutBtnText: { fontSize: 13, fontFamily: fonts.displaySemiBold },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap" as any,
    },
    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    roleBadgeText: {
      fontSize: 10,
      fontFamily: fonts.bodySemiBold,
      textTransform: "uppercase" as any,
      letterSpacing: 0.5,
    },
    joinedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    joinedText: { fontSize: 13, fontFamily: fonts.bodyRegular },

    // ── Edit row ────────────────────────────
    editRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    editRowMobile: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    editInput: {
      flex: 1,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
    },
    editInputMobile: {
      flex: 1,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
      fontFamily: fonts.displaySemiBold,
      borderWidth: 1.5,
      minWidth: 0,
    },
    editIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center" as any,
      justifyContent: "center" as any,
      borderWidth: 1,
      flexShrink: 0,
    },
    editActions: { flexDirection: "row", gap: spacing.sm },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radii.full,
      borderWidth: 1,
    },
    cancelBtnText: { fontSize: 12, fontFamily: fonts.bodySemiBold },
    saveBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: radii.full,
    },
    saveBtnText: { fontSize: 12, fontFamily: fonts.displaySemiBold },

    // ── Stats ───────────────────────────────
    statsSection: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
    statsSectionWide: { paddingHorizontal: spacing.xl },
    journeyHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    journeyTitle: {
      fontSize: 18,
      fontFamily: fonts.displayBold,
    },
    statsRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    statsRowMedium: { gap: spacing.md, flexWrap: "nowrap" },
    statCard: {
      flex: 1,
      minWidth: 90,
      borderRadius: radii.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "flex-start" as any,
      ...ambientShadow,
    },
    statIcon: {
      marginBottom: spacing.sm,
    },
    statNumber: {
      fontSize: 28,
      fontFamily: fonts.displayExtraBold,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: fonts.bodyRegular,
    },

    // ── Tab Bar ─────────────────────────────
    tabBarWrap: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceVariant,
    },
    tabBarWrapWide: { paddingHorizontal: spacing.xl },
    tabBar: { flexDirection: "row", gap: spacing.lg },
    tabItem: { paddingVertical: spacing.md, position: "relative" },
    tabText: {
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
      textTransform: "uppercase" as any,
      letterSpacing: 0.8,
    },
    tabTextActive: { fontFamily: fonts.displayBold },
    tabIndicator: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 2.5,
      borderRadius: 2,
    },

    // ── Content Area ────────────────────────
    contentArea: { paddingHorizontal: spacing.md },
    contentAreaWide: {
      flexDirection: "row",
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },
    mainCol: { flex: 1 },
    mainColWide: { flex: 2 },

    // ── Section Labels ──────────────────────
    sectionLabel: {
      fontSize: 11,
      fontFamily: fonts.displayBold,
      textTransform: "uppercase" as any,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },

    // ── Journal Card ────────────────────────
    journalCard: {
      borderRadius: radii.xl,
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...ambientShadow,
    },
    journalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    journalTitle: { fontSize: 18, fontFamily: fonts.displayBold, flex: 1 },
    journalDate: { fontSize: 12, fontFamily: fonts.bodyRegular },
    journalQuote: {
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
      fontStyle: "italic",
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    tagRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    tagPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radii.full,
    },
    tagText: { fontSize: 12, fontFamily: fonts.bodySemiBold },

    // ── Tab Content Cards ───────────────────
    tabCard: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      ...ambientShadow,
    },
    tabCardLabel: {
      fontSize: 12,
      fontFamily: fonts.displayBold,
      textTransform: "uppercase" as any,
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    aboutText: { fontSize: 14, fontFamily: fonts.bodyRegular, lineHeight: 22 },
    aboutHeader: {
      flexDirection: "row" as any,
      alignItems: "center" as any,
      justifyContent: "space-between" as any,
      marginBottom: spacing.md,
    },
    bioInput: {
      borderRadius: radii.md,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
      lineHeight: 22,
      minHeight: 100,
      textAlignVertical: "top" as any,
      marginBottom: spacing.sm,
    },
    bioEditActions: {
      flexDirection: "row" as any,
      justifyContent: "flex-end" as any,
      gap: spacing.sm,
    },
    contactNote: {
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    messageCoachBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: 14,
      borderRadius: radii.lg,
    },
    messageCoachText: { fontSize: 15, fontFamily: fonts.displaySemiBold },

    // ── Preferences ─────────────────────────
    prefRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
    },
    prefInfo: { flex: 1, marginRight: 12 },
    prefLabel: { fontSize: 14, fontFamily: fonts.displaySemiBold },
    prefDesc: { fontSize: 12, fontFamily: fonts.bodyRegular, marginTop: 2 },

    // ── PIN ─────────────────────────────────
    pinEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    pinEditRowMobile: {
      flexDirection: "column",
      alignItems: "stretch",
      gap: spacing.xs,
    },
    pinDisplayRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: spacing.xs,
    },
    pinValueWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    pinValue: {
      fontSize: 16,
      fontFamily: fonts.displaySemiBold,
      letterSpacing: 2,
    },
    editPinBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      borderWidth: 1,
    },
    editPinBtnText: { fontSize: 12, fontFamily: fonts.bodySemiBold },

    // ── Contact Field ────────────────────────
    contactFieldRow: {
      flexDirection: "row" as any,
      alignItems: "flex-start" as any,
      marginBottom: spacing.md,
    },
    contactFieldIcon: {
      marginRight: spacing.sm,
      width: 20,
      marginBottom: 8,
    },
    contactFieldBody: {
      flex: 1,
    },
    contactFieldLabel: {
      fontSize: 11,
      fontFamily: fonts.bodySemiBold,
      textTransform: "uppercase" as any,
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    contactInput: {
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
    },
    contactReadRow: {
      flexDirection: "row" as any,
      alignItems: "flex-start" as any,
      marginBottom: spacing.md,
    },
    contactReadValue: {
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
    },
    contactLink: {
      textDecorationLine: "underline" as any,
    },
    contactEmptyText: {
      fontSize: 13,
      fontFamily: fonts.bodyRegular,
      fontStyle: "italic" as any,
      paddingVertical: spacing.sm,
    },
    coachCtaWrap: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      gap: spacing.sm,
    },
    coachCtaInfo: {
      flexDirection: "row" as any,
      alignItems: "flex-start" as any,
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    coachCtaTitle: {
      fontSize: 13,
      fontFamily: fonts.displaySemiBold,
      marginBottom: 2,
    },
    coachCtaDesc: {
      fontSize: 12,
      fontFamily: fonts.bodyRegular,
      lineHeight: 18,
    },

    // ── Side Panel ──────────────────────────
    sideCol: { flex: 1, gap: spacing.md, marginTop: 20 },
    sideCard: { borderRadius: radii.xl, padding: spacing.lg, ...ambientShadow },
    sideText: { fontSize: 14, fontFamily: fonts.bodyRegular, lineHeight: 22 },

    // ── Empty ───────────────────────────────
    emptyText: {
      fontSize: 14,
      fontFamily: fonts.bodyRegular,
      fontStyle: "italic",
      paddingVertical: spacing.md,
    },
  });
