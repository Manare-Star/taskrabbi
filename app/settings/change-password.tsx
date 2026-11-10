import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { spacing } from "../../lib/theme";
import { LIMITS } from "../../lib/config";
import { getErrorMessage } from "../../lib/errors";
import { validatePassword, validateRequired } from "../../lib/validation";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = {
    current: validateRequired(currentPassword, "Enter your current password."),
    next:
      validatePassword(newPassword) ??
      (newPassword === currentPassword ? "Choose a password that's different from your current one." : null),
  };

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    if (errors.current || errors.next) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password changed");
      router.back();
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      {failure ? (
        <View style={styles.failure}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      <FormInput
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        error={showErrors ? errors.current : null}
        password
        autoComplete="current-password"
        textContentType="password"
      />
      <FormInput
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={showErrors ? errors.next : null}
        hint={`At least ${LIMITS.passwordMin} characters, with a letter and a number.`}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <Button title="Change password" onPress={onSubmit} loading={submitting} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  failure: { marginBottom: spacing.md },
});
