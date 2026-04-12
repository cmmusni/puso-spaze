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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../context/UserContext";
import { apiFetchMessages, apiSendMessage, apiSetTyping, apiGetTyping } from "../services/api";
import { colors as defaultColors, fonts, radii, spacing } from "../constants/theme";
import { useThemeStore } from "../context/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import type { Message } from "../../../packages/types";

const POLL_INTERVAL = 5000;
const TYPING_POLL_INTERVAL = 2000;
const TYPING_DEBOUNCE_MS = 800;

export default function ChatScreen({ navigation, route }: any) {
  const { conversationId, coachName } = route.params as { conversationId: string; coachName?: string };
  const { userId, role } = useUserStore();
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCoach = role === "COACH" || role === "ADMIN";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, conversationId]);

  // ── Poll for new messages (only while focused) ───
  useFocusEffect(
    useCallback(() => {
      fetchMessages();
      const interval = setInterval(fetchMessages, POLL_INTERVAL);
      return () => clearInterval(interval);
    }, [fetchMessages])
  );

  // ── Poll for typing status (only while focused) ──
  useFocusEffect(
    useCallback(() => {
      if (!userId || !conversationId) return;
      const poll = async () => {
        try {
          const { typing } = await apiGetTyping(conversationId, userId);
          setOtherIsTyping(typing);
        } catch { /* silent */ }
      };
      poll();
      const interval = setInterval(poll, TYPING_POLL_INTERVAL);
      return () => {
        clearInterval(interval);
        setOtherIsTyping(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [userId, conversationId])
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
      setIsMultiline(false);
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
    // Find the other participant
    const otherMsg = messages.find((m) => m.senderId !== userId);
    if (otherMsg?.sender?.displayName) return otherMsg.sender.displayName;
    // Fallback: show first message sender, then route param, then generic
    return messages[0]?.sender?.displayName ?? coachName ?? "Chat";
  };

  const getInitial = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  // ── Render message bubble ─────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === userId;
    const isCoachMessage = item.sender?.role === "COACH" || item.sender?.role === "ADMIN";
    const showSender =
      index === 0 || messages[index - 1]?.senderId !== item.senderId;
    const time = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.messageRowMine : styles.messageRowOther,
        ]}
      >
        {/* Avatar for other's messages */}
        {!isMine && showSender && (
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
        {!isMine && !showSender && <View style={styles.msgAvatarSpacer} />}

        <View style={{ maxWidth: "75%" }}>
          {showSender && (
            <Text
              style={[
                styles.senderName,
                isMine ? styles.senderNameMine : styles.senderNameOther,
              ]}
            >
              {item.sender?.displayName ?? "Unknown"}
              {isCoachMessage && !isMine && (
                <Text style={styles.coachBadgeInline}> · Coach</Text>
              )}
            </Text>
          )}
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleOther,
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
          <Text
            style={[
              styles.msgTime,
              isMine ? styles.msgTimeMine : styles.msgTimeOther,
            ]}
          >
            {time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "light-content"} />

      {/* ── Top bar ── */}
      <LinearGradient
        colors={[colors.primaryContainer, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topBar}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate(isCoach ? "SpazeConversations" : "SpazeCoach")}
          style={styles.topBarBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {getHeaderLabel()}
          </Text>
          {isCoach && (
            <Text style={styles.topBarSubtitle}>All coaches can see this</Text>
          )}
        </View>
        <View style={styles.topBarBtn} />
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
            {/* ── Transparency banner ── */}
            {/* <View style={styles.transparencyBanner}>
              <Ionicons name="eye-outline" size={14} color={colors.muted5} />
              <Text style={styles.transparencyText}>
                All coaches can view this conversation for your safety and support.
              </Text>
            </View> */}

            {/* ── Messages ── */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.muted3} />
                  <Text style={styles.emptyChatText}>
                    Start the conversation
                  </Text>
                </View>
              }
              ListFooterComponent={
                otherIsTyping ? (
                  <View style={styles.typingRow}>
                    <View style={styles.typingBubble}>
                      {[dot1, dot2, dot3].map((dot, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.typingDot,
                            { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Input bar ── */}
            <View style={styles.inputBar}>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.placeholder}
                  value={text}
                  onChangeText={handleTextChange}
                  maxLength={2000}
                  multiline={isMultiline}
                  onSubmitEditing={() => {
                    if (!isMultiline) handleSend();
                  }}
                  blurOnSubmit={false}
                  {...(Platform.OS === 'web' ? {
                    onKeyPress: (e: any) => {
                      const nativeEvent = e.nativeEvent;
                      if (nativeEvent.key === 'Enter' && (nativeEvent.metaKey || nativeEvent.ctrlKey)) {
                        e.preventDefault();
                        handleSend();
                      } else if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey && !isMultiline) {
                        // Plain Enter in single-line mode switches to multiline
                        e.preventDefault();
                        setIsMultiline(true);
                      }
                    },
                  } : {})}
                />
              </View>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim() || sending}
                style={[
                  styles.sendBtn,
                  (!text.trim() || sending) && styles.sendBtnDisabled,
                ]}
                activeOpacity={0.75}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="send" size={18} color={colors.onPrimary} />
                )}
              </TouchableOpacity>
            </View>
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

  // ── Top bar ─────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 14) + 12 : 12,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  topBarSubtitle: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Transparency banner ───────────────────
  transparencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    ...(Platform.OS === "web"
      ? { maxWidth: 680, alignSelf: "center" as any, width: "100%" as any, borderRadius: radii.sm }
      : {}),
  },
  transparencyText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.muted5,
    flex: 1,
  },

  // ── Messages ──────────────────────────────
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    ...(Platform.OS === "web"
      ? { maxWidth: 680, alignSelf: "center" as any, width: "100%" as any }
      : {}),
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },

  // Avatar
  msgAvatarWrap: {
    marginRight: 8,
    alignSelf: "flex-end",
  },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: 12,
    fontFamily: fonts.displayBold,
    color: colors.onPrimary,
  },
  msgAvatarSpacer: {
    width: 38,
  },

  // Sender name
  senderName: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    marginBottom: 2,
  },
  senderNameMine: {
    color: colors.muted4,
    textAlign: "right",
  },
  senderNameOther: {
    color: colors.muted5,
    marginLeft: 4,
  },
  coachBadgeInline: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.secondary,
  },

  // Bubble
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.lg,
    maxWidth: "100%",
  },
  bubbleMine: {
    backgroundColor: colors.primaryContainer,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
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

  // Time
  msgTime: {
    fontSize: 10,
    fontFamily: fonts.bodyRegular,
    color: colors.muted4,
    marginTop: 2,
  },
  msgTimeMine: {
    textAlign: "right",
  },
  msgTimeOther: {
    marginLeft: 4,
  },

  // ── Empty ─────────────────────────────────
  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyChatText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.muted5,
    marginTop: spacing.sm,
  },

  // ── Typing indicator ──────────────────────
  typingRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "flex-start",
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.onSurfaceVariant,
  },

  // ── Input bar ─────────────────────────────
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.muted1,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginRight: 8,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.onSurface,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
