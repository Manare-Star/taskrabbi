import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useDeleteAccount } from "../../lib/queries/account";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";

const CONFIRM_WORD = "DELETE";

const WHAT_GOES = [
  "Your profile, photo and reviews you've written",
  "Tasks you've posted, with their bids and photos",
  "Bids you've made on other people's tasks",
  "All your conversations, for you and the other person",
];

export default function DeleteAccountScreen() {
  const { session } = useAuth();
  const deleteAccount = useDeleteAccount();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const confirmed = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const onDelete = () => {
    if (!session) return;
    Alert.alert("Delete your account?", "This is permanent and can't be undone.", [
      { text: "Keep my account", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: async () => {
          setFailure(null);
          try {
            await deleteAccount.mutateAsync(session.user.id);
            // Signed out as part of the deletion; the tabs layout sends the user to Welcome.
            toast.success("Your account has been deleted");
          } catch (err) {
            haptics.error();
            setFailure(getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <FormScreen>
      <Text style={styles.lead}>Deleting your account is permanent. This will remove:</Text>
      <View style={styles.list}>
        {WHAT_GOES.map((item) => (
          <View key={item} style={styles.listRow}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} style={styles.listIcon} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <Notice>
          Payment records are kept by our payment provider, Paystack, as the law requires. If you have a job in progress,
          finish or cancel it first.
        </Notice>
      </View>

      {failure ? (
        <View style={styles.block}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      <FormInput
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
      />
      <Button title="Delete my account" variant="danger" onPress={onDelete} loading={deleteAccount.isPending} disabled={!confirmed} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { ...typography.body, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
  list: { gap: spacing.sm + 2, marginBottom: spacing.lg },
  listRow: { flexDirection: "row", gap: spacing.sm + 2 },
  listIcon: { marginTop: 1 },
  listText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
  block: { marginBottom: spacing.md },
});
