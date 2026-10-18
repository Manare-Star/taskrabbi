import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyPostedTasks } from "../../lib/queries/tasks";
import { useMyBids } from "../../lib/queries/bids";
import { TaskCard } from "../../components/TaskCard";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { colors, spacing, typography } from "../../lib/theme";

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
            <EmptyState icon="add-circle-outline" title="Post your first task" subtitle="Describe what you need done and taskers nearby will send offers." />
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
            <EmptyState icon="pricetag-outline" title="Make your first offer" subtitle="Tasks you bid on appear here. Find one on Browse." />
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
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
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
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabButtonActive: { borderBottomColor: colors.ink },
  tabLabel: { ...typography.label, fontWeight: "500", color: colors.textMuted },
  tabLabelActive: { color: colors.text },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
});
