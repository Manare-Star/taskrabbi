import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useSendMessage, useThread, useThreadMessages } from "../../lib/queries/chat";
import { EmptyState } from "../../components/EmptyState";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import type { ChatMessage } from "../../lib/types";

type ListItem = { kind: "divider"; id: string; label: string } | { kind: "message"; id: string; message: ChatMessage };

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function ChatHeaderTitle({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <View style={styles.headerTitleRow}>
      <View style={styles.headerAvatar}>
        <Text style={styles.headerAvatarText}>{initialsOf(name)}</Text>
      </View>
      <View style={styles.headerTextCol}>
        <Text style={styles.headerName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { profile } = useAuth();
  const { data: thread } = useThread(threadId);
  const { data: messages, isLoading } = useThreadMessages(threadId);
  const sendMessage = useSendMessage();
  const [body, setBody] = useState("");
  const listRef = useRef<FlatList<ListItem>>(null);

  const otherParticipant =
    thread && profile
      ? thread.client_id === profile.id
        ? thread.tasker
        : thread.client
      : undefined;

  const items = useMemo<ListItem[]>(() => {
    if (!messages?.length) return [];
    const result: ListItem[] = [];
    let lastDay: string | null = null;
    for (const message of messages) {
      const createdAt = new Date(message.created_at);
      const day = createdAt.toDateString();
      if (day !== lastDay) {
        result.push({ kind: "divider", id: `divider-${day}`, label: dayLabel(createdAt) });
        lastDay = day;
      }
      result.push({ kind: "message", id: message.id, message });
    }
    return result;
  }, [messages]);

  useEffect(() => {
    if (items.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [items.length]);

  const onSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !threadId || !profile) return;
    setBody("");
    try {
      await sendMessage.mutateAsync({ threadId, senderId: profile.id, body: trimmed });
    } catch {
      setBody(trimmed);
    }
  };

  if (isLoading || !thread) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <ChatHeaderTitle name={otherParticipant?.full_name ?? "Chat"} subtitle={thread.task.title} />
          ),
        }}
      />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="hand-left-outline" title="Say hi 👋" subtitle="Start the conversation." />}
        renderItem={({ item }) => {
          if (item.kind === "divider") {
            return (
              <View style={styles.dividerRow}>
                <Text style={styles.dividerText}>{item.label}</Text>
              </View>
            );
          }
          const isMe = item.message.sender_id === profile?.id;
          return (
            <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={isMe ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.message.body}</Text>
              </View>
              <Text style={[styles.timeText, isMe ? styles.timeTextMine : styles.timeTextTheirs]}>
                {timeLabel(new Date(item.message.created_at))}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Type a message..."
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Pressable
          onPress={onSend}
          style={[styles.sendButton, !body.trim() && styles.sendButtonDisabled]}
          disabled={!body.trim()}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  headerTextCol: { maxWidth: 190 },
  headerName: { ...typography.bodyStrong, fontSize: 15, color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted },
  listContent: { padding: spacing.md, flexGrow: 1 },
  dividerRow: { alignItems: "center", marginVertical: spacing.sm },
  dividerText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: "80%" },
  bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { padding: spacing.sm + 4, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4, ...shadow.card },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4, ...shadow.card },
  bubbleTextMine: { ...typography.body, color: colors.white },
  bubbleTextTheirs: { ...typography.body, color: colors.text },
  timeText: { fontSize: 10, color: colors.textFaint, marginTop: 2, marginHorizontal: 4 },
  timeTextMine: { textAlign: "right" },
  timeTextTheirs: { textAlign: "left" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: colors.white,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.button,
  },
  sendButtonDisabled: { backgroundColor: colors.borderStrong, shadowOpacity: 0, elevation: 0 },
});
