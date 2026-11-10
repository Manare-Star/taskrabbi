import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { useMarkThreadRead, useSendMessage, useThread, useThreadMessages } from "../../lib/queries/chat";
import { isBlocked, useBlockUser, useBlockedUsers, useUnblockUser } from "../../lib/queries/moderation";
import { ActionMenu, type ActionMenuItem } from "../../components/ActionMenu";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { HeaderButton } from "../../components/HeaderButton";
import { ScreenLoader } from "../../components/ScreenLoader";
import { StatusPill } from "../../components/StatusPill";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../../lib/theme";
import { LIMITS } from "../../lib/config";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";
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

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const { data: thread, isLoading: threadLoading, error: threadError, refetch: refetchThread } = useThread(threadId);
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(threadId);
  const { data: blockedUsers } = useBlockedUsers(profile?.id);
  const sendMessage = useSendMessage();
  const markRead = useMarkThreadRead();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();

  const [body, setBody] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList<ListItem>>(null);

  // Being on this screen means you've seen everything in it: mark read on open and again
  // whenever a new message arrives. Failures are harmless (the badge just lingers).
  const messageCount = messages?.length ?? 0;
  useEffect(() => {
    if (threadId) markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messageCount]);

  const other = thread && profile ? (thread.client_id === profile.id ? thread.tasker : thread.client) : undefined;
  const otherName = other?.full_name || "Chat";
  const blocked = isBlocked(blockedUsers, other?.id);

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

  if (threadLoading || messagesLoading) return <ScreenLoader />;
  if (threadError || !thread || !profile) {
    return (
      <EmptyState
        icon="chatbubble-outline"
        title="This conversation isn't available"
        subtitle={threadError ? getErrorMessage(threadError) : "It may have been removed."}
        action={threadError ? { label: "Try again", onPress: () => refetchThread() } : { label: "Go back", onPress: () => router.back() }}
      />
    );
  }

  const onSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !threadId) return;
    setBody("");
    haptics.tap();
    try {
      await sendMessage.mutateAsync({ threadId, senderId: profile.id, body: trimmed });
    } catch (err) {
      // Put the text back so nothing typed is lost, and say why it didn't go.
      setBody(trimmed);
      toast.error(getErrorMessage(err));
    }
  };

  const onToggleBlock = async () => {
    if (!other) return;
    const input = { blockerId: profile.id, blockedId: other.id };
    try {
      if (blocked) {
        await unblockUser.mutateAsync(input);
        toast.info(`${otherName} is unblocked`);
      } else {
        await blockUser.mutateAsync(input);
        toast.info(`${otherName} is blocked`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const menuItems: ActionMenuItem[] = other
    ? [
        { label: "View profile", icon: "person-outline", onPress: () => router.push(`/user/${other.id}`) },
        { label: "View task", icon: "document-text-outline", onPress: () => router.push(`/task/${thread.task_id}`) },
        {
          label: `Report ${otherName}`,
          icon: "flag-outline",
          onPress: () => router.push({ pathname: "/report", params: { userId: other.id, taskId: thread.task_id, name: otherName } }),
        },
        { label: blocked ? `Unblock ${otherName}` : `Block ${otherName}`, icon: "ban-outline", destructive: !blocked, onPress: onToggleBlock },
      ]
    : [];

  const canSend = body.trim().length > 0 && !sendMessage.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              style={styles.headerTitleRow}
              onPress={other ? () => router.push(`/user/${other.id}`) : undefined}
              disabled={!other}
              accessibilityRole="button"
              accessibilityLabel={`${otherName}. View profile`}
            >
              <Avatar name={otherName} url={other?.avatar_url} size={32} />
              <Text style={styles.headerName} numberOfLines={1}>
                {otherName}
              </Text>
            </Pressable>
          ),
          headerRight: () => <HeaderButton icon="ellipsis-horizontal" label="More options" onPress={() => setMenuOpen(true)} />,
        }}
      />

      {/* What this conversation is about, one tap from the task itself. */}
      <Pressable
        style={({ pressed }) => [styles.taskBar, pressed && styles.pressed]}
        onPress={() => router.push(`/task/${thread.task_id}`)}
        accessibilityRole="button"
        accessibilityLabel={`About the task ${thread.task.title}. Open task`}
      >
        <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
        <Text style={styles.taskBarTitle} numberOfLines={1}>
          {thread.task.title}
        </Text>
        <StatusPill status={thread.task.status} />
        <Ionicons name="chevron-forward" size={14} color={colors.placeholder} />
      </Pressable>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState icon="chatbubble-outline" title="Start the conversation" subtitle="Agree on the time, the place and any details here." />
        }
        renderItem={({ item }) => {
          if (item.kind === "divider") {
            return (
              <View style={styles.dividerRow}>
                <Text style={styles.dividerText}>{item.label}</Text>
              </View>
            );
          }
          const isMe = item.message.sender_id === profile.id;
          const time = timeLabel(new Date(item.message.created_at));
          return (
            <View
              style={[styles.bubbleRow, isMe ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              accessible
              accessibilityLabel={`${isMe ? "You" : otherName}: ${item.message.body}. ${time}`}
            >
              <View style={[styles.bubble, isMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={isMe ? styles.bubbleTextMine : styles.bubbleTextTheirs} selectable>
                  {item.message.body}
                </Text>
              </View>
              <Text style={styles.timeText}>{time}</Text>
            </View>
          );
        }}
      />

      {blocked ? (
        <View style={[styles.blockedBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={styles.blockedText}>You've blocked {otherName}. Neither of you can send messages.</Text>
          <Button title="Unblock" variant="secondary" size="sm" onPress={onToggleBlock} loading={unblockUser.isPending} />
        </View>
      ) : (
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Message"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={`Message to ${otherName}`}
            maxLength={LIMITS.chatMessageMax}
            multiline
          />
          <Pressable
            onPress={onSend}
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      )}

      <ActionMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, maxWidth: 220 },
  headerName: { ...typography.bodyStrong, fontSize: 16, color: colors.text, flexShrink: 1 },
  taskBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  taskBarTitle: { flex: 1, fontSize: 13, color: colors.text },
  pressed: { opacity: 0.6 },
  listContent: { padding: spacing.md, flexGrow: 1 },
  dividerRow: { alignItems: "center", marginVertical: spacing.sm },
  dividerText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: "82%" },
  bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: spacing.md - 4, paddingVertical: spacing.sm + 1, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleTextMine: { ...typography.body, lineHeight: 21, color: colors.white },
  bubbleTextTheirs: { ...typography.body, lineHeight: 21, color: colors.text },
  timeText: { fontSize: 11, color: colors.textFaint, marginTop: 2, marginHorizontal: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    minHeight: MIN_TOUCH,
    maxHeight: 120,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: MIN_TOUCH / 2,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: colors.borderStrong },
  blockedBar: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 2,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  blockedText: { fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: "center" },
});
