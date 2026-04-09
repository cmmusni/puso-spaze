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
  useWindowDimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { Platform as RNPlatform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors, fonts, radii, ambientShadow } from "../constants/theme";
import { useUserStore } from "../context/UserContext";
import { showAlert, showConfirm } from "../utils/alertPlatform";
import { apiUpdateUsername, apiFetchJournals } from "../services/api";
import { usePosts } from "../hooks/usePosts";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";
import type { Journal } from "../../../packages/types";

type Nav = DrawerNavigationProp<MainDrawerParamList>;

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (RNPlatform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    if (RNPlatform.OS === "web") return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

const ROLE_LABELS: Record<string, string> = {
  USER: "Spaze Member",
  COACH: "Spaze Coach",
  ADMIN: "Admin",
};

const BIO_DEFAULT = "Embracing the journey of self-discovery one reflection at a time. Safe in the sanctuary.";

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { username, userId, role, isAnonymous, updateUsername, logoutUser, toggleAnonymous } = useUserStore();
  const { posts, fetchPosts } = usePosts();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;
  const twoCol = width >= 700;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [journals, setJournals] = useState<Journal[]>([]);

  // ── Edit username state ───────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username ?? "");
  const [savingUsername, setSavingUsername] = useState(false);

  // ── Preferences state ─────────────────────
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const displayName = username ?? "User";
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role ?? "USER"] ?? "Spaze Member";

  // ── Load data ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      await fetchPosts();
      if (userId) {
        const res = await apiFetchJournals(userId);
        setJournals(res.journals);
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

  const totalReflections = myPosts.length + journals.length;

  const encouragementsGiven = useMemo(() => {
    // reactionCount is per-post; sum reactions on other people's posts as a proxy
    let count = 0;
    posts.forEach((p) => {
      if (p.userId !== userId && p.reactionCount) count += 1;
    });
    return count;
  }, [posts, userId]);

  const streak = useMemo(() => {
    const dates = new Set<string>();
    journals.forEach((j) => dates.add(new Date(j.createdAt).toDateString()));
    myPosts.forEach((p) => dates.add(new Date(p.createdAt).toDateString()));
    let s = 0;
    const d = new Date();
    while (dates.has(d.toDateString())) {
      s++;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [journals, myPosts]);

  // ── Recent reflections ────────────────────
  const recentReflections = useMemo(() => {
    const items = [
      ...myPosts.map((p) => ({ id: p.id, title: p.content?.slice(0, 50) ?? "Post", date: p.createdAt, type: "post" })),
      ...journals.map((j) => ({ id: j.id, title: j.title, date: j.createdAt, type: "journal" })),
    ];
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 4);
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

  // ═══════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
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
        {/* ── Profile Header Card ── */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            {/* Avatar */}
            <View style={s.avatarWrap}>
              <LinearGradient
                colors={[colors.surfaceContainerHigh, colors.surfaceVariant]}
                style={s.avatarGrad}
              >
                <Text style={s.avatarText}>{initial}</Text>
              </LinearGradient>
              <View style={s.avatarEditBadge}>
                <Ionicons name="pencil" size={10} color={colors.onPrimary} />
              </View>
            </View>

            {/* Info */}
            <View style={s.profileInfo}>
              <View style={s.nameRow}>
                <Text style={s.displayName}>{displayName}</Text>
                <View style={s.roleBadge}>
                  <Text style={s.roleBadgeText}>{roleLabel}</Text>
                </View>
              </View>
              <Text style={s.bio}>{BIO_DEFAULT}</Text>

              {/* Action buttons */}
              <View style={s.profileActions}>
                {isEditing ? (
                  <View style={s.editRow}>
                    <TextInput
                      style={s.editInput}
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      placeholder="New username"
                      placeholderTextColor={colors.muted3}
                      editable={!savingUsername}
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleCancelEdit} style={s.cancelBtn}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveUsername}
                      disabled={savingUsername}
                      style={s.saveBtnSmall}
                    >
                      {savingUsername ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Text style={s.saveBtnSmallText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity onPress={handleEditProfile} style={s.editProfileBtn}>
                      <Text style={s.editProfileBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logoutUser} style={s.signOutBtn}>
                      <Text style={s.signOutBtnText}>Sign Out</Text>
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
          <Text style={s.sectionTitle}>Your Journey</Text>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="flame" size={20} color={colors.primary} />
            <Text style={s.statNumber}>{streak} Day{streak !== 1 ? "s" : ""}</Text>
            <Text style={s.statLabel}>Streak</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="book" size={20} color={colors.secondary} />
            <Text style={s.statNumber}>{totalReflections}</Text>
            <Text style={s.statLabel}>Total Reflections</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="heart" size={20} color={colors.tertiary} />
            <Text style={s.statNumber}>{encouragementsGiven}</Text>
            <Text style={s.statLabel}>Encouragements Given</Text>
          </View>
        </View>

        {/* ── Bottom two-column area ── */}
        <View style={[s.bottomRow, twoCol && s.bottomRowWide]}>
          {/* Recent Reflections */}
          <View style={[s.bottomCard, twoCol && s.bottomCardFlex]}>
            <View style={s.bottomCardHeader}>
              <Text style={s.bottomCardTitle}>Recent Reflections</Text>
              <TouchableOpacity>
                <Text style={s.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentReflections.length === 0 ? (
              <Text style={s.emptyText}>No reflections yet. Start journaling!</Text>
            ) : (
              recentReflections.map((item) => (
                <TouchableOpacity key={item.id} style={s.reflectionRow} activeOpacity={0.7}>
                  <View style={s.reflectionIcon}>
                    <Ionicons
                      name={item.type === "journal" ? "sparkles" : "chatbubble"}
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <View style={s.reflectionInfo}>
                    <Text style={s.reflectionTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.reflectionDate}>{formatDate(item.date)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted3} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Preferences */}
          <View style={[s.bottomCard, twoCol && s.bottomCardFlex]}>
            <Text style={s.bottomCardTitle}>Preferences</Text>

            <View style={s.prefRow}>
              <View style={s.prefInfo}>
                <Text style={s.prefLabel}>Anonymous Mode</Text>
                <Text style={s.prefDesc}>Hide identity from community</Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={(val) => toggleAnonymous(val).catch(() => showAlert('Error', 'Could not toggle anonymous mode.'))}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>

            <View style={s.prefRow}>
              <View style={s.prefInfo}>
                <Text style={s.prefLabel}>Notifications</Text>
                <Text style={s.prefDesc}>Daily reflection reminders</Text>
              </View>
              <Switch
                value={notificationsOn}
                onValueChange={setNotificationsOn}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>

            <View style={s.prefRow}>
              <View style={s.prefInfo}>
                <Text style={s.prefLabel}>Dark Mode</Text>
                <Text style={s.prefDesc}>Gentle on your eyes</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor={colors.onPrimary}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    padding: 24,
    paddingBottom: 80,
    ...(Platform.OS === "web" ? { maxWidth: 900, alignSelf: "center" as any, width: "100%" as any } : {}),
  },

  // ── Profile card ──────────────────────────
  profileCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 24,
    marginBottom: 32,
    ...ambientShadow,
  },
  profileRow: {
    flexDirection: "row",
    gap: 20,
  },
  avatarWrap: { position: "relative" },
  avatarGrad: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  profileInfo: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  displayName: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
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
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
    marginBottom: 16,
  },
  profileActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  editProfileBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
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
    paddingHorizontal: 22,
    paddingVertical: 10,
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
    gap: 8,
    flex: 1,
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
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
  },

  // ── Stats row ─────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 18,
    alignItems: "flex-start",
    gap: 8,
    ...ambientShadow,
  },
  statNumber: {
    fontSize: 28,
    fontFamily: fonts.displayExtraBold,
    color: colors.onSurface,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },

  // ── Bottom row ────────────────────────────
  bottomRow: { gap: 16 },
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
    marginBottom: 16,
  },
  bottomCardTitle: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginBottom: 4,
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
    paddingVertical: 16,
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
});
