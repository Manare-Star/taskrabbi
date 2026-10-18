import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, typography } from "../lib/theme";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormInput({ label, error, style, onFocus, onBlur, ...rest }: FormInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : undefined, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, fontWeight: "500" },
});
