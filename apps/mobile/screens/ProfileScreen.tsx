// ─────────────────────────────────────────────
// screens/ProfileScreen.tsx
// User profile — Sacred Journal design
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import * as ImagePicker from "expo-image-picker";

import { colors as defaultColors, fonts, spacing, radii, ambientShadow } from "../constants/theme";
import { useUserStore } from "../context/UserContext";
import { useThemeStore } from "../context/ThemeContext";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import { apiUpdateUsername, apiFetchJournals, apiUploadAvatar, apiGetPin, apiUpdatePin, apiGetUserStats, getBaseUrl } from "../services/api";
import { usePosts } from "../hooks/usePosts";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";
import type { Journal } from "../../../packages/types";

type Nav = DrawerNavigationProp<MainDrawerParamList>;

const ROLE_LABELS: Record<string, string> = {
  USER: "Spaze Member",
  COACH: "Spaze Coach",
  ADMIN: "Admin",
};

const BIO_DEFAULT = "Embracing the journey of self-discovery one reflection at a time. Safe in the sanctuary.";

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { username, userId, role, avatarUrl, isAnonymous, notificationsEnabled, updateUsername, updateAvatarUrl, logoutUser, toggleAnonymous, toggleNotifications } = useUserStore();
  const { isDark, toggleDarkMode } = useThemeStore();
  const colors = useThemeStore((s) => s.colors);
  const s = useMemo(() => createStyles(colors), [colors]);
  const { posts, fetchPosts } = usePosts();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;;
  const isMedium = width >= 600;
  const twoCol = width >= 700;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [encouragementsGiven, setEncouragementsGiven] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [streak, setStreak] = useState(0);

  // ── Edit username state ───────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username ?? "");
  const [savingUsername, setSavingUsername] = useState(false);

  // ── Avatar upload state ───────────────────
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── PIN state ─────────────────────────────
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editedPin, setEditedPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  // ── Preferences state ─────────────────────

  const displayName = username ?? "User";
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role ?? "USER"] ?? "Spaze Member";

  // ── Responsive avatar size ────────────────
  const avatarSize = isMedium ? 100 : 80;

  // ── Load data ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      await fetchPosts();
      if (userId) {
        const [journalRes, pinRes, statsRes] = await Promise.all([
          apiFetchJournals(userId),
          apiGetPin(userId).catch(() => ({ pin: null })),
          apiGetUserStats(userId).catch(() => ({ encouragementsGiven: 0, totalReflections: 0, streak: 0 })),
        ]);
        setJournals(journalRes.journals);
        setPinCode(pinRes.pin);
        setEncouragementsGiven(statsRes.encouragementsGiven);
        setTotalReflections(statsRes.totalReflections);
        setStreak(statsRes.streak);
      }
    } catch (err) {
      console.warn("[ProfileScreen] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPosts, userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Stats ─────────────────────────────────
  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === userId),
    [posts, userId],
  );

  // ── Recent reflections ────────────────────
  const recentReflections = useMemo(() => {
    const items = [
      ...myPosts.map((p) => ({ id: p.id, title: p.content?.slice(0, 50) ?? "Post", date: p.createdAt, type: "post" })),
      ...journals.map((j) => ({ id: j.id, title: j.content?.slice(0, 50) ?? j.title, date: j.createdAt, type: "journal" })),
    ];
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 5);
  }, [myPosts, journals]);

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
      const { avatarUrl: newUrl } = await apiUploadAvatar(userId, result.assets[0].uri);
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
    if (editedUsername === username) { setIsEditing(false); return; }
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
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to update username.";
      showAlert("Error", msg);
    } finally {
      setSavingUsername(false);
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
    if (editedPin === pinCode) { setIsEditingPin(false); return; }
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
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to update PIN.";
      showAlert("Error", msg);
    } finally {
      setSavingPin(false);
    }
  };

  // ═══════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const resolvedAvatarUri = avatarUrl ? `${getBaseUrl()}${avatarUrl}` : null;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          isWide && s.scrollContentWide,
        ]}
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
        {/* ── Profile Header Card ── */}
        <View style={[s.profileCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={[s.profileRow, isMedium && s.profileRowMedium]}>
            {/* Avatar */}
            <TouchableOpacity
              style={s.avatarWrap}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.7}
            >
              {resolvedAvatarUri ? (
                <Image
                  source={{ uri: resolvedAvatarUri }}
                  style={[
                    s.avatarImage,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                  ]}
                />
              ) : (
                <LinearGradient
                  colors={[colors.surfaceContainerHigh, colors.surfaceVariant]}
                  style={[
                    s.avatarGrad,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                  ]}
                >
                  <Text style={[s.avatarText, { color: colors.onSurface, fontSize: avatarSize * 0.4 }]}>
                    {initial}
                  </Text>
                </LinearGradient>
              )}
              <View style={[s.avatarEditBadge, { backgroundColor: colors.primary }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size={10} color={colors.onPrimary} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.onPrimary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Info */}
            <View style={[s.profileInfo, isMedium && s.profileInfoMedium]}>
              <View style={s.nameRow}>
                <Text
                  style={[
                    s.displayName,
                    { color: colors.onSurface },
                    isMedium && s.displayNameMedium,
                  ]}
                >
                  {displayName}
                </Text>
                <View style={[s.roleBadge, { backgroundColor: colors.secondaryFixed }]}>
                  <Text style={[s.roleBadgeText, { color: colors.onSecondaryFixed }]}>{roleLabel}</Text>
                </View>
              </View>
              <Text style={[s.bio, { color: colors.onSurfaceVariant }]}>{BIO_DEFAULT}</Text>

              {/* Action buttons */}
              <View style={s.profileActions}>
                {isEditing ? (
                  <View style={[s.editRow, !isMedium && s.editRowMobile]}>
                    <TextInput
                      style={[s.editInput, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface }]}
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      placeholder="New username"
                      placeholderTextColor={colors.muted3}
                      editable={!savingUsername}
                      autoFocus
                    />
                    <View style={[s.editActions, !isMedium && s.editActionsMobile]}>
                      <TouchableOpacity onPress={handleCancelEdit} style={[s.cancelBtn, { borderColor: colors.outline }]}>
                        <Text style={[s.cancelBtnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveUsername}
                        disabled={savingUsername}
                        style={[s.saveBtnSmall, { backgroundColor: colors.primary }]}
                      >
                        {savingUsername ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Text style={[s.saveBtnSmallText, { color: colors.onPrimary }]}>Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity onPress={handleEditProfile} style={[s.editProfileBtn, { backgroundColor: colors.primary }]}>
                      <Text style={[s.editProfileBtnText, { color: colors.onPrimary }]}>Edit Username  </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logoutUser} style={[s.signOutBtn, { borderColor: colors.outline }]}>
                      <Text style={[s.signOutBtnText, { color: colors.onSurface }]}>Sign Out</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Your Journey ── */}
        <View style={s.sectionHeader}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={[s.sectionTitle, { color: colors.onSurface }, isMedium && { fontSize: 20 }]}>Your Journey</Text>
        </View>

        <View style={[s.statsRow, isMedium && s.statsRowMedium]}>
          <View style={[s.statCard, isMedium && s.statCardMedium, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Ionicons name="flame" size={20} color={colors.primary} />
            <Text style={[s.statNumber, { color: colors.onSurface }, isMedium && { fontSize: 28 }]}>{streak} Day{streak !== 1 ? "s" : ""}</Text>
            <Text style={[s.statLabel, { color: colors.onSurfaceVariant }, isMedium && { fontSize: 12 }]}>Streak</Text>
          </View>
          <View style={[s.statCard, isMedium && s.statCardMedium, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Ionicons name="book" size={20} color={colors.secondary} />
            <Text style={[s.statNumber, { color: colors.onSurface }, isMedium && { fontSize: 28 }]}>{totalReflections}</Text>
            <Text style={[s.statLabel, { color: colors.onSurfaceVariant }, isMedium && { fontSize: 12 }]}>Total Reflections</Text>
          </View>
          <View style={[s.statCard, isMedium && s.statCardMedium, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Ionicons name="heart" size={20} color={colors.tertiary} />
            <Text style={[s.statNumber, { color: colors.onSurface }, isMedium && { fontSize: 28 }]}>{encouragementsGiven}</Text>
            <Text style={[s.statLabel, { color: colors.onSurfaceVariant }, isMedium && { fontSize: 12 }]}>Encouragements Given</Text>
          </View>
        </View>

        {/* ── Bottom two-column area ── */}
        <View style={[s.bottomRow, twoCol && s.bottomRowWide]}>
          {/* Recent Reflections */}
          <View style={[s.bottomCard, twoCol && s.bottomCardFlex, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={s.bottomCardHeader}>
              <Text style={[s.bottomCardTitle, { color: colors.onSurface }]}>Recent Reflections</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Journal", { scrollToPastEntries: true })}>
                <Text style={[s.viewAllLink, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentReflections.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.muted4 }]}>No reflections yet. Start journaling!</Text>
            ) : (
              recentReflections.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.reflectionRow, { borderBottomColor: colors.surfaceVariant }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.type === "journal") {
                      navigation.navigate("Journal", { highlightJournalId: item.id });
                    } else {
                      navigation.navigate("PostDetail", { postId: item.id });
                    }
                  }}
                >
                  <View style={[s.reflectionIcon, { backgroundColor: colors.surfaceContainerLow }]}>
                    <Ionicons
                      name={item.type === "journal" ? "sparkles" : "chatbubble"}
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <View style={s.reflectionInfo}>
                    <Text style={[s.reflectionTitle, { color: colors.onSurface }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[s.reflectionDate, { color: colors.onSurfaceVariant }]}>{formatDate(item.date)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted3} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Preferences */}
          <View style={[s.bottomCard, twoCol && s.bottomCardFlex, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[s.bottomCardTitle, { color: colors.onSurface }]}>Preferences</Text>

            <View style={[s.prefRow, { borderBottomColor: colors.surfaceVariant }]}>
              <View style={s.prefInfo}>
                <Text style={[s.prefLabel, { color: colors.onSurface }]}>Anonymous Mode</Text>
                <Text style={[s.prefDesc, { color: colors.onSurfaceVariant }]}>Hide identity from community</Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={(val) => toggleAnonymous(val).catch(() => showAlert('Error', 'Could not toggle anonymous mode.'))}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>

            <View style={[s.prefRow, { borderBottomColor: colors.surfaceVariant }]}>
              <View style={s.prefInfo}>
                <Text style={[s.prefLabel, { color: colors.onSurface }]}>Notifications</Text>
                <Text style={[s.prefDesc, { color: colors.onSurfaceVariant }]}>Daily reflection reminders</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(val) => toggleNotifications(val).catch(() => showAlert('Error', 'Could not toggle notifications.'))}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>

            <View style={[s.prefRow, { borderBottomColor: colors.surfaceVariant }]}>
              <View style={s.prefInfo}>
                <Text style={[s.prefLabel, { color: colors.onSurface }]}>Dark Mode</Text>
                <Text style={[s.prefDesc, { color: colors.onSurfaceVariant }]}>Gentle on your eyes</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => toggleDarkMode(val)}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>

            {/* PIN Code */}
            <View style={[s.prefRow, { borderBottomWidth: 0 }]}>
              <View style={s.prefInfo}>
                <Text style={[s.prefLabel, { color: colors.onSurface }]}>Login PIN</Text>
                <Text style={[s.prefDesc, { color: colors.onSurfaceVariant }]}>Use this PIN to log in from another device</Text>
              </View>
            </View>
            {isEditingPin ? (
              <View style={[s.pinEditRow, !isMedium && s.pinEditRowMobile]}>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface }]}
                  value={editedPin}
                  onChangeText={(t) => setEditedPin(t.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="6-digit PIN"
                  placeholderTextColor={colors.muted3}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!savingPin}
                  autoFocus
                />
                <View style={[s.editActions, !isMedium && s.editActionsMobile]}>
                  <TouchableOpacity onPress={handleCancelPin} style={[s.cancelBtn, { borderColor: colors.outline }]}>
                    <Text style={[s.cancelBtnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSavePin} disabled={savingPin} style={[s.saveBtnSmall, { backgroundColor: colors.primary }]}>
                    {savingPin ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={[s.saveBtnSmallText, { color: colors.onPrimary }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={s.pinDisplayRow}>
                <TouchableOpacity onPress={() => setPinVisible(!pinVisible)} style={s.pinValueWrap}>
                  <Text style={[s.pinValue, { color: colors.onSurface }]}>
                    {pinCode ? (pinVisible ? pinCode : "••••••") : "No PIN set"}
                  </Text>
                  <Ionicons name={pinVisible ? "eye-off" : "eye"} size={18} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEditPin} style={[s.editPinBtn, { borderColor: colors.outline }]}>
                  <Ionicons name="pencil" size={14} color={colors.onSurfaceVariant} />
                  <Text style={[s.editPinBtnText, { color: colors.onSurfaceVariant }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 80,
    ...(Platform.OS === "web" ? { maxWidth: 900, alignSelf: "center" as any, width: "100%" as any } : {}),
  },
  scrollContentWide: {
    padding: spacing.xl,
    paddingBottom: 60,
  },

  // ── Profile card ──────────────────────────
  profileCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...ambientShadow,
  },
  profileRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  profileRowMedium: {
    gap: spacing.lg,
  },
  avatarWrap: { position: "relative", alignSelf: "flex-start" },
  avatarGrad: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  profileInfo: { flex: 1 },
  profileInfoMedium: {
    paddingTop: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  displayName: {
    fontSize: 19,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  displayNameMedium: {
    fontSize: 24,
  },
  roleBadge: {
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSecondaryFixed,
  },
  bio: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  profileActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  editProfileBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  signOutBtnText: {
    fontSize: 13,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },

  // ── Edit row ──────────────────────────────
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  editRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.xs,
  },
  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  editActionsMobile: {
    justifyContent: "flex-end",
  },
  editInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  cancelBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
  },
  saveBtnSmall: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  saveBtnSmallText: {
    fontSize: 12,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
  },

  // ── Section header ────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },

  // ── Stats row ─────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    flexWrap: "wrap",
  },
  statsRowMedium: {
    flexWrap: "nowrap",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 14,
    alignItems: "flex-start",
    gap: spacing.xs,
    ...ambientShadow,
  },
  statCardMedium: {
    padding: 18,
    gap: spacing.sm,
    minWidth: 90,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: fonts.displayExtraBold,
    color: colors.onSurface,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },

  // ── Bottom row ────────────────────────────
  bottomRow: { gap: spacing.md },
  bottomRowWide: { flexDirection: "row" },
  bottomCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 20,
    ...ambientShadow,
  },
  bottomCardFlex: { flex: 1 },
  bottomCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  bottomCardTitle: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  viewAllLink: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },

  // ── Reflections list ──────────────────────
  reflectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  reflectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  reflectionInfo: { flex: 1 },
  reflectionTitle: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  reflectionDate: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    fontStyle: "italic",
    paddingVertical: spacing.md,
  },

  // ── Preferences ───────────────────────────
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  prefInfo: { flex: 1, marginRight: 12 },
  prefLabel: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  prefDesc: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  // ── PIN styles ────────────────────────────
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
  editPinBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
});
