import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTask } from "../../lib/queries/tasks";
import { useStartPaystackCheckout, useVerifyPaystackPayment, type PaystackCheckout } from "../../lib/queries/payments";
import { Button } from "../../components/Button";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useCelebrate } from "../../lib/celebration";
import { formatMoney } from "../../lib/format";

export default function CheckoutScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { data: task } = useTask(taskId);
  const startCheckout = useStartPaystackCheckout();
  const verifyPayment = useVerifyPaystackPayment();
  const celebrate = useCelebrate();

  const [checkout, setCheckout] = useState<PaystackCheckout | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    startCheckout
      .mutateAsync(taskId)
      .then(setCheckout)
      .catch((err) => {
        Alert.alert("Couldn't start checkout", getErrorMessage(err));
        router.back();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const onCheckoutFinished = async () => {
    if (!checkout || !taskId) return;
    setSheetOpen(false);
    try {
      await verifyPayment.mutateAsync({ taskId, reference: checkout.reference });
      celebrate("Paid! Task complete 🎉");
      router.replace(`/task/${taskId}`);
    } catch (err) {
      haptics.error();
      Alert.alert("Payment not confirmed", getErrorMessage(err));
    }
  };

  // Paystack ends checkout by navigating to our callback/cancel URLs. Catch those instead of
  // loading them (they don't exist), then close the sheet.
  const onNavigation = (request: WebViewNavigation) => {
    if (!checkout) return true;
    if (request.url.startsWith(checkout.callbackUrl)) {
      onCheckoutFinished();
      return false;
    }
    if (request.url.startsWith(checkout.cancelUrl)) {
      setSheetOpen(false);
      return false;
    }
    return true;
  };

  return (
    <View style={styles.content}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="card" size={26} color={colors.primary} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {task?.title ?? "Checkout"}
        </Text>
        {checkout && <Text style={styles.amount}>{formatMoney(checkout.amount, { cents: true })}</Text>}
        <Text style={styles.secured}>🔒 Secured by Paystack</Text>
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hint}>
          Test mode: no real money moves. Paystack's checkout lists test cards you can use (for example 4084 0840
          8408 4081, CVV 408, any future date).
        </Text>
      </View>

      {!checkout ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <Button
          title={verifyPayment.isPending ? "Confirming payment..." : "Pay now"}
          onPress={() => setSheetOpen(true)}
          loading={verifyPayment.isPending}
        />
      )}

      <Modal visible={sheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Pay {checkout ? formatMoney(checkout.amount, { cents: true }) : ""}</Text>
          <Pressable onPress={() => setSheetOpen(false)} hitSlop={12}>
            <Text style={styles.sheetCancel}>Cancel</Text>
          </Pressable>
        </View>
        {checkout && (
          <WebView
            source={{ uri: checkout.authorizationUrl }}
            onShouldStartLoadWithRequest={onNavigation}
            startInLoadingState
            renderLoading={() => <ActivityIndicator color={colors.primary} style={styles.webLoading} />}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.raised,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text, textAlign: "center" },
  amount: { ...typography.h1, fontSize: 36, color: colors.primary, marginTop: spacing.sm },
  secured: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontWeight: "600" },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted, fontWeight: "400", flex: 1 },
  spinner: { marginTop: spacing.lg },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.h3, color: colors.text },
  sheetCancel: { ...typography.bodyStrong, color: colors.primary },
  webLoading: { position: "absolute", top: "45%", alignSelf: "center" },
});
