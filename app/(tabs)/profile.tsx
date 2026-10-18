import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useUpdateProfile, useUploadAvatar } from "../../lib/queries/profiles";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { StarRating } from "../../components/StarRating";
import { Avatar } from "../../components/Avatar";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";

const ROLE_LABEL: Record<string, string> = {
  client: "Looking for help",
  tasker: "Available for work",
  both: "Both posting and working",
};

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.id]);

  if (!profile) return null;

  const onPickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos access needed", "Enable photo library access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      await uploadAvatar.mutateAsync({ userId: profile.id, imageUri: result.assets[0].uri });
      haptics.success();
      await refreshProfile();
    } catch (err) {
      Alert.alert("Couldn't upload photo", getErrorMessage(err));
    }
  };

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
        <Pressable onPress={onPickAvatar} style={styles.avatarWrapper}>
          <Avatar name={profile.full_name} url={profile.avatar_url} size={76} />
          <View style={styles.avatarEditBadge}>
            {uploadAvatar.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="camera-outline" size={14} color={colors.white} />
            )}
          </View>
        </Pressable>
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
        placeholder="Your experience, skills and the areas you cover"
      />

      <Button title="Save changes" onPress={onSave} loading={updateProfile.isPending} />
      <View style={styles.signOutSpacer}>
        <Button title="Log out" variant="secondary" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatarWrapper: { marginBottom: spacing.sm },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  signOutSpacer: { marginTop: spacing.md },
});
