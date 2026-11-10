import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage, isEmailNotConfirmed } from "../../lib/errors";
import { validateEmail, validateRequired } from "../../lib/validation";
import { haptics } from "../../lib/haptics";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = {
    email: validateEmail(email),
    password: validateRequired(password, "Enter your password."),
  };

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    if (errors.email || errors.password) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      // The auth layout redirects into the app once the session and profile are loaded.
    } catch (err) {
      if (isEmailNotConfirmed(err)) {
        router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
        return;
      }
      haptics.error();
      setFailure(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Welcome back
      </Text>
      <Text style={styles.subtitle}>Log in to post a task or find work nearby.</Text>

      {failure ? (
        <View style={styles.failure}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

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
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      <Link href="/(auth)/forgot-password" style={styles.forgot}>
        Forgot your password?
      </Link>

      <Button title="Log in" onPress={onSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Siza?</Text>
        <Link href="/(auth)/signup" replace style={styles.link}>
          Create an account
        </Link>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  failure: { marginBottom: spacing.md },
  forgot: { color: colors.primary, fontWeight: "500", fontSize: 14, alignSelf: "flex-end", marginBottom: spacing.lg, paddingVertical: spacing.xs },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: spacing.xs },
  footerText: { color: colors.textMuted, fontSize: 15 },
  link: { color: colors.primary, fontWeight: "500", fontSize: 15 },
});
