import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, statusColors, typography } from "../lib/theme";
import type { Task } from "../lib/types";

interface TaskCardProps {
  task: Task & { distance_meters?: number };
  onPress?: () => void;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  open: "Open",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function TaskCard({ task, onPress }: TaskCardProps) {
  const status = statusColors[task.status];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {task.image_url && <Image source={{ uri: task.image_url }} style={styles.image} />}
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={styles.budget}>${task.budget.toFixed(0)}</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {task.description}
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{task.category}</Text>
        </View>
        {typeof task.distance_meters === "number" && (
          <Text style={styles.distance}>{(task.distance_meters / 1000).toFixed(1)} km away</Text>
        )}
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{STATUS_LABEL[task.status]}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  image: { width: "100%", height: 140, borderRadius: radius.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceAlt },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { ...typography.h3, color: colors.text, flex: 1, marginRight: spacing.sm },
  budget: { ...typography.h3, color: colors.primary },
  description: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  categoryPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  categoryText: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: 12, fontWeight: "700" },
  distance: { fontSize: 12, color: colors.textFaint, fontWeight: "500" },
});
