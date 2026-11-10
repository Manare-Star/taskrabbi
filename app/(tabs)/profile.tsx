import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Avatar } from "../../components/Avatar";
import { ListRow, ListSection } from "../../components/ListRow";
import { StarRating } from "../../components/StarRating";
import { colors, spacing, typography } from "../../lib/theme";
import { APP_NAME, APP_VERSION, SUPPORT_EMAIL } from "../../lib/config";
import { ROLE_LABEL } from "../../lib/roles";
import { useToast } from "../../lib/toast";

export default function ProfileScreen() {
  const { profile, session, signOut } = useAuth();
  const toast = useToast();

  if (!profile) return null;

  const onSignOut = () => {
    Alert.alert("Log out?", "You'll need your email and password to log back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const contactSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} support`)}`;
    try {
      await Linking.openURL(url);
    } catch {
      // No mail app set up on this device: show the address so they can use it elsewhere.
      toast.info(`Email us at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={() => router.push(`/user/${profile.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${profile.full_name || "Your profile"}. View your public profile`}
      >
        <Avatar name={profile.full_name} url={profile.avatar_url} size={64} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.full_name || "Add your name"}
          </Text>
          <Text style={styles.role}>{ROLE_LABEL[profile.role]}</Text>
          <StarRating rating={profile.rating_avg} count={profile.rating_count} size={14} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
      </Pressable>

      <ListSection title="Account">
        <ListRow icon="person-outline" label="Edit profile" onPress={() => router.push("/settings/edit-profile")} />
        <ListRow icon="lock-closed-outline" label="Change password" onPress={() => router.push("/settings/change-password")} />
        <ListRow icon="ban-outline" label="Blocked people" onPress={() => router.push("/settings/blocked")} last />
      </ListSection>

      <ListSection title="Help">
        <ListRow icon="mail-outline" label="Contact support" onPress={contactSupport} />
        <ListRow icon="document-text-outline" label="Terms of Service" onPress={() => router.push("/legal/terms")} />
        <ListRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/legal/privacy")} last />
      </ListSection>

      <ListSection>
        <ListRow icon="log-out-outline" label="Log out" onPress={onSignOut} />
        <ListRow icon="trash-outline" label="Delete account" destructive onPress={() => router.push("/settings/delete-account")} last />
      </ListSection>

      <Text style={styles.footer}>
        Signed in as {session?.user.email}
        {"\n"}
        {APP_NAME} {APP_VERSION}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg },
  pressed: { opacity: 0.6 },
  headerText: { flex: 1, gap: 3 },
  name: { ...typography.h2, color: colors.text },
  role: { fontSize: 13, color: colors.textMuted },
  footer: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
