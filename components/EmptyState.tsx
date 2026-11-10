import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../lib/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  // The one thing to do next, e.g. { label: "Try again", onPress: refetch }.
  action?: { label: string; onPress: () => void };
}

// A screen or list with nothing to show: what this space is for, and the next step if any.
export function EmptyState({ icon = "file-tray-outline", title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={24} color={colors.textMuted} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <Button title={action.label} variant="secondary" size="sm" onPress={action.onPress} />
        </View>
      ) : null}
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
  action: { marginTop: spacing.md },
});
