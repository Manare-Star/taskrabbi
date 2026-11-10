import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useAuth } from "../../lib/auth-context";
import { useCancelTask, useMarkTaskDone, useTask, useTaskPrivateDetails } from "../../lib/queries/tasks";
import { useAcceptBid, useBidsForTask, useMyBidOnTask, useWithdrawBid } from "../../lib/queries/bids";
import { useThreadForTask } from "../../lib/queries/chat";
import { useProfile } from "../../lib/queries/profiles";
import { usePaymentForTask } from "../../lib/queries/payments";
import { isBlocked, useBlockUser, useBlockedUsers, useUnblockUser } from "../../lib/queries/moderation";
import { ActionMenu, type ActionMenuItem } from "../../components/ActionMenu";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { HeaderButton } from "../../components/HeaderButton";
import { Notice } from "../../components/Notice";
import { ScreenLoader } from "../../components/ScreenLoader";
import { StarRating } from "../../components/StarRating";
import { StatusPill } from "../../components/StatusPill";
import { BidCard } from "../../components/task/BidCard";
import { BidForm } from "../../components/task/BidForm";
import { RatingSection } from "../../components/task/RatingSection";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { BidWithTasker, TaskPrivateDetails } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";
import { categoryIcon } from "../../lib/categories";
import { formatDate, formatMoney, timeAgo } from "../../lib/format";
import { describeSchedule } from "../../lib/schedule";
import { useToast } from "../../lib/toast";

// Opens the phone's maps app at a point, falling back to Google Maps in the browser.
async function openInMaps(place: TaskPrivateDetails, label: string) {
  const point = `${place.lat},${place.lng}`;
  const native = Platform.select({
    ios: `maps://?q=${encodeURIComponent(label)}&ll=${point}`,
    android: `geo:${point}?q=${point}(${encodeURIComponent(label)})`,
  });
  try {
    if (native && (await Linking.canOpenURL(native))) {
      await Linking.openURL(native);
      return;
    }
  } catch {
    // Fall through to the web link.
  }
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point}`);
}

// Bids worth the client's attention first; taken-back and declined ones at the bottom.
const BID_ORDER: Record<string, number> = { accepted: 0, pending: 1, withdrawn: 2, rejected: 3 };

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const headerHeight = useHeaderHeight();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: task, isLoading: taskLoading, isRefetching: taskRefetching, refetch: refetchTask, error: taskError } = useTask(id);
  const isOwner = !!profile && !!task && profile.id === task.client_id;
  const inProgress = task?.status === "assigned";
  const hasCounterpart = task?.status === "assigned" || task?.status === "completed";

  const { data: bids, isLoading: bidsLoading, isRefetching: bidsRefetching, refetch: refetchBids } = useBidsForTask(
    isOwner ? id : undefined
  );
  const { data: myBid, isRefetching: myBidRefetching, refetch: refetchMyBid } = useMyBidOnTask(
    task && !isOwner ? id : undefined,
    profile?.id
  );
  const acceptedBid = isOwner ? bids?.find((bid) => bid.status === "accepted") : undefined;
  const isHiredTasker = !isOwner && myBid?.status === "accepted";
  const isParticipant = isOwner || isHiredTasker;

  const { data: thread } = useThreadForTask(hasCounterpart && isParticipant ? id : undefined);
  const { data: clientProfile } = useProfile(task && !isOwner ? task.client_id : undefined);
  // The street address: the client always, the tasker once hired. Nobody else asks.
  const { data: place } = useTaskPrivateDetails(id, !!task && isParticipant);
  const { data: payment } = usePaymentForTask(task?.status === "completed" && isParticipant ? id : undefined);
  const { data: blockedUsers } = useBlockedUsers(profile?.id);

  const acceptBid = useAcceptBid();
  const cancelTask = useCancelTask();
  const markDone = useMarkTaskDone();
  const withdrawBid = useWithdrawBid();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();

  // Tell a tasker the moment their bid is answered while they're looking at the task.
  const previousBidStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!myBid) return;
    const previous = previousBidStatus.current;
    if (previous === "pending" && myBid.status === "accepted") toast.success("Your bid was accepted");
    if (previous === "pending" && myBid.status === "rejected") toast.info("The client chose another tasker");
    previousBidStatus.current = myBid.status;
  }, [myBid, toast]);

  if (taskLoading) return <ScreenLoader />;
  if (taskError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load this task"
        subtitle={getErrorMessage(taskError)}
        action={{ label: "Try again", onPress: () => refetchTask() }}
      />
    );
  }
  if (!task || !profile) {
    return (
      <EmptyState
        icon="document-outline"
        title="This task is no longer available"
        subtitle="It may have been removed by the person who posted it."
        action={{ label: "Go back", onPress: () => router.back() }}
      />
    );
  }

  const agreedAmount = acceptedBid?.amount ?? (isHiredTasker ? myBid?.amount : undefined);
  const counterpartName = isOwner ? acceptedBid?.tasker?.full_name || "your tasker" : clientProfile?.full_name || "the client";
  const clientBlocked = isBlocked(blockedUsers, task.client_id);

  const isRefreshing = taskRefetching || bidsRefetching || myBidRefetching;
  const onRefresh = () => {
    refetchTask();
    if (isOwner) refetchBids();
    else refetchMyBid();
  };

  const onAccept = (bid: BidWithTasker) => {
    const name = bid.tasker?.full_name || "this tasker";
    Alert.alert(
      `Hire ${name} for ${formatMoney(bid.amount)}?`,
      "Other bids will be declined, your address will be shared with them, and a chat will open so you can arrange the details.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Hire",
          onPress: async () => {
            try {
              const newThread = await acceptBid.mutateAsync(bid.id);
              toast.success(`${name} is hired`);
              router.push(`/chat/${newThread.id}`);
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const onCancel = () => {
    Alert.alert(
      inProgress ? "Cancel this job?" : "Cancel this task?",
      inProgress
        ? `${isOwner ? "The tasker" : "The client"} will be told. This can't be undone.`
        : "Taskers won't be able to bid on it any more. This can't be undone.",
      [
        { text: inProgress ? "Keep job" : "Keep task", style: "cancel" },
        {
          text: inProgress ? "Cancel job" : "Cancel task",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelTask.mutateAsync(task.id);
              toast.info(inProgress ? "Job cancelled" : "Task cancelled");
              if (!inProgress) router.back();
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const onMarkDone = () => {
    Alert.alert("Mark this job as done?", "The client will be asked to check the work and pay.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Mark as done",
        onPress: async () => {
          try {
            await markDone.mutateAsync(task.id);
            toast.success("Marked as done");
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const onWithdraw = () => {
    if (!myBid) return;
    Alert.alert("Withdraw your bid?", "You can bid again while the task is still open.", [
      { text: "Keep bid", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          try {
            await withdrawBid.mutateAsync(myBid);
            toast.info("Bid withdrawn");
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const onToggleBlock = async () => {
    const input = { blockerId: profile.id, blockedId: task.client_id };
    const name = clientProfile?.full_name || "This person";
    try {
      if (clientBlocked) {
        await unblockUser.mutateAsync(input);
        toast.info(`${name} is unblocked`);
      } else {
        await blockUser.mutateAsync(input);
        toast.info(`${name} is blocked`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const menuItems: ActionMenuItem[] = [];
  if (isOwner && task.status === "open") {
    menuItems.push({ label: "Cancel task", icon: "close-circle-outline", destructive: true, onPress: onCancel });
  }
  if (isParticipant && inProgress) {
    menuItems.push({ label: "Cancel job", icon: "close-circle-outline", destructive: true, onPress: onCancel });
  }
  if (!isOwner) {
    menuItems.push({
      label: "Report this task",
      icon: "flag-outline",
      onPress: () =>
        router.push({ pathname: "/report", params: { taskId: task.id, userId: task.client_id, name: clientProfile?.full_name ?? "" } }),
    });
    menuItems.push({
      label: clientBlocked ? "Unblock this person" : "Block this person",
      icon: "ban-outline",
      destructive: !clientBlocked,
      onPress: onToggleBlock,
    });
  }

  const sortedBids = [...(bids ?? [])].sort((a, b) => (BID_ORDER[a.status] ?? 9) - (BID_ORDER[b.status] ?? 9));
  const liveBidCount = sortedBids.filter((bid) => bid.status === "pending").length;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen
        options={{
          headerRight: menuItems.length
            ? () => <HeaderButton icon="ellipsis-horizontal" label="More options" onPress={() => setMenuOpen(true)} />
            : undefined,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <StatusPill status={task.status} />
        <Text style={styles.title} accessibilityRole="header">
          {task.title}
        </Text>
        <Text style={styles.budget}>
          {formatMoney(agreedAmount ?? task.budget)}
          <Text style={styles.budgetNote}>{agreedAmount !== undefined ? "  agreed price" : "  budget"}</Text>
        </Text>

        {/* What happens next, for whoever is looking. */}
        <StatusBanner
          status={task.status}
          isOwner={isOwner}
          isHiredTasker={isHiredTasker}
          hasBid={!!myBid}
          taskerDoneAt={task.tasker_done_at}
          counterpartName={counterpartName}
          paidOn={payment?.status === "succeeded" ? payment.created_at : undefined}
          amount={agreedAmount}
        />

        {isParticipant && hasCounterpart && (
          <View style={styles.actions}>
            {isOwner && inProgress && (
              <>
                <Button
                  title={agreedAmount !== undefined ? `Pay ${formatMoney(agreedAmount)}` : "Pay"}
                  icon="lock-closed-outline"
                  onPress={() => router.push(`/checkout/${task.id}`)}
                />
                <Text style={styles.payNote}>Pay once the work is done. Secure payment by Paystack.</Text>
              </>
            )}
            {isHiredTasker && inProgress && !task.tasker_done_at && (
              <Button title="Mark job as done" icon="checkmark-circle-outline" onPress={onMarkDone} loading={markDone.isPending} />
            )}
            {thread && (
              <Button
                title={`Message ${counterpartName}`}
                variant="secondary"
                icon="chatbubble-outline"
                onPress={() => router.push(`/chat/${thread.id}`)}
              />
            )}
          </View>
        )}

        <View style={styles.facts}>
          <Fact icon={categoryIcon(task.category)} text={task.category} />
          <Fact icon="calendar-outline" text={describeSchedule(task.scheduled_for)} />
          {place ? (
            <Pressable
              onPress={() => openInMaps(place, task.title).catch(() => toast.error("Couldn't open a maps app"))}
              accessibilityRole="link"
              accessibilityLabel={`${place.address_text}. Open in maps`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Fact icon="location-outline" text={place.address_text} detail="Open in maps" />
            </Pressable>
          ) : (
            <Fact
              icon="location-outline"
              text={task.area_text}
              detail={isOwner ? undefined : "The street address is shared once you're hired."}
            />
          )}
          <Fact icon="time-outline" text={`Posted ${timeAgo(task.created_at) === "now" ? "just now" : `${timeAgo(task.created_at)} ago`}`} />
        </View>

        {task.image_url && <Image source={{ uri: task.image_url }} style={styles.image} accessibilityLabel="Photo of the task" />}

        <Text style={styles.sectionLabel}>Details</Text>
        <Text style={styles.description}>{task.description}</Text>

        {!isOwner && clientProfile && (
          <Pressable
            style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
            onPress={() => router.push(`/user/${clientProfile.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Posted by ${clientProfile.full_name}. View profile`}
          >
            <Avatar name={clientProfile.full_name} url={clientProfile.avatar_url} size={40} />
            <View style={styles.personText}>
              <Text style={styles.personLabel}>Posted by</Text>
              <Text style={styles.personName} numberOfLines={1}>
                {clientProfile.full_name || "Someone"}
              </Text>
            </View>
            <StarRating rating={clientProfile.rating_avg} count={clientProfile.rating_count} />
            <Ionicons name="chevron-forward" size={16} color={colors.placeholder} />
          </Pressable>
        )}

        {/* The client's view of the offers. */}
        {isOwner && (task.status === "open" || sortedBids.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {task.status === "open" ? `Bids${liveBidCount ? ` (${liveBidCount})` : ""}` : "Bids received"}
            </Text>
            {bidsLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            ) : sortedBids.length === 0 ? (
              <Notice icon="time-outline" title="No bids yet">
                Offers from taskers appear here as they come in. We'll notify you.
              </Notice>
            ) : (
              <View style={styles.bidList}>
                {sortedBids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    onAccept={task.status === "open" ? () => onAccept(bid) : undefined}
                    accepting={acceptBid.isPending && acceptBid.variables === bid.id}
                    onOpenProfile={() => router.push(`/user/${bid.tasker_id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* The tasker's own bid, or the form to make one. */}
        {!isOwner && task.status === "open" && (
          <>
            {myBid && myBid.status !== "withdrawn" ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Your bid
                </Text>
                <View style={styles.myBid}>
                  <View style={styles.myBidRow}>
                    <Text style={styles.myBidAmount}>{formatMoney(myBid.amount)}</Text>
                    <StatusPill status={myBid.status} label={myBid.status === "pending" ? "Waiting for a reply" : undefined} />
                  </View>
                  {myBid.message ? <Text style={styles.myBidMessage}>{myBid.message}</Text> : null}
                  {myBid.status === "pending" && (
                    <Button title="Withdraw bid" variant="dangerOutline" size="sm" onPress={onWithdraw} loading={withdrawBid.isPending} />
                  )}
                </View>
              </View>
            ) : clientBlocked ? (
              <View style={styles.section}>
                <Notice icon="ban-outline" title="You've blocked this person">
                  Unblock them from the menu above to bid on their tasks.
                </Notice>
              </View>
            ) : (
              <BidForm
                key={myBid?.id ?? "new"}
                taskId={task.id}
                taskerId={profile.id}
                budget={task.budget}
                withdrawnBid={myBid?.status === "withdrawn" ? myBid : undefined}
              />
            )}
          </>
        )}

        {task.status === "completed" && isOwner && acceptedBid && (
          <RatingSection
            taskId={task.id}
            currentUserId={profile.id}
            ratee={{ id: acceptedBid.tasker_id, full_name: acceptedBid.tasker?.full_name ?? "" }}
          />
        )}
        {task.status === "completed" && isHiredTasker && clientProfile && (
          <RatingSection
            taskId={task.id}
            currentUserId={profile.id}
            ratee={{ id: clientProfile.id, full_name: clientProfile.full_name }}
          />
        )}
      </ScrollView>

      <ActionMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />
    </KeyboardAvoidingView>
  );
}

function Fact({ icon, text, detail }: { icon: keyof typeof Ionicons.glyphMap; text: string; detail?: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.factIcon} />
      <View style={styles.factText}>
        <Text style={styles.factMain}>{text}</Text>
        {detail ? <Text style={styles.factDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

// One sentence on where the task stands and what the viewer should do about it.
function StatusBanner(props: {
  status: string;
  isOwner: boolean;
  isHiredTasker: boolean;
  hasBid: boolean;
  taskerDoneAt: string | null;
  counterpartName: string;
  paidOn?: string;
  amount?: number;
}) {
  const { status, isOwner, isHiredTasker, hasBid, taskerDoneAt, counterpartName, paidOn, amount } = props;
  let banner: { tone: "info" | "success" | "warning" | "danger"; title: string; body?: string } | null = null;

  if (status === "assigned") {
    if (isOwner) {
      banner = taskerDoneAt
        ? { tone: "success", title: `${counterpartName} marked the job as done`, body: "Check the work, then pay to complete the task." }
        : { tone: "info", title: `${counterpartName} is doing this task`, body: "Arrange the details in the chat. Pay when the work is done." };
    } else if (isHiredTasker) {
      banner = taskerDoneAt
        ? { tone: "info", title: "Waiting for payment", body: `You marked this as done. ${counterpartName} has been asked to pay.` }
        : { tone: "success", title: "You're hired", body: "Arrange the details in the chat. Mark the job as done when you've finished." };
    } else {
      banner = { tone: "info", title: hasBid ? "The client chose another tasker" : "This task has been assigned" };
    }
  } else if (status === "completed") {
    const paid = amount !== undefined && paidOn ? `${formatMoney(amount)} paid on ${formatDate(paidOn)}.` : undefined;
    banner =
      isOwner || isHiredTasker
        ? { tone: "success", title: "Completed and paid", body: paid }
        : { tone: "info", title: "This task has been completed" };
  } else if (status === "cancelled") {
    banner = { tone: "danger", title: "This task was cancelled" };
  }

  if (!banner) return null;
  return (
    <View style={styles.banner}>
      <Notice tone={banner.tone} title={banner.title}>
        {banner.body}
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  budget: { fontSize: 22, fontWeight: "600", color: colors.text, marginTop: 2 },
  budgetNote: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
  banner: { marginTop: spacing.md },
  actions: { marginTop: spacing.md, gap: spacing.sm + 2 },
  payNote: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: -spacing.xs },
  facts: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: spacing.md - 4,
  },
  fact: { flexDirection: "row", gap: spacing.md - 4 },
  factIcon: { marginTop: 2 },
  factText: { flex: 1, gap: 1 },
  factMain: { ...typography.body, color: colors.text, lineHeight: 21 },
  factDetail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  pressed: { opacity: 0.6 },
  image: { width: "100%", height: 210, borderRadius: radius.lg, marginTop: spacing.md, backgroundColor: colors.surfaceAlt },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.lg,
  },
  description: { ...typography.body, color: colors.text, marginTop: spacing.xs, lineHeight: 23 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
    padding: spacing.md - 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
  },
  personText: { flex: 1, gap: 1 },
  personLabel: { fontSize: 12, color: colors.textMuted },
  personName: { ...typography.bodyStrong, color: colors.text },
  section: { marginTop: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md - 4 },
  spinner: { marginVertical: spacing.md },
  bidList: { gap: spacing.sm + 2 },
  myBid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  myBidRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  myBidAmount: { fontSize: 20, fontWeight: "600", color: colors.text },
  myBidMessage: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
