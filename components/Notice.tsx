import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../lib/theme";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { bg: colors.surface, fg: colors.textMuted, icon: "information-circle-outline" },
  success: { bg: colors.successLight, fg: colors.primaryDark, icon: "checkmark-circle-outline" },
  warning: { bg: colors.warningLight, fg: colors.warning, icon: "alert-circle-outline" },
  danger: { bg: colors.dangerLight, fg: colors.danger, icon: "warning-outline" },
};

interface NoticeProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}

// An inline message that belongs to the content around it: a status, a caveat, a next step.
export function Notice({ tone = "info", title, children, icon }: NoticeProps) {
  const style = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: style.bg }]} accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : undefined}>
      <Ionicons name={icon ?? style.icon} size={18} color={style.fg} style={styles.icon} />
      <View style={styles.text}>
        {title ? <Text style={[styles.title, { color: tone === "info" ? colors.text : style.fg }]}>{title}</Text> : null}
        {typeof children === "string" ? <Text style={styles.body}>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: spacing.sm + 2, padding: spacing.md - 4, borderRadius: radius.md },
  icon: { marginTop: 1 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: "600" },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
});
