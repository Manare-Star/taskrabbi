import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { useBlockUser, useSubmitReport } from "../lib/queries/moderation";
import { Button } from "../components/Button";
import { FormInput } from "../components/FormInput";
import { FormScreen } from "../components/FormScreen";
import { Notice } from "../components/Notice";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../lib/theme";
import { LIMITS } from "../lib/config";
import { REPORT_REASONS, type ReportReason } from "../lib/types";
import { getErrorMessage } from "../lib/errors";
import { haptics } from "../lib/haptics";
import { useToast } from "../lib/toast";

// Report a person and/or a task. Opened as a modal with ?userId=…&taskId=…&name=….
export default function ReportScreen() {
  const { userId, taskId, name } = useLocalSearchParams<{ userId?: string; taskId?: string; name?: string }>();
  const { profile } = useAuth();
  const submitReport = useSubmitReport();
  const blockUser = useBlockUser();
  const toast = useToast();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const who = name || "this person";
  const reasonError = reason ? null : "Choose what best describes the problem.";
  const detailsError = reason === "other" && !details.trim() ? "Tell us what happened." : null;

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    if (!profile || !reason || detailsError) {
      haptics.error();
      return;
    }
    try {
      await submitReport.mutateAsync({ reporterId: profile.id, reportedUserId: userId, taskId, reason, details });
      if (alsoBlock && userId) {
        await blockUser.mutateAsync({ blockerId: profile.id, blockedId: userId });
      }
      toast.success(alsoBlock && userId ? "Report sent and person blocked" : "Report sent. Thank you.");
      router.back();
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    }
  };

  return (
    <FormScreen>
      <Text style={styles.title} accessibilityRole="header">
        {userId ? `Report ${who}` : "Report this task"}
      </Text>
      <Text style={styles.subtitle}>
        Reports are confidential: {userId ? who : "the person who posted it"} won't be told who sent this. We review every report.
      </Text>

      {failure ? (
        <View style={styles.block}>
          <Notice tone="danger">{failure}</Notice>
        </View>
      ) : null}

      <Text style={styles.label}>What's the problem?</Text>
      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REPORT_REASONS.map((option, index) => {
          const selected = reason === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.select();
                setReason(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
              style={({ pressed }) => [styles.reason, index > 0 && styles.reasonDivider, pressed && styles.pressed]}
            >
              <View style={styles.reasonText}>
                <Text style={styles.reasonLabel}>{option.label}</Text>
                <Text style={styles.reasonHint}>{option.hint}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
            </Pressable>
          );
        })}
      </View>
      {showErrors && reasonError ? <Text style={styles.error}>{reasonError}</Text> : null}

      <FormInput
        label={reason === "other" ? "What happened?" : "Anything else we should know? (optional)"}
        value={details}
        onChangeText={setDetails}
        error={showErrors ? detailsError : null}
        multiline
        maxLength={LIMITS.reportDetailsMax}
        showCount
        style={styles.multiline}
      />

      {userId ? (
        <Pressable
          onPress={() => {
            haptics.select();
            setAlsoBlock((current) => !current);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: alsoBlock }}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, alsoBlock && styles.checkboxChecked]}>
            {alsoBlock && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <View style={styles.reasonText}>
            <Text style={styles.reasonLabel}>Also block {who}</Text>
            <Text style={styles.reasonHint}>They won't be able to bid on your tasks or message you.</Text>
          </View>
        </Pressable>
      ) : null}

      <Button title="Send report" onPress={onSubmit} loading={submitReport.isPending || blockUser.isPending} />

      <Text style={styles.emergency}>If someone is in danger, call the police on 10111 or 112 from a mobile phone.</Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  block: { marginBottom: spacing.md },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  reasons: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: MIN_TOUCH + 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.white,
  },
  reasonDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  pressed: { backgroundColor: colors.surface },
  reasonText: { flex: 1, gap: 2 },
  reasonLabel: { ...typography.body, color: colors.text },
  reasonHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  error: { fontSize: 12, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4, minHeight: MIN_TOUCH, marginBottom: spacing.lg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  emergency: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
});
