// ─────────────────────────────────────────────
// screens/JournalScreen.tsx
// Private journal — compose-first UI with
// calendar, mood bloom, and streak side panel
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  useWindowDimensions,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import {
  apiFetchJournals,
  apiCreateJournal,
  apiUpdateJournal,
  apiDeleteJournal,
} from "../services/api";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { RouteProp } from "@react-navigation/native";
import type { MainDrawerParamList } from "../navigation/MainDrawerNavigator";
import {
  colors as defaultColors,
  fonts,
  radii,
  spacing,
  ambientShadow,
} from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import type { Journal } from "../../../packages/types";
import { showAlert } from "../utils/alertPlatform";
import { BarChart } from "react-native-chart-kit";

// ── Mood config ──────────────────────────────
const MOODS = [
  { key: "grateful", emoji: "🙏", label: "Grateful", color: "#E8B4B8" },
  { key: "hopeful", emoji: "🌟", label: "Hopeful", color: "#C94277" },
  { key: "peaceful", emoji: "☮️", label: "Peaceful", color: "#A060C0" },
  { key: "happy", emoji: "😊", label: "Happy", color: "#F2A65A" },
  { key: "anxious", emoji: "😰", label: "Anxious", color: "#7DB8D4" },
  { key: "sad", emoji: "😢", label: "Sad", color: "#5B7BAD" },
  { key: "reflective", emoji: "🤔", label: "Reflective", color: "#8B6DB0" },
  { key: "loved", emoji: "❤️", label: "Loved", color: "#E05080" },
];

const PROMPTS = [
  "What made you feel hopeful today?",
  "What are you grateful for right now?",
  "What brought you peace today?",
  "What small joy did you notice today?",
  "What would you tell your past self?",
  "What's a prayer on your heart today?",
  "Name one thing that made you smile.",
];

const PROMPT_SUBTEXTS = [
  "Take a moment to breathe and reflect on the small sparks of light.",
  "Pause and let gratitude fill your safe space.",
  "Breathe deeply. Let your heart speak freely.",
  "Slow down and notice the beauty around you.",
  "Write with compassion for who you were.",
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Helpers ──────────────────────────────────
function getDateParts() {
  const now = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return {
    dayOfWeek: dayNames[now.getDay()],
    month: monthNames[now.getMonth()],
    day: now.getDate(),
    fullMonth: MONTH_NAMES[now.getMonth()],
    year: now.getFullYear(),
  };
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: { day: number; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, current: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, current: false });
    }
  }
  return cells;
}

export default function JournalScreen({ navigation }: any) {
  const route = useRoute<RouteProp<MainDrawerParamList, "Journal">>();
  const highlightJournalId = route.params?.highlightJournalId ?? null;
  const scrollToPastEntries = route.params?.scrollToPastEntries ?? false;
  const { userId } = useUserStore();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const st = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const showSidePanel = width >= 1100;

  // ── Highlight state ───────────────────────
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const entryRefs = useRef<Record<string, View | null>>({});

  // ── List state ────────────────────────────
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Compose state (inline) ────────────────
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── FAB visibility — hide while write card is on screen ──
  const [showFab, setShowFab] = useState(false);
  const writeCardBottomY = useRef(0);
  const composeScrollRef = useRef<ScrollView>(null);

  const handleComposeScroll = useCallback(
    (e: { nativeEvent: NativeScrollEvent }) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      setShowFab(offsetY > writeCardBottomY.current);
    },
    [],
  );

  // ── Editor modal state (edit existing) ────
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMood, setEditMood] = useState<string | null>(null);

  // ── Calendar state ────────────────────────
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showMoodCal, setShowMoodCal] = useState(false);

  // ── Prompt ────────────────────────────────
  const dateParts = getDateParts();
  const promptIndex = new Date().getDate() % PROMPTS.length;
  const todayPrompt = PROMPTS[promptIndex];
  const todaySubtext = PROMPT_SUBTEXTS[promptIndex % PROMPT_SUBTEXTS.length];

  // ── Calendar data ─────────────────────────
  const calendarDays = useMemo(
    () => getCalendarDays(calYear, calMonth),
    [calYear, calMonth],
  );
  const today = new Date();
  const isCurrentMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

  // ── Journal dates set for calendar dots ───
  const journalDates = useMemo(() => {
    const set = new Set<string>();
    journals.forEach((j) => {
      const d = new Date(j.createdAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [journals]);

  // ── Journal mood colors for calendar ──────
  const journalMoodColors = useMemo(() => {
    const map = new Map<string, string>();
    journals.forEach((j) => {
      if (!j.mood) return;
      const d = new Date(j.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const moodObj = MOODS.find((m) => m.key === j.mood);
      if (moodObj) map.set(key, moodObj.color);
    });
    return map;
  }, [journals]);

  // ── Streak calculation ────────────────────
  const streak = useMemo(() => {
    if (journals.length === 0) return 0;
    const dateSet = new Set<string>();
    journals.forEach((j) => {
      const d = new Date(j.createdAt);
      dateSet.add(d.toDateString());
    });
    let count = 0;
    const d = new Date();
    while (dateSet.has(d.toDateString())) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [journals]);

  // ── Mood stats ────────────────────────────
  const moodStats = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recent = journals.filter(
      (j) => new Date(j.createdAt) >= oneWeekAgo && j.mood,
    );
    const counts: Record<string, number> = {};
    recent.forEach((j) => {
      if (j.mood) counts[j.mood] = (counts[j.mood] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => ({
        mood: MOODS.find((m) => m.key === key) ?? MOODS[0],
        count,
        total: recent.length,
      }));
  }, [journals]);

  const dominantMoodLabel =
    moodStats.length > 0 ? "Harmonious" : "Begin journaling";

  // ── All mood counts for chart ─────────────
  const allMoodCounts = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recent = journals.filter(
      (j) => new Date(j.createdAt) >= oneWeekAgo && j.mood,
    );
    const counts: Record<string, number> = {};
    recent.forEach((j) => {
      if (j.mood) counts[j.mood] = (counts[j.mood] ?? 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.map(([key, count]) => ({
      mood: MOODS.find((m) => m.key === key) ?? MOODS[0],
      count,
    }));
  }, [journals]);

  // ── Fetch journals ────────────────────────
  const fetchJournals = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetchJournals(userId);
      setJournals(res.journals);
    } catch (err) {
      console.error("Failed to fetch journals:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  // ── Highlight + scroll to journal entry ───
  useEffect(() => {
    if (highlightJournalId && journals.length > 0) {
      setHighlightedId(highlightJournalId);
      const timer = setTimeout(() => {
        const ref = entryRefs.current[highlightJournalId];
        if (ref && composeScrollRef.current) {
          ref.measureLayout(
            composeScrollRef.current.getInnerViewNode?.() as any,
            (_x: number, y: number) => {
              composeScrollRef.current?.scrollTo({ y: y - 20, animated: true });
            },
            () => {},
          );
        }
      }, 400);
      const clearTimer = setTimeout(() => setHighlightedId(null), 2500);
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightJournalId, journals]);

  // ── Scroll to Past Entries section ─────────
  useEffect(() => {
    if (scrollToPastEntries && journals.length > 0) {
      const timer = setTimeout(() => {
        const ref = entryRefs.current['__past_section__'];
        if (ref && composeScrollRef.current) {
          ref.measureLayout(
            composeScrollRef.current.getInnerViewNode?.() as any,
            (_x: number, y: number) => {
              composeScrollRef.current?.scrollTo({ y: y - 20, animated: true });
            },
            () => {},
          );
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [scrollToPastEntries, journals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJournals();
  }, [fetchJournals]);

  // ── Save new entry (inline compose) ───────
  const handleSaveNew = async () => {
    if (!userId || !content.trim()) return;
    setSaving(true);
    try {
      const title = `${dateParts.dayOfWeek}, ${dateParts.month} ${dateParts.day}`;
      const { journal: created } = await apiCreateJournal({
        userId,
        title,
        content: content.trim(),
        mood: mood ?? undefined,
      });
      setContent("");
      setMood(null);
      setSessionType(null);
      await fetchJournals();
      setHighlightedId(created.id);
      setTimeout(() => {
        const ref = entryRefs.current[created.id];
        if (ref && composeScrollRef.current) {
          ref.measureLayout(
            composeScrollRef.current.getInnerViewNode?.() as any,
            (_x: number, y: number) => {
              composeScrollRef.current?.scrollTo({ y: y - 20, animated: true });
            },
            () => {},
          );
        }
      }, 400);
      setTimeout(() => setHighlightedId(null), 2500);
    } catch (err) {
      console.error("Failed to save journal:", err);
      showAlert("Error", "Could not save journal entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit existing entry ───────────────────
  const openEditEntry = (journal: Journal) => {
    setEditingId(journal.id);
    setEditTitle(journal.title);
    setEditContent(journal.content);
    setEditMood(journal.mood ?? null);
    setModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!userId || !editingId || !editTitle.trim() || !editContent.trim())
      return;
    setSaving(true);
    try {
      await apiUpdateJournal(editingId, {
        userId,
        title: editTitle.trim(),
        content: editContent.trim(),
        mood: editMood ?? undefined,
      });
      setModalVisible(false);
      fetchJournals();
    } catch (err) {
      console.error("Failed to save journal:", err);
      showAlert("Error", "Could not save journal entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete entry ──────────────────────────
  const handleDelete = (journalId: string) => {
    if (!userId) return;
    const doDelete = async () => {
      try {
        await apiDeleteJournal(journalId, userId);
        setJournals((prev) => prev.filter((j) => j.id !== journalId));
      } catch (err) {
        console.error("Failed to delete journal:", err);
        showAlert("Error", "Could not delete journal entry.");
      }
    };
    if (Platform.OS === "web") {
      if (confirm("Delete this journal entry?")) doDelete();
    } else {
      Alert.alert("Delete Entry", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // ── Format date ───────────────────────────
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getMoodEmoji = (moodKey: string | null | undefined) =>
    moodKey ? (MOODS.find((m) => m.key === moodKey)?.emoji ?? null) : null;

  // ── Calendar navigation ───────────────────
  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  };

  // ═══════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════

  // ── Chart width (responsive) ────────────────
  const chartWidth = showSidePanel
    ? 280
    : Math.min(width - 112, 400); // account for padding + card padding

  // ── Journey cards (shared between side panel & inline) ──
  const journeyCards = (
    <>
      {/* Calendar */}
      <View style={st.sideCard}>
        <View style={st.calHeader}>
          <Text style={st.calMonthLabel}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <View style={st.calNav}>
            <TouchableOpacity onPress={prevMonth} style={st.calNavBtn}>
              <Ionicons
                name="chevron-back"
                size={16}
                color={colors.onSurface}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} style={st.calNavBtn}>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.onSurface}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={st.calDayNames}>
          {DAYS.map((d, i) => (
            <Text key={i} style={st.calDayName}>
              {d}
            </Text>
          ))}
        </View>
        <View style={st.calGrid}>
          {calendarDays.map((cell, i) => {
            const isTodayCell =
              isCurrentMonth && cell.current && cell.day === today.getDate();
            const hasEntry =
              cell.current &&
              journalDates.has(`${calYear}-${calMonth}-${cell.day}`);
            const moodColor =
              showMoodCal && cell.current
                ? journalMoodColors.get(`${calYear}-${calMonth}-${cell.day}`)
                : undefined;
            return (
              <View key={i} style={st.calCell}>
                <View
                  style={[
                    st.calDayCircle,
                    isTodayCell && !moodColor && st.calDayToday,
                    moodColor ? { backgroundColor: moodColor } : undefined,
                  ]}
                >
                  <Text
                    style={[
                      st.calDayText,
                      !cell.current && st.calDayInactive,
                      (isTodayCell || !!moodColor) && st.calDayTodayText,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
                {hasEntry && !moodColor && <View style={st.calDot} />}
              </View>
            );
          })}
        </View>
        {showMoodCal && (
          <View style={st.moodLegend}>
            {MOODS.map((m) => (
              <View key={m.key} style={st.moodLegendItem}>
                <View style={[st.moodLegendDot, { backgroundColor: m.color }]} />
                <Text style={st.moodLegendLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Mood Bloom */}
      <View style={st.sideCard}>
        <View style={st.moodBloomHeader}>
          <Text style={st.sideCardTitle}>Mood Bloom</Text>
          <TouchableOpacity onPress={() => setShowMoodCal(!showMoodCal)}>
            <Text style={st.viewTrends}>
              {showMoodCal ? "Hide Insights" : "My Insights"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={st.moodBloomSummary}>
          <View style={st.moodDotsRow}>
            {moodStats.length > 0 ? (
              moodStats.map((ms, i) => (
                <View
                  key={i}
                  style={[st.moodDot, { backgroundColor: ms.mood.color }]}
                />
              ))
            ) : (
              <>
                <View
                  style={[st.moodDot, { backgroundColor: colors.muted3 }]}
                />
                <View
                  style={[st.moodDot, { backgroundColor: colors.muted3 }]}
                />
              </>
            )}
          </View>
          <View>
            <Text style={st.moodBloomLabel}>{dominantMoodLabel}</Text>
            <Text style={st.moodBloomSub}>Last 7 days</Text>
          </View>
        </View>
        {showMoodCal && allMoodCounts.length > 0 ? (
          <View style={{ marginTop: 4 }}>
            <BarChart
              data={{
                labels: allMoodCounts.map((mc) => mc.mood.emoji),
                datasets: [{
                  data: allMoodCounts.map((mc) => mc.count),
                  colors: allMoodCounts.map(
                    (mc) => () => mc.mood.color,
                  ),
                }],
              }}
              width={chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              showValuesOnTopOfBars
              withCustomBarColorFromData
              flatColor
              chartConfig={{
                backgroundColor: colors.surfaceContainerLowest,
                backgroundGradientFrom: colors.surfaceContainerLowest,
                backgroundGradientTo: colors.surfaceContainerLowest,
                decimalPlaces: 0,
                color: () => colors.onSurfaceVariant,
                labelColor: () => colors.onSurface,
                propsForLabels: {
                  fontSize: 14,
                },
                barPercentage: 0.6,
                propsForBackgroundLines: {
                  stroke: colors.surfaceVariant,
                  strokeDasharray: "",
                },
              }}
              style={{ borderRadius: radii.md, marginLeft: -16 }}
            />
            <View style={st.chartLegend}>
              {allMoodCounts.map((mc) => (
                <View key={mc.mood.key} style={st.chartLegendItem}>
                  <View style={[st.chartLegendDot, { backgroundColor: mc.mood.color }]} />
                  <Text style={st.chartLegendLabel}>
                    {mc.mood.label} ({mc.count})
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            {moodStats.map((ms) => (
              <View key={ms.mood.key} style={st.moodBarRow}>
                <Text style={st.moodBarLabel}>{ms.mood.label}</Text>
                <View style={st.moodBarTrack}>
                  <View
                    style={[
                      st.moodBarFill,
                      {
                        backgroundColor: ms.mood.color,
                        width:
                          `${Math.max(10, (ms.count / ms.total) * 100)}%` as any,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
            {moodStats.length === 0 && (
              <Text style={st.moodEmptyText}>
                Journal with a mood to see trends
              </Text>
            )}
          </>
        )}
      </View>

      {/* Streak card */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.streakCard}
      >
        <Ionicons name="trophy" size={24} color="rgba(255,255,255,0.7)" />
        <Text style={st.streakNumber}>
          {streak} Day{streak !== 1 ? "s" : ""}
        </Text>
        <Text style={st.streakLabel}>Streak</Text>
        <Text style={st.streakMsg}>
          {streak > 0
            ? "Your consistency is creating a beautiful garden of memories."
            : "Start journaling daily to build your streak!"}
        </Text>
      </LinearGradient>
    </>
  );

  // ── sidePanel (wide screens only) ─────────
  const sidePanelContent = (
    <ScrollView style={st.sidePanel} showsVerticalScrollIndicator={false}>
      <Text style={st.sidePanelTitle}>Your Journey</Text>
      {journeyCards}
    </ScrollView>
  );

  // ── Past entries card ─────────────────────
  const renderJournalCard = (item: Journal) => {
    const moodEmoji = getMoodEmoji(item.mood);
    const isHighlighted = highlightedId === item.id;
    return (
      <View
        key={item.id}
        ref={(ref) => { entryRefs.current[item.id] = ref; }}
      >
        <TouchableOpacity
          onPress={() => openEditEntry(item)}
          activeOpacity={0.8}
          style={[
            st.entryCard,
            isHighlighted && {
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: colors.surfaceContainerLow,
            },
          ]}
        >
        <View style={st.entryHeader}>
          <View style={{ flex: 1 }}>
            <View style={st.entryTitleRow}>
              {moodEmoji && <Text style={st.entryMoodEmoji}>{moodEmoji}</Text>}
              <Text style={st.entryTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={st.entryDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.muted4} />
          </TouchableOpacity>
        </View>
        <Text style={st.entryContent} numberOfLines={2}>
          {item.content}
        </Text>
        {item.mood && (
          <View style={st.entryMoodChip}>
            <Text style={st.entryMoodChipText}>
              {MOODS.find((m) => m.key === item.mood)?.label ?? item.mood}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      </View>
    );
  };

  // ── composeContent (inline JSX, not a component) ──
  const composeContent = (
    <ScrollView
      ref={composeScrollRef}
      style={st.composeScroll}
      contentContainerStyle={st.composeContent}
      showsVerticalScrollIndicator={false}
      onScroll={handleComposeScroll}
      scrollEventThrottle={16}
    >
      {/* Date header */}
      <Text style={st.todayLabel}>TODAY&apos;S REFLECTION</Text>
      <Text style={st.dateHeading}>
        {dateParts.dayOfWeek}, {dateParts.month} {dateParts.day}
      </Text>

      {/* Prompt card */}
      <View style={st.promptCard}>
        <Text style={st.promptIcon}>💡</Text>
        <Text style={st.promptQuestion}>{todayPrompt}</Text>
        <Text style={st.promptSubtext}>{todaySubtext}</Text>
      </View>

      {/* Writing area */}
      <View
        style={st.writeCard}
        onLayout={(e) => {
          writeCardBottomY.current =
            e.nativeEvent.layout.y + e.nativeEvent.layout.height;
        }}
      >
        <TextInput
          style={st.writeInput}
          placeholder="Dear Journal..."
          placeholderTextColor={colors.muted3}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={5000}
          textAlignVertical="top"
        />
        {/* Ruled lines visual */}
        <View style={st.ruledLines}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={st.ruledLine} />
          ))}
        </View>
      </View>

      {/* Bottom action row */}
      <View style={[st.actionRow, !isWide && { marginBottom: 10, alignSelf: 'flex-end' }]}>
        {/* Mood picker */}
        <TouchableOpacity
          onPress={() => {
            const moodKeys = MOODS.map((m) => m.key);
            const currentIdx = mood ? moodKeys.indexOf(mood) : -1;
            const nextIdx = (currentIdx + 1) % moodKeys.length;
            setMood(moodKeys[nextIdx]);
          }}
          style={[st.actionChip, mood ? st.actionChipActive : undefined]}
        >
          {mood ? (
            <Text style={st.actionChipEmoji}>{getMoodEmoji(mood)}</Text>
          ) : (
            <Ionicons
              name="happy-outline"
              size={14}
              color={colors.onSurfaceVariant}
            />
          )}
          <Text
            style={[
              st.actionChipText,
              mood ? st.actionChipTextActive : undefined,
            ]}
          >
            {mood
              ? MOODS.find((m) => m.key === mood)?.label?.toUpperCase()
              : "MOOD"}
          </Text>
        </TouchableOpacity>

        {/* Session type */}
        <TouchableOpacity
          onPress={() => {
            if (!sessionType) setSessionType("morning");
            else if (sessionType === "morning") setSessionType("evening");
            else setSessionType(null);
          }}
          style={[st.actionChip, sessionType ? st.actionChipActive : undefined]}
        >
          <Text
            style={[
              st.actionChipText,
              sessionType ? st.actionChipTextActive : undefined,
            ]}
          >
            {sessionType === "morning"
              ? "MORNING SESSION"
              : sessionType === "evening"
                ? "EVENING SESSION"
                : "SESSION"}
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={handleSaveNew}
            disabled={saving || !content.trim()}
            style={[st.saveBtn, !content.trim() && st.saveBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                <Text style={st.saveBtnText}>Save Entry</Text>
              </>
            )}
          </TouchableOpacity>
      </View>

      {/* Journey section (inline on mobile / small web) */}
      {!showSidePanel && (
        <View style={st.inlineJourney}>
          <Text style={st.inlineJourneyTitle}>Your Journey</Text>
          {journeyCards}
        </View>
      )}

      {/* Past entries */}
      {journals.length > 0 && (
        <View
          style={st.pastSection}
          ref={(ref) => { entryRefs.current['__past_section__'] = ref; }}
        >
          <Text style={st.pastTitle}>Past Entries</Text>
          {journals.map((j) => renderJournalCard(j))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={[st.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {loading ? (
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={st.mainRow}>
          <View style={st.mainColumn}>
            {composeContent}
            {showFab && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={st.fab}
                onPress={() => composeScrollRef.current?.scrollTo({ y: 0, animated: true })}
              >
                <LinearGradient
                  colors={[colors.primaryContainer, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={st.fabGradient}
                >
                  <Ionicons name="add" size={24} color={colors.onPrimary} />
                  <Text style={st.fabText}>New Entry</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          {showSidePanel && sidePanelContent}
        </View>
      )}

      {/* ── Edit Modal (existing entries) ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={st.modalSafe}>
          <LinearGradient
            colors={[colors.primaryContainer, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.modalHeader}
          >
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={st.modalHeaderBtn}
            >
              <Ionicons name="close" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
            <Text style={st.modalHeaderTitle}>Edit Entry</Text>
            <TouchableOpacity
              onPress={handleSaveEdit}
              disabled={saving || !editTitle.trim() || !editContent.trim()}
              style={[
                st.modalHeaderBtn,
                (!editTitle.trim() || !editContent.trim()) && { opacity: 0.4 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={st.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              style={st.modalBody}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={st.modalTitleInput}
                placeholder="Title"
                placeholderTextColor={colors.muted3}
                value={editTitle}
                onChangeText={setEditTitle}
                maxLength={200}
                autoFocus
              />

              <Text style={st.modalSectionLabel}>How are you feeling?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={st.modalMoodRow}
                contentContainerStyle={{ gap: 8 }}
              >
                {MOODS.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() =>
                      setEditMood(editMood === m.key ? null : m.key)
                    }
                    style={[
                      st.modalMoodOption,
                      editMood === m.key && st.modalMoodOptionActive,
                    ]}
                  >
                    <Text style={st.modalMoodEmoji}>{m.emoji}</Text>
                    <Text
                      style={[
                        st.modalMoodLabel,
                        editMood === m.key && st.modalMoodLabelActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={st.modalContentInput}
                placeholder="Write your thoughts..."
                placeholderTextColor={colors.muted3}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                maxLength={5000}
                textAlignVertical="top"
              />
              <Text style={st.modalCharCount}>{editContent.length}/5000</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Layout ────────────────────────────────
  mainRow: { flex: 1, flexDirection: "row" },
  mainColumn: { flex: 1 },

  // ── Compose scroll ────────────────────────
  composeScroll: { flex: 1 },
  composeContent: {
    padding: 28,
    paddingBottom: 120,
    ...(Platform.OS === "web"
      ? { maxWidth: 720, alignSelf: "center" as any, width: "100%" as any }
      : {}),
  },

  // ── Date header ───────────────────────────
  todayLabel: {
    fontSize: 12,
    fontFamily: fonts.displaySemiBold,
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  dateHeading: {
    fontSize: 34,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginBottom: 28,
  },

  // ── Prompt card ───────────────────────────
  promptCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 28,
    marginBottom: 24,
    ...ambientShadow,
  },
  promptIcon: { fontSize: 28, marginBottom: 14 },
  promptQuestion: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.primary,
    lineHeight: 28,
    marginBottom: 10,
  },
  promptSubtext: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // ── Write card ────────────────────────────
  writeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 24,
    paddingBottom: 16,
    marginBottom: 20,
    minHeight: 240,
    ...ambientShadow,
    position: "relative",
  },
  writeInput: {
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    lineHeight: 32,
    minHeight: 200,
    padding: 0,
    zIndex: 1,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  ruledLines: {
    position: "absolute",
    top: 56,
    left: 24,
    right: 24,
  },
  ruledLine: {
    height: 1,
    backgroundColor: colors.surfaceVariant,
    marginBottom: 31,
  },

  // ── Action row ────────────────────────────
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 36,
  },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 36,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  actionChipActive: {
    backgroundColor: colors.secondaryFixed,
    borderColor: colors.secondary,
  },
  actionChipEmoji: { fontSize: 14 },
  actionChipText: {
    fontSize: 11,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  actionChipTextActive: { color: colors.onSecondaryFixed },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 12,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
    textAlign: "center",
    lineHeight: 16,
  },

  // ── Inline journey (mobile / small web) ────
  inlineJourney: {
    marginTop: 8,
    marginBottom: 16,
  },
  inlineJourneyTitle: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginBottom: 16,
  },

  // ── Past entries ──────────────────────────
  pastSection: { marginTop: 8 },
  pastTitle: {
    fontSize: 18,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    marginBottom: 16,
  },
  entryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 12,
    ...ambientShadow,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  entryTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryMoodEmoji: { fontSize: 16 },
  entryTitle: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
    flex: 1,
  },
  entryDate: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    marginTop: 2,
  },
  entryContent: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  entryMoodChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 8,
  },
  entryMoodChipText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSecondaryFixed,
  },

  // ── Side panel ────────────────────────────
  sidePanel: {
    maxWidth: 450,
    padding: 20,
    backgroundColor: colors.surfaceContainerLow,
  },
  sidePanelTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    marginBottom: 20,
  },
  sideCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: 18,
    marginBottom: 16,
    ...ambientShadow,
  },
  sideCardTitle: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },

  // ── Calendar ──────────────────────────────
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calMonthLabel: {
    fontSize: 15,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  calNav: { flexDirection: "row", gap: 4 },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLow,
  },
  calDayNames: { flexDirection: "row", marginBottom: 8 },
  calDayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.28%" as any,
    alignItems: "center",
    paddingVertical: 3,
  },
  calDayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayToday: { backgroundColor: colors.primary },
  calDayText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurface,
  },
  calDayInactive: { color: colors.muted3 },
  calDayTodayText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemiBold,
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  moodLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  moodLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  moodLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  moodLegendLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLegendLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurfaceVariant,
  },

  // ── Mood Bloom ────────────────────────────
  moodBloomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  viewTrends: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  moodBloomSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  moodDotsRow: { flexDirection: "row" },
  moodDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
    marginRight: -6,
  },
  moodBloomLabel: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.onSurface,
  },
  moodBloomSub: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurfaceVariant,
  },
  moodBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  moodBarLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurface,
    width: 70,
  },
  moodBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
    overflow: "hidden",
  },
  moodBarFill: { height: 8, borderRadius: 4 },
  moodEmptyText: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    fontStyle: "italic",
  },

  // ── Streak card ───────────────────────────
  streakCard: {
    borderRadius: radii.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  streakNumber: {
    fontSize: 32,
    fontFamily: fonts.displayExtraBold,
    color: colors.onPrimary,
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
    marginBottom: 8,
  },
  streakMsg: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 18,
  },

  // ── FAB ───────────────────────────────────
  fab: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 32 : 24,
    right: 24,
    borderRadius: radii.full,
    ...ambientShadow,
    shadowOpacity: 0.15,
    elevation: 6,
  },
  fabGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radii.full,
  },
  fabText: {
    fontSize: 14,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
  },

  // ── Modal ─────────────────────────────────
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  modalHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  modalSaveText: {
    fontSize: 16,
    fontFamily: fonts.displaySemiBold,
    color: colors.onPrimary,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  modalTitleInput: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
    marginBottom: spacing.md,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  modalSectionLabel: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  modalMoodRow: { marginBottom: spacing.lg },
  modalMoodOption: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  modalMoodOptionActive: {
    backgroundColor: colors.secondaryFixed,
    borderColor: colors.secondary,
  },
  modalMoodEmoji: { fontSize: 22, marginBottom: 2 },
  modalMoodLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  modalMoodLabelActive: {
    color: colors.onSecondaryFixed,
    fontFamily: fonts.bodySemiBold,
  },
  modalContentInput: {
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    lineHeight: 24,
    minHeight: 200,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  modalCharCount: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    textAlign: "right",
    marginTop: spacing.xs,
  },
});
