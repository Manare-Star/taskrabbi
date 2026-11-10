import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePlaceBid } from "../../lib/queries/bids";
import { colors, spacing, typography } from "../../lib/theme";
import { LIMITS } from "../../lib/config";
import { getErrorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { parseMoney, validateLength, validateMoney } from "../../lib/validation";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";
import type { Bid } from "../../lib/types";
import { Button } from "../Button";
import { FormInput } from "../FormInput";
import { Notice } from "../Notice";

interface BidFormProps {
  taskId: string;
  taskerId: string;
  budget: number;
  // The tasker's earlier bid on this task, if they withdrew it: bidding again revives it.
  withdrawnBid?: Bid;
}

// A tasker's offer on an open task: a price and an optional note to the client.
export function BidForm({ taskId, taskerId, budget, withdrawnBid }: BidFormProps) {
  const placeBid = usePlaceBid();
  const toast = useToast();
  const [amount, setAmount] = useState(withdrawnBid ? String(withdrawnBid.amount) : "");
  const [message, setMessage] = useState(withdrawnBid?.message ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = {
    amount: validateMoney(amount, "your price"),
    message: validateLength(message, { max: LIMITS.bidMessageMax, label: "your message" }),
  };

  const onSubmit = async () => {
    setShowErrors(true);
    setFailure(null);
    const parsed = parseMoney(amount);
    if (errors.amount || errors.message || parsed === null) {
      haptics.error();
      return;
    }
    try {
      await placeBid.mutateAsync({ taskId, taskerId, amount: parsed, message, withdrawnBidId: withdrawnBid?.id });
      toast.success("Bid sent");
    } catch (err) {
      haptics.error();
      setFailure(getErrorMessage(err));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {withdrawnBid ? "Bid again" : "Make an offer"}
      </Text>
      <Text style={styles.subtitle}>
        The client's budget is {formatMoney(budget)}. You can offer more or less; only they will see your bid.
      </Text>

      {failure ? <Notice tone="danger">{failure}</Notice> : null}

      <FormInput
        label="Your price"
        value={amount}
        onChangeText={setAmount}
        error={showErrors ? errors.amount : null}
        prefix="R"
        keyboardType="decimal-pad"
        placeholder={String(Math.round(budget))}
        maxLength={12}
      />
      <FormInput
        label="Message to the client (optional)"
        value={message}
        onChangeText={setMessage}
        error={showErrors ? errors.message : null}
        hint="Your experience with this kind of job, and when you can do it."
        multiline
        maxLength={LIMITS.bidMessageMax}
        showCount
        style={styles.multiline}
      />
      <Button title="Send bid" onPress={onSubmit} loading={placeBid.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  title: { ...typography.h3, color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  multiline: { minHeight: 84, textAlignVertical: "top" },
});
