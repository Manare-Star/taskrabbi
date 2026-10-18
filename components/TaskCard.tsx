import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, statusColors, typography } from "../lib/theme";
import { categoryIcon } from "../lib/categories";
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
  completed: "Completed",
  cancelled: "Cancelled",
};

// One task as a list row: photo or category icon, title and price, then a single line of
// details. Rows are separated by hairlines rather than drawn as cards.
export function TaskCard({ task, onPress }: TaskCardProps) {
  const status = statusColors[task.status];
  const overdue = isOverdue(task.scheduled_for);

  const details = [
    task.category,
    typeof task.distance_meters === "number" ? `${(task.distance_meters / 1000).toFixed(1)} km` : null,
    describeSchedule(task.scheduled_for),
  ].filter(Boolean);

  return (
    <Bouncy onPress={onPress} pressedScale={0.99} style={styles.row}>
      {task.image_url ? (
        <Image source={{ uri: task.image_url }} style={styles.thumb} />
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name={categoryIcon(task.category)} size={20} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={styles.price}>{formatMoney(task.budget)}</Text>
        </View>
        <Text style={[styles.details, overdue && styles.detailsPast]} numberOfLines={1}>
          {details.join(" · ")}
        </Text>
        {task.status !== "open" && (
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.fg }]}>{STATUS_LABEL[task.status]}</Text>
          </View>
        )}
      </View>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  price: { ...typography.bodyStrong, color: colors.text },
  details: { fontSize: 13, color: colors.textMuted },
  detailsPast: { color: colors.textFaint },
  statusPill: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 11, fontWeight: "600" },
});
