import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { UserRole } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";
import { LIMITS } from "../../lib/config";
import { ROLE_OPTIONS } from "../../lib/roles";
import { isValid, validateEmail, validateName, validatePassword } from "../../lib/validation";
import { haptics } from "../../lib/haptics";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = {
    fullName: validateName(fullName),
    email: validateEmail(email),
    password: validatePassword(password),
  };

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    if (!isValid(errors)) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
      if (needsEmailConfirmation) {
        router.replace({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
      }
      // Otherwise the account is signed in and the auth layout redirects into the app.
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Create your account
      </Text>

      {failure ? (
        <View style={styles.failure}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      <FormInput
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={showErrors ? errors.fullName : null}
        hint="Shown on your profile, bids and reviews."
        maxLength={LIMITS.nameMax}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <FormInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={showErrors ? errors.email : null}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        placeholder="name@example.com"
      />
      <FormInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={showErrors ? errors.password : null}
        hint={`At least ${LIMITS.passwordMin} characters, with a letter and a number.`}
        password
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Text style={styles.label}>How will you use Siza?</Text>
      <View style={styles.roleRow} accessibilityRole="radiogroup">
        {ROLE_OPTIONS.map((option) => {
          const selected = role === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.select();
                setRole(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}. ${option.description}`}
              style={[styles.roleCard, selected && styles.roleCardSelected]}
            >
              <View style={styles.roleCardText}>
                <Text style={styles.roleLabel}>{option.label}</Text>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.roleNote}>You can change this later in your profile.</Text>

      <Button title="Create account" onPress={onSubmit} loading={submitting} />

      <Text style={styles.legal}>
        By creating an account you confirm you're 18 or older and agree to the{" "}
        <Link href="/legal/terms" style={styles.link}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" style={styles.link}>
          Privacy Policy
        </Link>
        .
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/(auth)/login" replace style={[styles.link, styles.footerLink]}>
          Log in
        </Link>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  failure: { marginBottom: spacing.md },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: spacing.sm },
  roleRow: { gap: spacing.sm },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleCardText: { flex: 1, marginRight: spacing.sm },
  roleLabel: { ...typography.bodyStrong, color: colors.text },
  roleDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleNote: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  legal: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  link: { color: colors.primary, fontWeight: "500" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: spacing.xs },
  footerText: { color: colors.textMuted, fontSize: 15 },
  footerLink: { fontSize: 15 },
});
