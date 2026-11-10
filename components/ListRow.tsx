import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../lib/theme";

interface ListSectionProps {
  title?: string;
  children: ReactNode;
}

// A titled group of rows, as on a settings screen.
export function ListSection({ title, children }: ListSectionProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  // Secondary text on the right (a current value) — or under the label when `stacked`.
  value?: string;
  stacked?: boolean;
  onPress?: () => void;
  // Red label and icon, for sign-out / delete.
  destructive?: boolean;
  // The last row in a group has no divider under it.
  last?: boolean;
}

export function ListRow({ icon, label, value, stacked, onPress, destructive, last }: ListRowProps) {
  const tint = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
    >
      {icon ? <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textMuted} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        {stacked && value ? <Text style={styles.stackedValue}>{value}</Text> : null}
      </View>
      {!stacked && value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !destructive ? <Ionicons name="chevron-forward" size={16} color={colors.placeholder} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    minHeight: MIN_TOUCH + 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.white,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body },
  value: { ...typography.caption, fontSize: 14, color: colors.textMuted, maxWidth: "45%" },
  stackedValue: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
