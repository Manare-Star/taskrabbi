import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTask } from "../../lib/queries/tasks";
import { useBidsForTask } from "../../lib/queries/bids";
import { usePaystackCheckout, useVerifyPaystackPayment } from "../../lib/queries/payments";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Notice } from "../../components/Notice";
import { ScreenLoader } from "../../components/ScreenLoader";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";

// Pay for a finished job. The amount comes from the server (the accepted bid), the card
// details are entered on Paystack's own page inside a web view, and the task is only marked
// complete after the server has confirmed the payment with Paystack.
export default function CheckoutScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: task } = useTask(taskId);
  const { data: bids } = useBidsForTask(taskId);
  const { data: checkout, error: startFailure, refetch: retryStart, isFetching: starting } = usePaystackCheckout(taskId);
  const verifyPayment = useVerifyPaystackPayment();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const taskerName = bids?.find((bid) => bid.status === "accepted")?.tasker?.full_name;

  // Ask the server whether Paystack received the money. Used when checkout redirects back,
  // and by "I've already paid" if the redirect never arrived.
  const confirmPayment = async ({ quiet }: { quiet: boolean }) => {
    if (!checkout || !taskId) return;
    setSheetOpen(false);
    setNotice(null);
    try {
      await verifyPayment.mutateAsync({ taskId, reference: checkout.reference });
      toast.success("Payment complete", { confetti: true });
      // Close this modal; the task screen underneath updates itself to Completed.
      router.back();
    } catch (err) {
      haptics.error();
      setNotice(quiet ? "We couldn't find a completed payment yet. If you did pay, wait a moment and check again." : getErrorMessage(err));
    }
  };

  // Paystack ends checkout by navigating to our callback/cancel URLs. Catch those instead of
  // loading them (they don't exist), then close the sheet.
  const onNavigation = (request: WebViewNavigation) => {
    if (!checkout) return true;
    if (request.url.startsWith(checkout.callbackUrl)) {
      void confirmPayment({ quiet: false });
      return false;
    }
    if (request.url.startsWith(checkout.cancelUrl)) {
      setSheetOpen(false);
      return false;
    }
    return true;
  };

  if (starting) return <ScreenLoader />;
  if (startFailure || !checkout) {
    return (
      <EmptyState
        icon="card-outline"
        title="Couldn't start the payment"
        subtitle={getErrorMessage(startFailure)}
        action={{ label: "Try again", onPress: () => void retryStart() }}
      />
    );
  }

  const amount = formatMoney(checkout.amount, { cents: true });

  return (
    <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.summary}>
        <Text style={styles.amountLabel}>You're paying</Text>
        <Text style={styles.amount} accessibilityRole="header">
          {amount}
        </Text>
        <View style={styles.rows}>
          <SummaryRow label="For" value={task?.title ?? "Task"} />
          {taskerName ? <SummaryRow label="To" value={taskerName} /> : null}
          <SummaryRow label="Reference" value={checkout.reference.slice(-12)} last />
        </View>
      </View>

      {notice ? <Notice tone="warning">{notice}</Notice> : null}

      {checkout.testMode ? (
        <Notice title="Test mode">
          No real money moves. Use Paystack's test card 4084 0840 8408 4081, any future expiry date, CVV 408.
        </Notice>
      ) : (
        <Notice icon="shield-checkmark-outline">
          Pay only once the work is done to your satisfaction. Paying completes the task.
        </Notice>
      )}

      <View style={styles.footer}>
        <Button
          title={verifyPayment.isPending ? "Confirming payment…" : `Pay ${amount}`}
          icon="lock-closed-outline"
          onPress={() => setSheetOpen(true)}
          loading={verifyPayment.isPending}
        />
        <Button
          title="I've already paid"
          variant="ghost"
          size="sm"
          onPress={() => confirmPayment({ quiet: true })}
          disabled={verifyPayment.isPending}
        />
        <View style={styles.securedRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
          <Text style={styles.secured}>Card details go straight to Paystack. Siza never sees them.</Text>
        </View>
      </View>

      <Modal visible={sheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Pay {amount}</Text>
          <Pressable onPress={() => setSheetOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel payment">
            <Text style={styles.sheetCancel}>Cancel</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: checkout.authorizationUrl }}
          onShouldStartLoadWithRequest={onNavigation}
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={colors.primary} style={styles.webLoading} />}
        />
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.md, gap: spacing.md, backgroundColor: colors.background },
  summary: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingTop: spacing.lg,
    alignItems: "center",
    overflow: "hidden",
  },
  amountLabel: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 38, fontWeight: "600", letterSpacing: -0.8, color: colors.text, marginTop: 2 },
  rows: { alignSelf: "stretch", marginTop: spacing.lg, backgroundColor: colors.surface },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 3 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  footer: { marginTop: "auto", gap: spacing.xs },
  securedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: spacing.xs },
  secured: { fontSize: 12, color: colors.textMuted },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  sheetTitle: { ...typography.h3, color: colors.text },
  sheetCancel: { ...typography.body, color: colors.primary },
  webLoading: { position: "absolute", top: "45%", alignSelf: "center" },
});
