import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useProfile } from "../../lib/queries/profiles";
import { useRatingsForUser, type RatingWithRater } from "../../lib/queries/ratings";
import { Avatar } from "../../components/Avatar";
import { StarRating } from "../../components/StarRating";
import { StarRatingInput } from "../../components/StarRatingInput";
import { EmptyState } from "../../components/EmptyState";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";

const ROLE_LABEL: Record<string, string> = {
  client: "Looking for help",
  tasker: "Available for work",
  both: "Posts tasks and takes on work",
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading, refetch: refetchProfile } = useProfile(id);
  const { data: reviews, isRefetching, refetch: refetchReviews } = useRatingsForUser(id);

  if (isLoading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <FlatList<RatingWithRater>
      data={reviews ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refetchProfile();
            refetchReviews();
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Avatar name={profile.full_name} url={profile.avatar_url} size={84} />
            <Text style={styles.name}>{profile.full_name || "Unnamed"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABEL[profile.role]}</Text>
            </View>
            <View style={styles.ratingRow}>
              <StarRating rating={profile.rating_avg} count={profile.rating_count} size={16} />
            </View>
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          </View>

          {profile.bio ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.body}>{profile.bio}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            Reviews{reviews?.length ? ` (${reviews.length})` : ""}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState emoji="🌱" title="No reviews yet" subtitle="Reviews appear after completed tasks." />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.reviewHeader}>
            <Avatar name={item.rater.full_name} url={item.rater.avatar_url} size={32} />
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewerName}>{item.rater.full_name || "Someone"}</Text>
              <Text style={styles.reviewDate}>
                {new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
            <StarRatingInput value={item.stars} size={14} disabled />
          </View>
          {item.comment ? <Text style={styles.body}>{item.comment}</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, flexGrow: 1 },
  header: { alignItems: "center", marginBottom: spacing.lg, gap: spacing.xs },
  name: { ...typography.h2, fontSize: 20, color: colors.text, marginTop: spacing.sm },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  roleBadgeText: { ...typography.caption, color: colors.primaryDark, fontSize: 12 },
  ratingRow: { marginTop: spacing.xs },
  memberSince: { fontSize: 12, color: colors.textFaint },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reviewMeta: { flex: 1 },
  reviewerName: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  reviewDate: { fontSize: 12, color: colors.textFaint },
});
