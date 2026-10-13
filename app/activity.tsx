import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { useMarkNotificationsRead, useNotifications } from "../lib/queries/notifications";
import { Bouncy } from "../components/Bouncy";
import { EmptyState } from "../components/EmptyState";
import { SkeletonList } from "../components/SkeletonCard";
import { colors, radius, shadow, spacing, typography } from "../lib/theme";
import { timeAgo } from "../lib/format";
import type { AppNotification, NotificationKind } from "../lib/types";

const KIND_STYLE: Record<NotificationKind, { emoji: string; tint: string }> = {
  new_bid: { emoji: "💼", tint: "#E9F1FC" },
  bid_accepted: { emoji: "🎉", tint: "#EAF6EC" },
  bid_rejected: { emoji: "🙏", tint: "#EFF2EF" },
  task_paid: { emoji: "💸", tint: "#FBF5E4" },
  new_review: { emoji: "⭐", tint: "#FDF1E7" },
};

export default function ActivityScreen() {
  const { profile } = useAuth();
  const { data: notifications, isLoading, isRefetching, refetch, error } = useNotifications(profile?.id);
  const markRead = useMarkNotificationsRead();

  // Being on this screen means you've seen everything here, including anything that arrives
  // while it's open: mark it all read, but keep what was new highlighted for this visit.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const unread = notifications?.filter((n) => !n.read_at) ?? [];
    if (unread.length === 0) return;
    setFreshIds((previous) => new Set([...previous, ...unread.map((n) => n.id)]));
    if (!markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  if (isLoading) {
    return (
      <View style={styles.listContent}>
        <SkeletonList count={5} />
      </View>
    );
  }

  if (error) {
    return <EmptyState emoji="😵‍💫" title="Couldn't load activity" subtitle={(error as Error).message} />;
  }

  const open = (item: AppNotification) => {
    if (item.task_id) router.push(`/task/${item.task_id}`);
  };

  return (
    <FlatList<AppNotification>
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListEmptyComponent={
        <EmptyState
          emoji="🔔"
          title="Nothing yet"
          subtitle="Bids, hires, payments and reviews will show up here as they happen."
        />
      }
      renderItem={({ item }) => {
        const style = KIND_STYLE[item.kind] ?? KIND_STYLE.new_bid;
        const isFresh = freshIds.has(item.id) || !item.read_at;
        return (
          <Bouncy
            onPress={() => open(item)}
            pressedScale={0.98}
            style={[styles.row, isFresh && styles.rowFresh]}
          >
            <View style={[styles.emojiBadge, { backgroundColor: style.tint }]}>
              <Text style={styles.emoji}>{style.emoji}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.title, isFresh && styles.titleFresh]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              {isFresh && <View style={styles.dot} />}
            </View>
          </Bouncy>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowFresh: { backgroundColor: colors.primaryLight },
  emojiBadge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.text },
  titleFresh: { fontWeight: "700" },
  body: { fontSize: 13, color: colors.textMuted },
  meta: { alignItems: "flex-end", gap: 6 },
  time: { fontSize: 12, color: colors.textFaint },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
});
