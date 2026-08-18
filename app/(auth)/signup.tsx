import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import type { UserRole } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "client", label: "I need help", description: "Post tasks and hire taskers" },
  { value: "tasker", label: "I want to work", description: "Browse and bid on tasks" },
  { value: "both", label: "Both", description: "Post tasks and take on jobs" },
];

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Missing info", "Fill in your name, email, and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
      Alert.alert(
        "Check your email",
        "If email confirmation is enabled on your Supabase project, confirm your address before logging in."
      );
    } catch (err) {
      Alert.alert("Couldn't sign up", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>

        <FormInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
        <FormInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FormInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
          placeholder="At least 6 characters"
        />

        <Text style={styles.label}>I'm here to...</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setRole(option.value)}
              style={[styles.roleCard, role === option.value && styles.roleCardSelected]}
            >
              <View style={styles.roleCardText}>
                <Text style={[styles.roleLabel, role === option.value && styles.roleLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </View>
              <View style={[styles.radio, role === option.value && styles.radioSelected]}>
                {role === option.value && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
            </Pressable>
          ))}
        </View>

        <Button title="Sign up" onPress={onSubmit} loading={submitting} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" style={styles.link}>
            Log in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  roleRow: { gap: spacing.sm, marginBottom: spacing.lg },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight, ...shadow.card },
  roleCardText: { flex: 1, marginRight: spacing.sm },
  roleLabel: { ...typography.bodyStrong, fontSize: 16, color: colors.text },
  roleLabelSelected: { color: colors.primaryDark },
  roleDescription: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontWeight: "400" },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: spacing.xs },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "600" },
});
