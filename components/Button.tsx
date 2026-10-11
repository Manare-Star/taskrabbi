import { ActivityIndicator, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../lib/theme";
import { Bouncy } from "./Bouncy";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ title, loading, variant = "primary", disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Bouncy
      {...rest}
      disabled={isDisabled}
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.text, variant === "secondary" && styles.textSecondary]}>{title}</Text>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primary: { backgroundColor: colors.primary, ...shadow.button },
  secondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  text: { ...typography.bodyStrong, fontSize: 16, color: colors.white, letterSpacing: 0.2 },
  textSecondary: { color: colors.text },
});
