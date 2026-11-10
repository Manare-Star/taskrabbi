import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyThreads, useUnreadCounts, type InboxThread } from "../../lib/queries/chat";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";

// "3:42 PM" today, "Mon" within the week, "12 Sep" otherwise — the usual inbox convention.
function shortTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const daysAgo = (now.getTime() - date.getTime()) / 86_400_000;
  if (daysAgo < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function MessagesScreen() {
  const { profile } = useAuth();
  const { data: threads, isLoading, isRefetching, refetch, error } = useMyThreads(profile?.id);
  const { data: unreadByThread } = useUnreadCounts(profile?.id);

  if (isLoading) {
    return (
      <View style={styles.listContent}>
        <SkeletonList />
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load your messages"
        subtitle={getErrorMessage(error)}
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  }

  return (
    <FlatList<InboxThread>
      data={threads}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubble-outline"
          title="No conversations yet"
          subtitle="A chat opens with the other person as soon as a bid is accepted."
        />
      }
      renderItem={({ item }) => {
        const other = item.client_id === profile?.id ? item.tasker : item.client;
        const name = other?.full_name || "Someone";
        const last = item.lastMessage;
        const preview = last ? `${last.sender_id === profile?.id ? "You: " : ""}${last.body}` : "No messages yet";
        const unread = unreadByThread?.[item.id] ?? 0;
        const when = shortTimestamp(last?.created_at ?? item.created_at);

        return (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/chat/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${name}, about ${item.task.title}. ${unread > 0 ? `${unread} unread. ` : ""}${preview}. ${when}`}
          >
            <Avatar name={name} url={other?.avatar_url} size={48} />
            <View style={styles.rowText}>
              <View style={styles.line}>
                <Text style={[styles.name, unread > 0 && styles.unreadStrong]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{when}</Text>
              </View>
              <Text style={styles.taskTitle} numberOfLines={1}>
                {item.task.title}
              </Text>
              <View style={styles.line}>
                <Text style={[styles.preview, !last && styles.previewEmpty, unread > 0 && styles.unreadStrong]} numberOfLines={1}>
                  {preview}
                </Text>
                {unread > 0 && (
                  <View style={styles.unreadBubble}>
                    <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.md, flexGrow: 1, backgroundColor: colors.background },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.bodyStrong, fontWeight: "500", color: colors.text, flex: 1 },
  time: { fontSize: 12, color: colors.textFaint },
  timeUnread: { color: colors.primary, fontWeight: "600" },
  taskTitle: { fontSize: 13, color: colors.textMuted },
  preview: { fontSize: 14, color: colors.textMuted, flex: 1 },
  previewEmpty: { fontStyle: "italic" },
  unreadStrong: { color: colors.text, fontWeight: "600" },
  unreadBubble: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: "700" },
});
