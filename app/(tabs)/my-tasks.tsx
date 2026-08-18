import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyPostedTasks } from "../../lib/queries/tasks";
import { useMyBids } from "../../lib/queries/bids";
import { TaskCard } from "../../components/TaskCard";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";

type Tab = "posted" | "bids";

export default function MyTasksScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("posted");

  const postedQuery = useMyPostedTasks(profile?.id);
  const bidsQuery = useMyBids(profile?.id);

  const isLoading = tab === "posted" ? postedQuery.isLoading : bidsQuery.isLoading;

  return (
    <View style={styles.flex}>
      <View style={styles.tabRow}>
        <TabButton label="Posted by me" active={tab === "posted"} onPress={() => setTab("posted")} />
        <TabButton label="My bids" active={tab === "bids"} onPress={() => setTab("bids")} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <SkeletonList />
        </View>
      ) : tab === "posted" ? (
        <FlatList
          data={postedQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={postedQuery.isRefetching} onRefresh={postedQuery.refetch} />
          }
          ListEmptyComponent={
            <EmptyState icon="clipboard-outline" title="No tasks posted yet" subtitle="Post one from the Post a Task tab." />
          }
          renderItem={({ item }) => <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />}
        />
      ) : (
        <FlatList
          data={bidsQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={bidsQuery.isRefetching} onRefresh={bidsQuery.refetch} />}
          ListEmptyComponent={
            <EmptyState icon="pricetag-outline" title="No bids placed yet" subtitle="Browse tasks nearby to place one." />
          }
          renderItem={({ item }) => (
            <TaskCard task={item.task} onPress={() => router.push(`/task/${item.task_id}`)} />
          )}
        />
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  tabRow: {
    flexDirection: "row",
    margin: spacing.md,
    padding: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: colors.white, ...shadow.card },
  tabLabel: { ...typography.caption, color: colors.textMuted },
  tabLabelActive: { color: colors.primaryDark },
  listContent: { padding: spacing.md, paddingTop: 0, flexGrow: 1 },
});
