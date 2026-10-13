import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTask } from "../../lib/queries/tasks";
import { useConfirmPayment, useCreatePaymentIntent } from "../../lib/queries/payments";
import { Button } from "../../components/Button";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { useCelebrate } from "../../lib/celebration";
import { formatMoney } from "../../lib/format";

export default function CheckoutScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { data: task } = useTask(taskId);
  const createPaymentIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const celebrate = useCelebrate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [ready, setReady] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        const intent = await createPaymentIntent.mutateAsync(taskId);
        const { error } = await initPaymentSheet({
          merchantDisplayName: "TaskRabbit Clone",
          paymentIntentClientSecret: intent.clientSecret,
        });
        if (error) throw new Error(error.message);
        setPaymentIntentId(intent.paymentIntentId);
        setAmount(intent.amount);
        setReady(true);
      } catch (err) {
        Alert.alert("Couldn't start checkout", getErrorMessage(err));
        router.back();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const onPay = async () => {
    if (!paymentIntentId || !taskId) return;
    setPaying(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== "Canceled") {
          Alert.alert("Payment failed", error.message);
        }
        return;
      }
      await confirmPayment.mutateAsync({ taskId, paymentIntentId });
      celebrate("Paid! Task complete 🎉");
      Alert.alert("Payment successful", "The task has been marked as completed.");
      router.replace(`/task/${taskId}`);
    } catch (err) {
      Alert.alert("Couldn't confirm payment", getErrorMessage(err));
    } finally {
      setPaying(false);
    }
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
        {amount !== null && <Text style={styles.amount}>{formatMoney(amount, { cents: true })}</Text>}
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hint}>Test mode — use card 4242 4242 4242 4242, any future date and CVC.</Text>
      </View>

      {!ready ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <Button title="Pay now" onPress={onPay} loading={paying || confirmPayment.isPending} />
      )}
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
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted, fontWeight: "400", flex: 1 },
  spinner: { marginTop: spacing.lg },
});
