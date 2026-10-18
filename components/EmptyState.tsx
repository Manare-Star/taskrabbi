import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../lib/theme";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = "file-tray-outline", title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={24} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xs },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, textAlign: "center" },
  subtitle: { ...typography.caption, fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});
