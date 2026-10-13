import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, statusColors, typography } from "../lib/theme";
import { categoryStyle } from "../lib/categories";
import { formatMoney } from "../lib/format";
import { describeSchedule, isOverdue } from "../lib/schedule";
import type { Task } from "../lib/types";
import { Bouncy } from "./Bouncy";

interface TaskCardProps {
  task: Task & { distance_meters?: number };
  onPress?: () => void;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  open: "Open",
  assigned: "Assigned",
  completed: "Done ✓",
  cancelled: "Cancelled",
};

export function TaskCard({ task, onPress }: TaskCardProps) {
  const status = statusColors[task.status];
  const category = categoryStyle(task.category);

  return (
    <Bouncy onPress={onPress} pressedScale={0.97} style={[styles.card, { borderLeftColor: category.color }]}>
      {task.image_url && <Image source={{ uri: task.image_url }} style={styles.image} />}
      <View style={styles.headerRow}>
        <View style={[styles.emojiBadge, { backgroundColor: category.tint }]}>
          <Text style={styles.emoji}>{category.emoji}</Text>
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={[styles.categoryText, { color: category.color }]}>{task.category}</Text>
        </View>
        <View style={styles.budgetBubble}>
          <Text style={styles.budget}>{formatMoney(task.budget)}</Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {task.description}
      </Text>
      <View style={styles.metaRow}>
        {task.scheduled_for && (
          <Text style={[styles.when, isOverdue(task.scheduled_for) && styles.whenPast]}>
            🗓 {describeSchedule(task.scheduled_for)}
          </Text>
        )}
        {typeof task.distance_meters === "number" && (
          <Text style={styles.distance}>📍 {(task.distance_meters / 1000).toFixed(1)} km away</Text>
        )}
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{STATUS_LABEL[task.status]}</Text>
        </View>
      </View>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderLeftWidth: 5,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  image: { width: "100%", height: 140, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceAlt },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emojiBadge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  titleCol: { flex: 1 },
  title: { ...typography.h3, color: colors.text },
  categoryText: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  budgetBubble: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  budget: { ...typography.h3, fontSize: 16, color: colors.primaryDark },
  description: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.lg },
  statusText: { fontSize: 12, fontWeight: "700" },
  distance: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  when: { fontSize: 12, color: colors.primaryDark, fontWeight: "700" },
  whenPast: { color: colors.textFaint, textDecorationLine: "line-through" },
});
