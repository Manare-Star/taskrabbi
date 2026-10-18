import { ActivityIndicator, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";
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
        <ActivityIndicator color={variant === "secondary" ? colors.text : colors.white} />
      ) : (
        <Text style={[styles.text, variant === "secondary" && styles.textSecondary]}>{title}</Text>
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
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45 },
  text: { ...typography.bodyStrong, fontSize: 16, color: colors.white },
  textSecondary: { color: colors.text },
});
