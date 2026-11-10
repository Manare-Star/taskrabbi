import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { useBlockedUsers, useUnblockUser } from "../../lib/queries/moderation";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ScreenLoader } from "../../components/ScreenLoader";
import { colors, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { useToast } from "../../lib/toast";
import type { BlockedUser } from "../../lib/types";

export default function BlockedUsersScreen() {
  const { profile } = useAuth();
  const { data: blocked, isLoading, isRefetching, refetch, error } = useBlockedUsers(profile?.id);
  const unblock = useUnblockUser();
  const toast = useToast();

  if (isLoading) return <ScreenLoader />;
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load this list"
        subtitle={getErrorMessage(error)}
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  }

  const onUnblock = async (entry: BlockedUser) => {
    if (!profile) return;
    try {
      await unblock.mutateAsync({ blockerId: profile.id, blockedId: entry.blocked_id });
      toast.success(`${entry.blocked?.full_name || "They"} can contact you again`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <FlatList<BlockedUser>
      data={blocked}
      keyExtractor={(item) => item.blocked_id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
      ListHeaderComponent={
        blocked?.length ? (
          <Text style={styles.intro}>People you've blocked can't bid on your tasks or message you, and you won't see their tasks.</Text>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon="ban-outline"
          title="You haven't blocked anyone"
          subtitle="You can block someone from their profile. They won't be told."
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar name={item.blocked?.full_name ?? ""} url={item.blocked?.avatar_url} size={40} />
          <Text style={styles.name} numberOfLines={1}>
            {item.blocked?.full_name || "Someone"}
          </Text>
          <Button
            title="Unblock"
            variant="secondary"
            size="sm"
            onPress={() => onUnblock(item)}
            disabled={unblock.isPending}
            accessibilityLabel={`Unblock ${item.blocked?.full_name || "this person"}`}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, flexGrow: 1, backgroundColor: colors.background },
  intro: { fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingVertical: spacing.md - 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  name: { ...typography.body, color: colors.text, flex: 1 },
});
