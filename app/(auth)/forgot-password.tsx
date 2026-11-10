import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { LIMITS } from "../../lib/config";
import { validateCode, validateEmail, validatePassword } from "../../lib/validation";
import { useCooldown } from "../../lib/use-cooldown";
import { useToast } from "../../lib/toast";
import { haptics } from "../../lib/haptics";

type Step = "email" | "code" | "password";

const COPY: Record<Step, { title: string; subtitle: string }> = {
  email: { title: "Reset your password", subtitle: "Enter the email you signed up with and we'll send you a code." },
  code: { title: "Enter the code", subtitle: "" },
  password: { title: "Choose a new password", subtitle: "You'll use this to log in from now on." },
};

// Password reset in three steps on one screen: email → emailed code → new password.
// Entering the right code signs the user in; the auth layout keeps them here (see
// recoveringPassword) until the new password is saved, then lets them into the app.
export default function ForgotPasswordScreen() {
  const { recoveringPassword, requestPasswordReset, verifyPasswordResetCode, finishPasswordReset, abandonPasswordReset } = useAuth();
  const toast = useToast();
  const cooldown = useCooldown(60);

  // If the app was reopened mid-reset, pick up at the last step.
  const [step, setStep] = useState<Step>(recoveringPassword ? "password" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The code signs the user in before they've chosen a password. If they back out of this
  // screen at that point, sign them out again rather than leave a half-finished reset.
  const signedInUnfinished = useRef(recoveringPassword);
  useEffect(
    () => () => {
      if (signedInUnfinished.current) void abandonPasswordReset();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const errors = {
    email: validateEmail(email),
    code: validateCode(code),
    password: validatePassword(password),
  };

  const run = async (error: string | null, action: () => Promise<void>) => {
    setShowErrors(true);
    setFailure(null);
    if (error) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await action();
      setShowErrors(false);
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = () =>
    run(errors.email, async () => {
      await requestPasswordReset(email.trim());
      cooldown.start();
      setStep("code");
    });

  const checkCode = () =>
    run(errors.code, async () => {
      await verifyPasswordResetCode({ email: email.trim(), code: code.trim() });
      signedInUnfinished.current = true;
      setStep("password");
    });

  const savePassword = () =>
    run(errors.password, async () => {
      await finishPasswordReset(password);
      signedInUnfinished.current = false;
      toast.success("Password changed");
      // Signed in with the new password saved: the auth layout redirects into the app.
    });

  const copy = COPY[step];

  return (
    <FormScreen contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.subtitle}>
        {step === "code" ? (
          <>
            If there's an account for <Text style={styles.email}>{email.trim()}</Text>, we've emailed it a code.
          </>
        ) : (
          copy.subtitle
        )}
      </Text>

      {failure ? (
        <View style={styles.failure}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      {step === "email" && (
        <>
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
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendCode}
            placeholder="name@example.com"
          />
          <Button title="Send code" onPress={sendCode} loading={submitting} />
        </>
      )}

      {step === "code" && (
        <>
          <FormInput
            label="Code from the email"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
            error={showErrors ? errors.code : null}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={checkCode}
            style={styles.codeInput}
          />
          <Button title="Continue" onPress={checkCode} loading={submitting} />
          <View style={styles.secondary}>
            <Button
              title={cooldown.active ? `Send a new code in ${cooldown.remaining}s` : "Send a new code"}
              variant="ghost"
              size="sm"
              onPress={sendCode}
              disabled={cooldown.active || submitting}
            />
            <Button
              title="Use a different email"
              variant="ghost"
              size="sm"
              onPress={() => {
                setCode("");
                setFailure(null);
                setShowErrors(false);
                setStep("email");
              }}
            />
          </View>
        </>
      )}

      {step === "password" && (
        <>
          <FormInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            error={showErrors ? errors.password : null}
            hint={`At least ${LIMITS.passwordMin} characters, with a letter and a number.`}
            password
            autoComplete="new-password"
            textContentType="newPassword"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={savePassword}
          />
          <Button title="Save password" onPress={savePassword} loading={submitting} />
        </>
      )}
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
  secondary: { alignItems: "center", marginTop: spacing.md },
});
