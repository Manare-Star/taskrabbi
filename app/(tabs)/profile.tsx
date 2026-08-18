import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { useUpdateProfile } from "../../lib/queries/profiles";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { StarRating } from "../../components/StarRating";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";

const ROLE_LABEL: Record<string, string> = {
  client: "Looking for help",
  tasker: "Available for work",
  both: "Both posting and working",
};

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.id]);

  if (!profile) return null;

  const initials = profile.full_name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSave = async () => {
    try {
      await updateProfile.mutateAsync({ userId: profile.id, fullName: fullName.trim(), bio: bio.trim() });
      await refreshProfile();
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Couldn't save", getErrorMessage(err));
    }
  };

  const onSignOut = () => {
    Alert.alert("Log out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "?"}</Text>
        </View>
        <Text style={styles.name}>{profile.full_name || "Unnamed"}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{ROLE_LABEL[profile.role]}</Text>
        </View>
        <View style={styles.ratingSpacer}>
          <StarRating rating={profile.rating_avg} count={profile.rating_count} size={16} />
        </View>
      </View>

      <View style={styles.divider} />

      <FormInput label="Full name" value={fullName} onChangeText={setFullName} />
      <FormInput
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        style={styles.multiline}
        placeholder="Tell people a bit about yourself..."
      />

      <Button title="Save changes" onPress={onSave} loading={updateProfile.isPending} />
      <View style={styles.signOutSpacer}>
        <Button title="Log out" variant="secondary" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.white, fontSize: 26, fontWeight: "700" },
  name: { ...typography.h2, fontSize: 20, color: colors.text },
  roleBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  roleBadgeText: { ...typography.caption, color: colors.primaryDark, fontSize: 12 },
  ratingSpacer: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.lg },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  signOutSpacer: { marginTop: spacing.md },
});
