import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../lib/theme";

interface FormInputProps extends TextInputProps {
  label: string;
  // Shown under the field in place of the hint, and read out by screen readers.
  error?: string | null;
  // Supporting text under the field ("Shown publicly").
  hint?: string;
  // Adds a show/hide toggle. Use for passwords instead of secureTextEntry.
  password?: boolean;
  // With maxLength, shows a "123/200" counter once the field is nearly full.
  showCount?: boolean;
  // Text fixed inside the field before the value, e.g. "R" for money.
  prefix?: string;
}

export function FormInput({
  label,
  error,
  hint,
  password,
  showCount,
  prefix,
  style,
  onFocus,
  onBlur,
  maxLength,
  value,
  ...rest
}: FormInputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const length = value?.length ?? 0;
  const nearLimit = !!showCount && !!maxLength && length >= maxLength * 0.8;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldError : undefined]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.placeholder}
          value={value}
          maxLength={maxLength}
          secureTextEntry={password ? !revealed : rest.secureTextEntry}
          autoCapitalize={password ? "none" : rest.autoCapitalize}
          autoCorrect={password ? false : rest.autoCorrect}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            hitSlop={10}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {(error || hint || nearLimit) && (
        <View style={styles.below}>
          <Text style={[styles.hint, error ? styles.error : undefined]} accessibilityLiveRegion={error ? "polite" : "none"}>
            {error || hint || ""}
          </Text>
          {nearLimit && (
            <Text style={[styles.hint, length >= (maxLength ?? 0) && styles.error]}>
              {length}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  prefix: { fontSize: 16, color: colors.textMuted, paddingLeft: spacing.md, marginRight: -spacing.sm },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    minHeight: 48,
  },
  reveal: { paddingHorizontal: spacing.md - 4, alignSelf: "stretch", justifyContent: "center" },
  below: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, flexShrink: 1, lineHeight: 17 },
  error: { color: colors.danger },
});
