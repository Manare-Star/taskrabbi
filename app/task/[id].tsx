import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useCancelTask, useTask } from "../../lib/queries/tasks";
import { useAcceptBid, useBidsForTask, useMyBidOnTask, usePlaceBid } from "../../lib/queries/bids";
import { useThreadForTask } from "../../lib/queries/chat";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { StarRating } from "../../components/StarRating";
import { EmptyState } from "../../components/EmptyState";
import { colors, radius, shadow, spacing, statusColors, typography } from "../../lib/theme";
import type { BidWithTasker } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const { data: task, isLoading: taskLoading } = useTask(id);
  const isOwner = !!profile && !!task && profile.id === task.client_id;

  const { data: bids, isLoading: bidsLoading } = useBidsForTask(isOwner ? id : undefined);
  const { data: myBid } = useMyBidOnTask(!isOwner ? id : undefined, profile?.id);
  const { data: thread } = useThreadForTask(task?.status === "assigned" || task?.status === "completed" ? id : undefined);

  const acceptBid = useAcceptBid();
  const cancelTask = useCancelTask();

  const previousBidStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!myBid) return;
    const prev = previousBidStatus.current;
    if (prev && prev !== myBid.status) {
      if (myBid.status === "accepted") {
        Alert.alert("Bid accepted! 🎉", "The client accepted your bid. Open the chat to coordinate details.", [
          { text: "Later", style: "cancel" },
          { text: "Open chat", onPress: () => thread && router.push(`/chat/${thread.id}`) },
        ]);
      } else if (myBid.status === "rejected") {
        Alert.alert("Bid not accepted", "The client went with another tasker this time.");
      }
    }
    previousBidStatus.current = myBid.status;
  }, [myBid, thread]);

  if (taskLoading || !task) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const onAccept = async (bidId: string) => {
    try {
      const newThread = await acceptBid.mutateAsync(bidId);
      router.push(`/chat/${newThread.id}`);
    } catch (err) {
      Alert.alert("Couldn't accept bid", getErrorMessage(err));
    }
  };

  const onCancel = () => {
    Alert.alert("Cancel this task?", "Taskers won't be able to bid anymore.", [
      { text: "Keep task", style: "cancel" },
      {
        text: "Cancel task",
        style: "destructive",
        onPress: () => cancelTask.mutate(task.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  const status = statusColors[task.status];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusPillText, { color: status.fg }]}>{task.status}</Text>
        </View>
      </View>
      <Text style={styles.budget}>${task.budget.toFixed(0)}</Text>
      <Text style={styles.meta}>
        {task.category} · {task.address_text}
      </Text>
      <Text style={styles.description}>{task.description}</Text>

      {(task.status === "assigned" || task.status === "completed") && thread && (
        <View style={styles.actionSpacer}>
          <Button title="Open chat" variant="secondary" onPress={() => router.push(`/chat/${thread.id}`)} />
        </View>
      )}

      {task.status === "assigned" && isOwner && (
        <View style={styles.actionSpacer}>
          <Button title="Mark complete & pay" onPress={() => router.push(`/checkout/${task.id}`)} />
        </View>
      )}

      {isOwner ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bids</Text>
          {bidsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : !bids?.length ? (
            <EmptyState icon="people-outline" title="No bids yet" subtitle="Taskers who bid will show up here." />
          ) : (
            bids.map((bid: BidWithTasker) => {
              const bidStatus = statusColors[bid.status];
              return (
                <View key={bid.id} style={styles.bidCard}>
                  <View style={styles.bidHeader}>
                    <Text style={styles.bidderName}>{bid.tasker.full_name}</Text>
                    <Text style={styles.bidAmount}>${bid.amount.toFixed(0)}</Text>
                  </View>
                  <StarRating rating={bid.tasker.rating_avg} count={bid.tasker.rating_count} />
                  {bid.message ? <Text style={styles.bidMessage}>{bid.message}</Text> : null}
                  <View style={[styles.statusPill, { backgroundColor: bidStatus.bg, alignSelf: "flex-start" }]}>
                    <Text style={[styles.statusPillText, { color: bidStatus.fg }]}>{bid.status}</Text>
                  </View>
                  {task.status === "open" && bid.status === "pending" && (
                    <Button
                      title="Accept bid"
                      onPress={() => onAccept(bid.id)}
                      loading={acceptBid.isPending}
                    />
                  )}
                </View>
              );
            })
          )}
          {task.status === "open" && (
            <Button title="Cancel task" variant="danger" onPress={onCancel} loading={cancelTask.isPending} />
          )}
        </View>
      ) : (
        task.status === "open" && <BidForm taskId={task.id} existingBid={myBid} />
      )}
    </ScrollView>
  );
}

function BidForm({ taskId, existingBid }: { taskId: string; existingBid: ReturnType<typeof useMyBidOnTask>["data"] }) {
  const { profile } = useAuth();
  const placeBid = usePlaceBid();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  if (existingBid) {
    const bidStatus = statusColors[existingBid.status];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your bid</Text>
        <View style={styles.bidCard}>
          <Text style={styles.bidAmount}>${existingBid.amount.toFixed(0)}</Text>
          <View style={[styles.statusPill, { backgroundColor: bidStatus.bg, alignSelf: "flex-start" }]}>
            <Text style={[styles.statusPillText, { color: bidStatus.fg }]}>{existingBid.status}</Text>
          </View>
        </View>
      </View>
    );
  }

  const onSubmit = async () => {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || !profile) {
      Alert.alert("Missing info", "Enter a valid bid amount.");
      return;
    }
    try {
      await placeBid.mutateAsync({ taskId, taskerId: profile.id, amount: parsedAmount, message });
    } catch (err) {
      Alert.alert("Couldn't place bid", getErrorMessage(err));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Place a bid</Text>
      <FormInput label="Your price (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="45" />
      <FormInput
        label="Message (optional)"
        value={message}
        onChangeText={setMessage}
        placeholder="Introduce yourself, share availability..."
        multiline
        numberOfLines={3}
        style={styles.multiline}
      />
      <Button title="Submit bid" onPress={onSubmit} loading={placeBid.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  title: { ...typography.h1, fontSize: 24, color: colors.text, flex: 1 },
  budget: { ...typography.h2, fontSize: 20, color: colors.primary, marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  description: { ...typography.body, color: colors.text, marginTop: spacing.md, lineHeight: 22 },
  actionSpacer: { marginTop: spacing.md },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  bidCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  bidHeader: { flexDirection: "row", justifyContent: "space-between" },
  bidderName: { ...typography.bodyStrong, color: colors.text },
  bidAmount: { ...typography.bodyStrong, color: colors.primary },
  bidMessage: { ...typography.body, color: colors.text },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusPillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
});
