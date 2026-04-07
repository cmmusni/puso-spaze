import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../constants/theme";
import { apiGetDashboardStats, type DashboardStats } from "../services/api";

export default function WebRightPanel() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, dailyStories: 0, onlineCount: 0,
    trendingTags: [], dailyReflection: null,
  });

  useFocusEffect(
    useCallback(() => {
      apiGetDashboardStats().then(setStats);
    }, []),
  );

  const fmtNum = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Trending Reflections */}
      <View style={styles.panelCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Trending Reflections</Text>
        </View>
        {stats.trendingTags && stats.trendingTags.length > 0 ? (
          <View style={styles.tagsWrap}>
            {stats.trendingTags.map((tag) => (
              <View key={tag} style={styles.tagItem}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No trending topics yet</Text>
        )}
      </View>

      {/* Daily Grace card */}
      <LinearGradient
        colors={[colors.deep, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.graceCard}
      >
        <Ionicons name="sparkles" size={24} color={colors.hot} />
        <Text style={styles.graceTitle}>Daily Grace</Text>
        <Text style={styles.graceQuote}>
          {"\u201C"}Your presence makes a difference. This space is safer because you are in it.{"\u201D"}
        </Text>
      </LinearGradient>

      {/* Community Pulse */}
      <View style={styles.panelCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="pulse" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Community Pulse</Text>
        </View>
        <View style={styles.pulseRow}>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseNum}>{fmtNum(stats.totalMembers)}</Text>
            <Text style={styles.pulseLbl}>Members</Text>
          </View>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseNum}>{stats.dailyStories}</Text>
            <Text style={styles.pulseLbl}>Today</Text>
          </View>
          <View style={styles.pulseItem}>
            <Text style={styles.pulseNum}>{fmtNum(stats.onlineCount)}</Text>
            <Text style={styles.pulseLbl}>Online</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    padding: 16,
    backgroundColor: colors.canvas,
    borderLeftWidth: 1,
    borderLeftColor: colors.muted3,
  },
  panelCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.muted3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.heading,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.fuchsia,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted4,
    fontStyle: "italic",
  },
  graceCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  graceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.card,
    marginTop: 8,
    marginBottom: 8,
  },
  graceQuote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
  },
  pulseRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  pulseItem: {
    alignItems: "center",
  },
  pulseNum: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  pulseLbl: {
    fontSize: 11,
    color: colors.muted5,
    marginTop: 2,
  },
});
