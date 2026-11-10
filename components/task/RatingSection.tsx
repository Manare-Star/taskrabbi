import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMyRatingForTask, useSubmitRating } from "../../lib/queries/ratings";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { LIMITS } from "../../lib/config";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";
import { Button } from "../Button";
import { FormInput } from "../FormInput";
import { StarRatingInput } from "../StarRatingInput";

interface RatingSectionProps {
  taskId: string;
  currentUserId: string;
  ratee: { id: string; full_name: string };
}

const STAR_WORDS = ["", "Poor", "Below average", "OK", "Good", "Excellent"];

// After a completed task: rate the other person, or see the rating already given.
export function RatingSection({ taskId, currentUserId, ratee }: RatingSectionProps) {
  const { data: myRating, isLoading } = useMyRatingForTask(taskId, currentUserId);
  const submitRating = useSubmitRating();
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  if (isLoading) return null;

  const name = ratee.full_name || "them";

  if (myRating) {
    return (
      <View style={styles.section}>
        <Text style={styles.title} accessibilityRole="header">
          Your review of {name}
        </Text>
        <View style={styles.card}>
          <StarRatingInput value={myRating.stars} size={20} disabled />
          {myRating.comment ? <Text style={styles.comment}>{myRating.comment}</Text> : null}
        </View>
      </View>
    );
  }

  const onSubmit = async () => {
    setShowErrors(true);
    if (stars < 1) {
      haptics.error();
      return;
    }
    try {
      await submitRating.mutateAsync({ taskId, rateeId: ratee.id, stars, comment: comment.trim() || undefined });
      toast.success("Review submitted");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        How was working with {name}?
      </Text>
      <Text style={styles.subtitle}>Your review appears on their profile and helps other people decide.</Text>
      <View style={styles.card}>
        <View style={styles.starsRow}>
          <StarRatingInput value={stars} onChange={setStars} />
          <Text style={styles.starWord}>{STAR_WORDS[stars]}</Text>
        </View>
        {showErrors && stars < 1 ? <Text style={styles.error}>Tap a star to rate.</Text> : null}
        <FormInput
          label="Review (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder="What went well, or what could have been better"
          multiline
          maxLength={LIMITS.reviewMax}
          showCount
          style={styles.multiline}
        />
        <Button title="Submit review" onPress={onSubmit} loading={submitRating.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  title: { ...typography.h3, color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 2 },
  card: {
    marginTop: spacing.md - 4,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    gap: spacing.sm,
  },
  starsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xs },
  starWord: { fontSize: 14, color: colors.textMuted },
  error: { fontSize: 12, color: colors.danger },
  comment: { ...typography.body, color: colors.text, lineHeight: 21 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
});
