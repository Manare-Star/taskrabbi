import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useProfile } from "../../lib/queries/profiles";
import { useRatingsForUser, type RatingWithRater } from "../../lib/queries/ratings";
import { isBlocked, useBlockUser, useBlockedUsers, useUnblockUser } from "../../lib/queries/moderation";
import { ActionMenu, type ActionMenuItem } from "../../components/ActionMenu";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { HeaderButton } from "../../components/HeaderButton";
import { Notice } from "../../components/Notice";
import { ScreenLoader } from "../../components/ScreenLoader";
import { StarRatingInput } from "../../components/StarRatingInput";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { ROLE_LABEL } from "../../lib/roles";
import { getErrorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { useToast } from "../../lib/toast";

// Someone's public profile: who they are, how they're rated, and what people said.
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: profile, isLoading, error, refetch: refetchProfile } = useProfile(id);
  const { data: reviews, isRefetching, refetch: refetchReviews } = useRatingsForUser(id);
  const { data: blockedUsers } = useBlockedUsers(me?.id);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();

  if (isLoading) return <ScreenLoader />;
  if (error || !profile) {
    return (
      <EmptyState
        icon="person-outline"
        title="This profile isn't available"
        subtitle="The account may have been deleted."
        action={{ label: "Go back", onPress: () => router.back() }}
      />
    );
  }

  const isMe = me?.id === profile.id;
  const blocked = isBlocked(blockedUsers, profile.id);
  const name = profile.full_name || "This person";
  const memberSince = new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" });

  const onToggleBlock = async () => {
    if (!me) return;
    const input = { blockerId: me.id, blockedId: profile.id };
    try {
      if (blocked) {
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

  const menuItems: ActionMenuItem[] = [
    { label: `Report ${name}`, icon: "flag-outline", onPress: () => router.push({ pathname: "/report", params: { userId: profile.id, name } }) },
    { label: blocked ? `Unblock ${name}` : `Block ${name}`, icon: "ban-outline", destructive: !blocked, onPress: onToggleBlock },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: isMe ? "Your profile" : "Profile",
          headerRight: isMe
            ? () => <HeaderButton icon="create-outline" label="Edit profile" onPress={() => router.push("/settings/edit-profile")} />
            : () => <HeaderButton icon="ellipsis-horizontal" label="More options" onPress={() => setMenuOpen(true)} />,
        }}
      />
      <FlatList<RatingWithRater>
        data={reviews ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            tintColor={colors.primary}
            onRefresh={() => {
              refetchProfile();
              refetchReviews();
            }}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Avatar name={profile.full_name} url={profile.avatar_url} size={88} />
              <Text style={styles.name} accessibilityRole="header">
                {profile.full_name || "Unnamed"}
              </Text>
              <Text style={styles.role}>{ROLE_LABEL[profile.role]}</Text>
            </View>

            <View style={styles.stats}>
              <Stat value={profile.rating_count > 0 ? Number(profile.rating_avg).toFixed(1) : "–"} label="Rating" />
              <View style={styles.statDivider} />
              <Stat value={String(profile.rating_count)} label={profile.rating_count === 1 ? "Review" : "Reviews"} />
              <View style={styles.statDivider} />
              <Stat value={memberSince} label="Member since" small />
            </View>

            {blocked && (
              <View style={styles.block}>
                <Notice icon="ban-outline" title={`You've blocked ${name}`}>
                  <View style={styles.unblock}>
                    <Text style={styles.unblockText}>They can't bid on your tasks or message you.</Text>
                    <Button title="Unblock" variant="secondary" size="sm" onPress={onToggleBlock} loading={unblockUser.isPending} />
                  </View>
                </Notice>
              </View>
            )}

            {profile.bio ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.body}>{profile.bio}</Text>
              </View>
            ) : isMe ? (
              <View style={styles.block}>
                <Notice title="Add a short bio">
                  People are more likely to hire or work for someone who says a little about themselves.
                </Notice>
              </View>
            ) : null}

            <Text style={styles.sectionTitle} accessibilityRole="header">
              Reviews
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.noReviews}>
            <Text style={styles.noReviewsText}>
              {isMe ? "You'll see reviews here after your first completed task." : `${name} hasn't been reviewed yet.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.review}>
            <View style={styles.reviewHeader}>
              <Avatar name={item.rater?.full_name ?? ""} url={item.rater?.avatar_url} size={32} />
              <View style={styles.reviewMeta}>
                <Text style={styles.reviewerName} numberOfLines={1}>
                  {item.rater?.full_name || "Someone"}
                </Text>
                <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
              </View>
              <StarRatingInput value={item.stars} size={14} disabled />
            </View>
            {item.comment ? <Text style={styles.body}>{item.comment}</Text> : null}
          </View>
        )}
      />
      <ActionMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, small && styles.statValueSmall]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1, backgroundColor: colors.background },
  header: { alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  name: { ...typography.h2, color: colors.text, marginTop: spacing.sm, textAlign: "center" },
  role: { fontSize: 14, color: colors.textMuted },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
  },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: spacing.xs },
  statValue: { fontSize: 20, fontWeight: "600", color: colors.text },
  statValueSmall: { fontSize: 14, lineHeight: 24 },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.borderStrong },
  block: { marginTop: spacing.lg },
  unblock: { gap: spacing.sm, alignItems: "flex-start" },
  unblockText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  noReviews: { paddingVertical: spacing.md },
  noReviewsText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  review: {
    paddingVertical: spacing.md - 2,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  reviewMeta: { flex: 1 },
  reviewerName: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  reviewDate: { fontSize: 12, color: colors.textFaint },
});
