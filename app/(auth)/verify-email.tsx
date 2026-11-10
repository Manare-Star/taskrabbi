import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { validateCode } from "../../lib/validation";
import { useCooldown } from "../../lib/use-cooldown";
import { useToast } from "../../lib/toast";
import { haptics } from "../../lib/haptics";

// After signing up (when the project requires confirmed emails): enter the code we emailed.
// A correct code signs the user in, and the auth layout takes them into the app.
export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { confirmEmail, resendConfirmation } = useAuth();
  const toast = useToast();
  const cooldown = useCooldown(60);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // An email went out moments ago, when they signed up or tried to log in.
  useEffect(() => {
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!email) return <Redirect href="/(auth)/login" />;

  const codeError = validateCode(code);

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    if (codeError) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await confirmEmail({ email, code: code.trim() });
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    setFailure(null);
    try {
      await resendConfirmation(email);
      cooldown.start();
      toast.success("We sent a new code");
    } catch (err) {
      setFailure(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <FormScreen contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Check your email
      </Text>
      <Text style={styles.subtitle}>
        We sent a code to <Text style={styles.email}>{email}</Text>. Enter it to confirm your address.
      </Text>

      {failure ? (
        <View style={styles.failure}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      <FormInput
        label="Confirmation code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
        error={showErrors ? codeError : null}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        style={styles.codeInput}
      />

      <Button title="Confirm email" onPress={onSubmit} loading={submitting} />

      <View style={styles.resend}>
        <Text style={styles.resendHint}>Nothing arrived? Check your spam folder, or</Text>
        <Button
          title={cooldown.active ? `Send a new code in ${cooldown.remaining}s` : "Send a new code"}
          variant="ghost"
          size="sm"
          onPress={onResend}
          loading={resending}
          disabled={cooldown.active}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, lineHeight: 22, color: colors.textMuted, marginBottom: spacing.lg },
  email: { color: colors.text, fontWeight: "600" },
  failure: { marginBottom: spacing.md },
  codeInput: { fontSize: 22, letterSpacing: 6, fontWeight: "600" },
  resend: { alignItems: "center", marginTop: spacing.lg, gap: spacing.xs },
  resendHint: { fontSize: 13, color: colors.textMuted },
});
