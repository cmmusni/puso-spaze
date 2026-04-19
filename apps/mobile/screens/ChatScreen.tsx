// ─────────────────────────────────────────────
// screens/ChatScreen.tsx
// Real-time chat view for a conversation
// Polls for new messages every 5 seconds
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  useWindowDimensions,
  AppState,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import { apiFetchMessages, apiSendMessage, apiSetTyping, apiGetTyping } from "../services/api";
import { colors as defaultColors, fonts, radii, spacing, ambientShadow } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import type { Message } from "../../../packages/types";

const POLL_INTERVAL = 5000;
const TYPING_POLL_INTERVAL = 2000;
const TYPING_DEBOUNCE_MS = 800;

// ── Emoji picker palette (curated, no extra deps) ──
const EMOJI_LIST = [
  "😀","😁","😂","🤣","😊","😍","🥰","😘","😎","🤗",
  "🤔","😴","😌","😢","😭","😡","🥺","😅","😇","🙃",
  "👍","👎","👏","🙌","🙏","👋","💪","🤝","✌️","🤞",
  "❤️","💔","💖","💕","💗","💙","💜","🧡","💛","💚",
  "🔥","✨","🌟","⭐","🎉","🎊","💯","💫","☀️","🌙",
  "🌈","☕","🍕","🍔","🍰","🎂","🌹","🌺","🍀","🕊️",
];

// ── Date separator helper ───────────────────
const formatDateSeparator = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - msgDay.getTime();
  const dayMs = 86400000;
  if (diff < dayMs) return "Today";
  if (diff < dayMs * 2) return "Yesterday";
  if (diff < dayMs * 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export default function ChatScreen({ navigation, route }: any) {
  const routeParams = (route?.params ?? {}) as {
    conversationId?: string;
    coachName?: string;
    convUserId?: string;
    convCoachId?: string;
  };
  const webPathname =
    Platform.OS === 'web'
      ? String((globalThis as { location?: { pathname?: string } }).location?.pathname ?? '')
      : '';
  const webSearch =
    Platform.OS === 'web'
      ? String((globalThis as { location?: { search?: string } }).location?.search ?? '')
      : '';
  const webConversationId =
    Platform.OS === 'web'
      ? webPathname.match(/\/chat\/([^/?#]+)/i)?.[1]
          ? decodeURIComponent(webPathname.match(/\/chat\/([^/?#]+)/i)![1])
          : new URLSearchParams(webSearch).get('conversationId') ?? undefined
      : undefined;
  const conversationId = routeParams.conversationId ?? webConversationId;
  const { coachName, convUserId, convCoachId } = routeParams;
  const { userId, role } = useUserStore();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCoach = role === "COACH" || role === "ADMIN";
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 600;

  // Coach viewing a conversation they're not a participant in → read-only
  const isReadOnly = isCoach && !!convUserId && !!convCoachId
    && convUserId !== userId && convCoachId !== userId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [otherLastActiveAt, setOtherLastActiveAt] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOtherOnline = useMemo(() => {
    if (!otherLastActiveAt) return false;
    return Date.now() - new Date(otherLastActiveAt).getTime() < 15 * 60 * 1000;
  }, [otherLastActiveAt]);

  if (!conversationId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.onSurface, marginBottom: 8 }}>
            Conversation unavailable
          </Text>
          <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' }}>
            This notification did not include a valid conversation link.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Animated dots for typing indicator ───
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!otherIsTyping) return;
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); dot1.setValue(0); dot2.setValue(0); dot3.setValue(0); };
  }, [otherIsTyping, dot1, dot2, dot3]);

  // ── Fetch messages ────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!userId || !conversationId) return;
    try {
      const res = await apiFetchMessages(conversationId, userId);
      setMessages(res.messages);
      setOtherLastActiveAt(res.otherLastActiveAt ?? null);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, conversationId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMessages();
  }, [fetchMessages]);

  // ── Adaptive polling: slow when backgrounded / hidden ────
  // Saves bandwidth and battery while not actively reading.
  const isAppHidden = useCallback(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      return document.visibilityState === "hidden";
    }
    return AppState.currentState !== "active";
  }, []);

  // ── Poll for new messages (only while focused) ───
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;
      const tick = async () => {
        if (cancelled) return;
        await fetchMessages();
        if (cancelled) return;
        const delay = isAppHidden() ? POLL_INTERVAL * 6 : POLL_INTERVAL;
        timer = setTimeout(tick, delay);
      };
      tick();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [fetchMessages, isAppHidden])
  );

  // ── Poll for typing status (only while focused + input has content) ──
  // The other party's typing indicator is only meaningful while we're
  // composing too; pausing it when our input is empty halves typing-poll
  // traffic for the common "just reading" case.
  useFocusEffect(
    useCallback(() => {
      if (!userId || !conversationId) return;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;
      const poll = async () => {
        if (cancelled) return;
        try {
          const { typing } = await apiGetTyping(conversationId, userId);
          setOtherIsTyping(typing);
        } catch {
          /* silent */
        }
        if (cancelled) return;
        const hidden = isAppHidden();
        const delay = hidden ? TYPING_POLL_INTERVAL * 5 : TYPING_POLL_INTERVAL;
        timer = setTimeout(poll, delay);
      };
      poll();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
        setOtherIsTyping(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [userId, conversationId, isAppHidden])
  );

  // ── Notify server when user types ────────
  const handleTextChange = (val: string) => {
    setText(val);
    if (!userId || !val.trim()) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      apiSetTyping(conversationId, userId).catch(() => {});
    }, TYPING_DEBOUNCE_MS);
  };

  // ── Append emoji to message text ──────────
  const handleInsertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  // ── Send message ──────────────────────────
  const handleSend = async () => {
    if (!userId || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiSendMessage(conversationId, {
        senderId: userId,
        content: text.trim(),
      });
      setMessages((prev) => [...prev, res.message]);
      setText("");
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Get header label from first message ───
  const getHeaderLabel = () => {
    if (messages.length === 0) return coachName ?? "Chat";
    const otherMsg = messages.find((m) => m.senderId !== userId);
    if (otherMsg?.sender?.displayName) return otherMsg.sender.displayName;
    return messages[0]?.sender?.displayName ?? coachName ?? "Chat";
  };

  const getInitial = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // ── Should show date separator ────────────
  const shouldShowDateSeparator = (index: number): boolean => {
    if (index === 0) return true;
    const curr = new Date(messages[index].createdAt);
    const prev = new Date(messages[index - 1].createdAt);
    return curr.toDateString() !== prev.toDateString();
  };

  // ── Is last in group (same sender, consecutive) ──
  const isLastInGroup = (index: number): boolean => {
    if (index === messages.length - 1) return true;
    return messages[index + 1]?.senderId !== messages[index].senderId;
  };

  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true;
    if (shouldShowDateSeparator(index)) return true;
    return messages[index - 1]?.senderId !== messages[index].senderId;
  };

  // ── Render message bubble ─────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === userId;
    const isCoachMessage = item.sender?.role === "COACH" || item.sender?.role === "ADMIN";
    const first = isFirstInGroup(index);
    const last = isLastInGroup(index);
    const showDate = shouldShowDateSeparator(index);
    const time = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Bubble corner radii for grouped messages (messenger-style tail)
    const bubbleRadius = {
      borderTopLeftRadius: isMine ? 20 : (first ? 20 : 6),
      borderTopRightRadius: isMine ? (first ? 20 : 6) : 20,
      borderBottomLeftRadius: isMine ? 20 : (last ? 4 : 6),
      borderBottomRightRadius: isMine ? (last ? 4 : 6) : 20,
    };

    return (
      <>
        {/* ── Date separator ── */}
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>
              {formatDateSeparator(new Date(item.createdAt))}
            </Text>
            <View style={styles.dateLine} />
          </View>
        )}

        <View
          style={[
            styles.messageRow,
            isMine ? styles.messageRowMine : styles.messageRowOther,
            !last && styles.messageRowGrouped,
          ]}
        >
          {/* Avatar — only on last message in group for other's messages */}
          {!isMine && last && (
            <View style={styles.msgAvatarWrap}>
              <LinearGradient
                colors={[colors.primaryContainer, colors.secondary]}
                style={styles.msgAvatar}
              >
                <Text style={styles.msgAvatarText}>
                  {getInitial(item.sender?.displayName)}
                </Text>
              </LinearGradient>
            </View>
          )}
          {!isMine && !last && <View style={styles.msgAvatarSpacer} />}

          <View style={styles.bubbleColumn}>
            {/* Sender name — only on first message in group */}
            {first && !isMine && (
              <Text style={styles.senderNameOther}>
                {item.sender?.displayName ?? "Unknown"}
                {isCoachMessage && (
                  <Text style={styles.coachBadgeInline}> · Coach</Text>
                )}
              </Text>
            )}

            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleOther,
                bubbleRadius,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
                ]}
              >
                {item.content}
              </Text>
            </View>

            {/* Timestamp — only on last message in group */}
            {last && (
              <Text
                style={[
                  styles.msgTime,
                  isMine ? styles.msgTimeMine : styles.msgTimeOther,
                ]}
              >
                {time}
              </Text>
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Top bar ── */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topBar}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate(isCoach ? "SpazeConversations" : "SpazeCoach")}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onPrimary} />
        </TouchableOpacity>

        {/* Avatar + name left-aligned (messenger-style) */}
        <View style={styles.topBarAvatar}>
          <LinearGradient
            colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.1)"]}
            style={styles.topBarAvatarCircle}
          >
            <Text style={styles.topBarAvatarText}>
              {getInitial(getHeaderLabel())}
            </Text>
          </LinearGradient>
        </View>
        <View style={styles.topBarInfo}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {getHeaderLabel()}
          </Text>
          {isCoach ? (
            <Text style={styles.topBarSubtitle}>All coaches can see this</Text>
          ) : (
            <View style={styles.topBarOnlineRow}>
              <View
                style={[
                  styles.onlineDot,
                  !isOtherOnline && { backgroundColor: "rgba(255,255,255,0.5)" },
                ]}
              />
              <Text style={styles.topBarSubtitle}>
                {isOtherOnline ? "Online" : "Offline"}
              </Text>
            </View>
          )}
        </View>

        {/* Action button placeholder */}
        <View style={styles.topBarAction} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* ── Messages ── */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[
                styles.messageList,
                isWide && styles.messageListWide,
              ]}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <View style={styles.emptyChatIcon}>
                    <Ionicons name="chatbubbles-outline" size={40} color={colors.secondary} />
                  </View>
                  <Text style={styles.emptyChatTitle}>
                    Start the conversation
                  </Text>
                  <Text style={styles.emptyChatSub}>
                    Send a message to begin chatting
                  </Text>
                </View>
              }
              ListFooterComponent={
                otherIsTyping ? (
                  <View style={styles.typingRow}>
                    <View style={styles.typingAvatarWrap}>
                      <LinearGradient
                        colors={[colors.primaryContainer, colors.secondary]}
                        style={styles.typingAvatar}
                      >
                        <Text style={styles.typingAvatarText}>
                          {getInitial(getHeaderLabel())}
                        </Text>
                      </LinearGradient>
                    </View>
                    <View style={styles.typingBubble}>
                      {[dot1, dot2, dot3].map((dot, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.typingDot,
                            { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Input bar / Read-only notice ── */}
            {isReadOnly ? (
              <View style={[styles.readOnlyBar, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="eye-outline" size={16} color={colors.muted5} />
                <Text style={[styles.readOnlyText, { color: colors.muted5 }]}>
                  View only — this user hasn't messaged you
                </Text>
              </View>
            ) : (
              <View>
                {showEmojiPicker && (
                  <View style={[styles.emojiPanel, isWide && styles.inputBarWide]}>
                    {EMOJI_LIST.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiBtn}
                        onPress={() => handleInsertEmoji(emoji)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={[styles.inputBar, isWide && styles.inputBarWide]}>
                  <TouchableOpacity
                    onPress={() => setShowEmojiPicker((v) => !v)}
                    activeOpacity={0.7}
                    style={styles.emojiToggleBtn}
                  >
                    <Ionicons
                      name={showEmojiPicker ? "close-circle" : "happy-outline"}
                      size={26}
                      color={showEmojiPicker ? colors.secondary : colors.muted5}
                    />
                  </TouchableOpacity>
                  <View style={styles.inputWrap}>
                  <TextInput
                    style={[
                      styles.textInput,
                      !text.includes('\n') && { height: 22 },
                    ]}
                    placeholder="Message..."
                    placeholderTextColor={colors.placeholder}
                    value={text}
                    onChangeText={handleTextChange}
                    maxLength={2000}
                    multiline
                    blurOnSubmit={false}
                    {...(Platform.OS === 'web' ? {
                      onKeyPress: (e: any) => {
                        const nativeEvent = e.nativeEvent;
                        if (nativeEvent.key === 'Enter' && (nativeEvent.metaKey || nativeEvent.ctrlKey)) {
                          e.preventDefault();
                          handleSend();
                        }
                      },
                    } : {})}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!text.trim() || sending}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={
                      !text.trim() || sending
                        ? [colors.muted3, colors.muted3]
                        : [colors.primaryContainer, colors.secondary]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendBtn}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="send" size={17} color={colors.onPrimary} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────
const createStyles = (colors: typeof defaultColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Top bar (messenger-style: avatar + name left-aligned) ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 14) + 10 : 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  topBarAvatar: {
    marginLeft: 4,
    marginRight: 10,
  },
  topBarAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarAvatarText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  topBarInfo: {
    flex: 1,
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  topBarOnlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  topBarSubtitle: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: "rgba(255,255,255,0.65)",
  },
  topBarAction: {
    width: 36,
    height: 36,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Date separator ────────────────────────
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.muted1,
  },
  dateText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted4,
    paddingHorizontal: 12,
    letterSpacing: 0.3,
  },

  // ── Messages ──────────────────────────────
  messageList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  messageListWide: {
    maxWidth: 680,
    alignSelf: "center" as any,
    width: "100%" as any,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  messageRowGrouped: {
    marginBottom: 2,
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },

  // Avatar (bottom of group, messenger-style)
  msgAvatarWrap: {
    marginRight: 8,
    alignSelf: "flex-end",
    marginBottom: 18,
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: 11,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  msgAvatarSpacer: {
    width: 36,
  },

  // Bubble column
  bubbleColumn: {
    maxWidth: "75%",
  },

  // Sender name
  senderNameOther: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted4,
    marginBottom: 3,
    marginLeft: 4,
  },
  coachBadgeInline: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.secondary,
  },

  // Bubble — organic rounded shapes
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "100%",
  },
  bubbleMine: {
    backgroundColor: colors.primaryContainer,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.muted1,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: colors.onPrimary,
  },
  bubbleTextOther: {
    color: colors.onSurface,
  },

  // Time (only shown on last in group)
  msgTime: {
    fontSize: 10,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    marginTop: 3,
    marginBottom: 6,
  },
  msgTimeMine: {
    textAlign: "right",
    marginRight: 2,
  },
  msgTimeOther: {
    marginLeft: 4,
  },

  // ── Empty state ───────────────────────────
  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyChatIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyChatTitle: {
    fontSize: 17,
    fontFamily: fonts.displayBold,
    color: colors.onSurface,
    marginBottom: 4,
  },
  emptyChatSub: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
  },

  // ── Typing indicator (with mini avatar) ───
  typingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: spacing.xs,
    marginTop: 2,
  },
  typingAvatarWrap: {
    marginRight: 8,
    marginBottom: 2,
  },
  typingAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  typingAvatarText: {
    fontSize: 9,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted4,
  },

  // ── Input bar ─────────────────────────────
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.muted1,
  },
  inputBarWide: {
    maxWidth: 680,
    alignSelf: "center" as any,
    width: "100%" as any,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    marginRight: 8,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    maxHeight: 100,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  readOnlyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  readOnlyText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },
  emojiToggleBtn: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  emojiPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.muted1,
    maxHeight: 220,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  emojiText: {
    fontSize: 24,
    lineHeight: 28,
  },
});
