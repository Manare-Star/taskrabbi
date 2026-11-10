import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyPostedTasks } from "../../lib/queries/tasks";
import { useMyBids } from "../../lib/queries/bids";
import { TaskCard } from "../../components/TaskCard";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { StatusPill } from "../../components/StatusPill";
import { MIN_TOUCH, colors, spacing, typography } from "../../lib/theme";
import { formatMoney } from "../../lib/format";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import type { Bid } from "../../lib/types";

type Tab = "posted" | "bids";

// What a tasker's bid means for them right now, in words.
function bidSummary(bid: Bid, taskStatus: string): { status: string; label: string } {
  if (bid.status === "accepted") {
    if (taskStatus === "completed") return { status: "completed", label: "Completed" };
    if (taskStatus === "cancelled") return { status: "cancelled", label: "Cancelled" };
    return { status: "accepted", label: "You're hired" };
  }
  if (bid.status === "pending" && taskStatus !== "open") return { status: "rejected", label: "Closed" };
  if (bid.status === "pending") return { status: "pending", label: "Waiting for a reply" };
  return { status: bid.status, label: bid.status === "rejected" ? "Not selected" : "Withdrawn" };
}

export default function MyTasksScreen() {
  const { profile } = useAuth();
  // People who signed up to work land on their bids; everyone else on what they've posted.
  const [tab, setTab] = useState<Tab>(profile?.role === "tasker" ? "bids" : "posted");

  const postedQuery = useMyPostedTasks(profile?.id);
  const bidsQuery = useMyBids(profile?.id);
  const active = tab === "posted" ? postedQuery : bidsQuery;

  const selectTab = (next: Tab) => {
    haptics.select();
    setTab(next);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.tabRow} accessibilityRole="tablist">
        <TabButton label="Posted by me" count={postedQuery.data?.length} active={tab === "posted"} onPress={() => selectTab("posted")} />
        <TabButton label="My bids" count={bidsQuery.data?.length} active={tab === "bids"} onPress={() => selectTab("bids")} />
      </View>

      {active.isLoading ? (
        <View style={styles.listContent}>
          <SkeletonList />
        </View>
      ) : active.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your tasks"
          subtitle={getErrorMessage(active.error)}
          action={{ label: "Try again", onPress: () => active.refetch() }}
        />
      ) : tab === "posted" ? (
        <FlatList
          data={postedQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={postedQuery.isRefetching} onRefresh={() => void postedQuery.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="add-circle-outline"
              title="Post your first task"
              subtitle="Describe what you need done and taskers nearby will send offers."
              action={{ label: "Post a task", onPress: () => router.push("/(tabs)/post") }}
            />
          }
          renderItem={({ item }) => <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />}
        />
      ) : (
        <FlatList
          data={bidsQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={bidsQuery.isRefetching} onRefresh={() => void bidsQuery.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="pricetag-outline"
              title="Make your first offer"
              subtitle="Tasks you bid on appear here, with where each bid stands."
              action={{ label: "Browse tasks", onPress: () => router.push("/(tabs)/browse") }}
            />
          }
          renderItem={({ item }) => {
            const summary = bidSummary(item, item.task.status);
            return (
              <TaskCard
                // The bid's own state replaces the task's status pill: it's what matters here.
                task={{ ...item.task, status: "open" }}
                onPress={() => router.push(`/task/${item.task_id}`)}
                footer={
                  <>
                    <StatusPill status={summary.status} label={summary.label} />
                    <Text style={styles.bidAmount}>Your bid: {formatMoney(item.amount)}</Text>
                  </>
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

function TabButton({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
        {count ? <Text style={styles.tabCount}>  {count}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  // Underlined segment tabs, the quieter alternative to a filled toggle.
  tabRow: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  tabButton: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabButtonActive: { borderBottomColor: colors.ink },
  tabLabel: { ...typography.label, fontSize: 14, fontWeight: "500", color: colors.textMuted },
  tabLabelActive: { color: colors.text, fontWeight: "600" },
  tabCount: { color: colors.textMuted, fontWeight: "400" },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  bidAmount: { fontSize: 13, color: colors.textMuted },
});
