import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../lib/theme";
import { categoryIcon } from "../lib/categories";
import { formatDistance, formatMoney } from "../lib/format";
import { describeSchedule } from "../lib/schedule";
import type { Task } from "../lib/types";
import { Bouncy } from "./Bouncy";
import { StatusPill, statusLabel } from "./StatusPill";

type CardTask = Pick<Task, "title" | "category" | "budget" | "status" | "area_text" | "image_url" | "scheduled_for"> & {
  distance_meters?: number;
};

interface TaskCardProps {
  task: CardTask;
  onPress?: () => void;
  // Extra line under the details, e.g. the viewer's own bid on this task.
  footer?: ReactNode;
}

// One task as a list row: photo or category icon, title and price, then where and when.
// Rows are separated by hairlines rather than drawn as cards.
export function TaskCard({ task, onPress, footer }: TaskCardProps) {
  const where = [
    task.area_text,
    typeof task.distance_meters === "number" ? formatDistance(task.distance_meters) : null,
  ].filter(Boolean);
  const what = [task.category, describeSchedule(task.scheduled_for)];

  return (
    <Bouncy
      onPress={onPress}
      pressedScale={0.99}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${formatMoney(task.budget)}, ${where.join(", ")}, ${what.join(", ")}${
        task.status !== "open" ? `, ${statusLabel(task.status)}` : ""
      }`}
    >
      {task.image_url ? (
        <Image source={{ uri: task.image_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
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
        <Text style={styles.details} numberOfLines={1}>
          {where.join(" · ")}
        </Text>
        <Text style={styles.details} numberOfLines={1}>
          {what.join(" · ")}
        </Text>
        {(task.status !== "open" || footer) && (
          <View style={styles.footer}>
            {task.status !== "open" && <StatusPill status={task.status} />}
            {footer}
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
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  price: { ...typography.bodyStrong, color: colors.text },
  details: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
});
