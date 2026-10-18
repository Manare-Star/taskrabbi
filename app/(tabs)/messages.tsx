import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyThreads, useUnreadCounts, type InboxThread } from "../../lib/queries/chat";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { colors, radius, spacing, statusColors, typography } from "../../lib/theme";

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
  const { data: threads, isLoading, isRefetching, refetch } = useMyThreads(profile?.id);
  const { data: unreadByThread } = useUnreadCounts(profile?.id);

  if (isLoading) {
    return (
      <View style={styles.listContent}>
        <SkeletonList />
      </View>
    );
  }

  return (
    <FlatList<InboxThread>
      data={threads}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubble-outline"
          title="No conversations yet"
          subtitle="A chat opens with the other person as soon as a bid is accepted."
        />
      }
      renderItem={({ item }) => {
        const other = item.client_id === profile?.id ? item.tasker : item.client;
        const completed = item.task.status === "completed";
        const status = completed ? statusColors.completed : statusColors.assigned;
        const last = item.lastMessage;
        const preview = last
          ? `${last.sender_id === profile?.id ? "You: " : ""}${last.body}`
          : "No messages yet — say hi";
        const unread = unreadByThread?.[item.id] ?? 0;

        return (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <Avatar name={other.full_name} url={other.avatar_url} size={44} />
            <View style={styles.rowText}>
              <View style={styles.topLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {other.full_name}
                </Text>
                <Text style={[styles.time, unread > 0 && styles.timeUnread]}>
                  {shortTimestamp(last?.created_at ?? item.created_at)}
                </Text>
              </View>
              <View style={styles.taskLine}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {item.task.title}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusText, { color: status.fg }]}>{completed ? "Completed" : "Active"}</Text>
                </View>
              </View>
              <View style={styles.previewLine}>
                <Text
                  style={[styles.preview, !last && styles.previewEmpty, unread > 0 && styles.previewUnread]}
                  numberOfLines={1}
                >
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
  listContent: { paddingHorizontal: spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  rowPressed: { opacity: 0.6 },
  timeUnread: { color: colors.primary, fontWeight: "600" },
  previewLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  previewUnread: { fontWeight: "600" },
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
  rowText: { flex: 1, gap: 3 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  time: { fontSize: 12, color: colors.textFaint },
  taskLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  taskTitle: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: "600" },
  preview: { fontSize: 14, color: colors.text, flex: 1 },
  previewEmpty: { color: colors.textFaint, fontStyle: "italic" },
});
