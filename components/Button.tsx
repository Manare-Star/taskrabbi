import { ActivityIndicator, StyleSheet, Text, View, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../lib/theme";
import { Bouncy } from "./Bouncy";

type Variant = "primary" | "secondary" | "danger" | "dangerOutline" | "ghost";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  loading?: boolean;
  variant?: Variant;
  // "sm" is for buttons that sit inside a row or card rather than closing out a screen.
  size?: "md" | "sm";
  icon?: keyof typeof Ionicons.glyphMap;
}

// Text and spinner colour per variant; the fills are in the stylesheet.
const FOREGROUND: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.text,
  danger: colors.white,
  dangerOutline: colors.danger,
  ghost: colors.primary,
};

export function Button({ title, loading, variant = "primary", size = "md", icon, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const foreground = FOREGROUND[variant];

  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      {...rest}
      disabled={isDisabled}
      style={[styles.base, size === "sm" && styles.small, styles[variant], isDisabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={foreground} />}
          <Text style={[styles.text, size === "sm" && styles.textSmall, { color: foreground }]}>{title}</Text>
        </View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  small: { minHeight: MIN_TOUCH, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.danger },
  dangerOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  text: { ...typography.bodyStrong, fontSize: 16 },
  textSmall: { fontSize: 14 },
});
