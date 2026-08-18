import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useMyThreads } from "../../lib/queries/chat";
import { EmptyState } from "../../components/EmptyState";
import { colors, radius, shadow, spacing, statusColors, typography } from "../../lib/theme";

export default function MessagesScreen() {
  const { profile } = useAuth();
  const { data: threads, isLoading } = useMyThreads(profile?.id);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="No conversations yet"
          subtitle="They start once a bid is accepted."
        />
      }
      renderItem={({ item }) => {
        const status = item.task.status === "completed" ? statusColors.completed : statusColors.assigned;
        return (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <View style={styles.rowText}>
              <Text style={styles.taskTitle} numberOfLines={1}>
                {item.task.title}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.fg }]}>
                  {item.task.status === "completed" ? "Completed" : "In progress"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, flexGrow: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowPressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: spacing.xs, marginRight: spacing.sm },
  taskTitle: { ...typography.bodyStrong, color: colors.text },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 11, fontWeight: "700" },
});
