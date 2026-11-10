import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { formatMoney, timeAgo } from "../../lib/format";
import type { BidWithTasker } from "../../lib/types";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { StarRating } from "../StarRating";
import { StatusPill } from "../StatusPill";

interface BidCardProps {
  bid: BidWithTasker;
  // Shown only while the task is open and the bid is still on the table.
  onAccept?: () => void;
  accepting?: boolean;
  onOpenProfile: () => void;
}

// One tasker's offer, as the client sees it.
export function BidCard({ bid, onAccept, accepting, onOpenProfile }: BidCardProps) {
  const name = bid.tasker?.full_name || "A tasker";
  const inactive = bid.status === "withdrawn" || bid.status === "rejected";

  return (
    <View style={[styles.card, inactive && styles.cardInactive]}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={`${name}, bid ${formatMoney(bid.amount)}. View profile`}
      >
        <Avatar name={name} url={bid.tasker?.avatar_url} size={44} />
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <StarRating rating={bid.tasker?.rating_avg ?? 0} count={bid.tasker?.rating_count ?? 0} />
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amount}>{formatMoney(bid.amount)}</Text>
          <Text style={styles.when}>{timeAgo(bid.created_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.placeholder} />
      </Pressable>

      {bid.message ? <Text style={styles.message}>{bid.message}</Text> : null}

      {bid.status !== "pending" && <StatusPill status={bid.status} />}

      {onAccept && bid.status === "pending" && (
        <Button title={`Accept for ${formatMoney(bid.amount)}`} size="sm" onPress={onAccept} loading={accepting} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.md - 2,
    gap: spacing.sm + 2,
  },
  cardInactive: { backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  who: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.text },
  amountCol: { alignItems: "flex-end", gap: 2 },
  amount: { ...typography.bodyStrong, fontSize: 16, color: colors.text },
  when: { fontSize: 12, color: colors.textFaint },
  message: { ...typography.body, fontSize: 14, lineHeight: 20, color: colors.text },
});
