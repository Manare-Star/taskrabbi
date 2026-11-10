import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useUpdateProfile, useUploadAvatar } from "../../lib/queries/profiles";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { LIMITS } from "../../lib/config";
import { ROLE_OPTIONS } from "../../lib/roles";
import type { UserRole } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";
import { validateLength, validateName } from "../../lib/validation";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const toast = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [role, setRole] = useState<UserRole>(profile?.role ?? "client");
  const [showErrors, setShowErrors] = useState(false);

  if (!profile) return null;

  const errors = {
    fullName: validateName(fullName),
    bio: validateLength(bio, { max: LIMITS.bioMax, label: "your bio" }),
  };
  const changed = fullName.trim() !== profile.full_name || bio.trim() !== (profile.bio ?? "") || role !== profile.role;

  const onPickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access is off", "Allow access to your photos to set a profile picture.", [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
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
      await refreshProfile();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onSave = async () => {
    setShowErrors(true);
    if (errors.fullName || errors.bio) {
      haptics.error();
      return;
    }
    try {
      await updateProfile.mutateAsync({ userId: profile.id, fullName: fullName.trim(), bio: bio.trim(), role });
      await refreshProfile();
      toast.success("Profile saved");
      router.back();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <FormScreen>
      <Pressable
        onPress={onPickAvatar}
        disabled={uploadAvatar.isPending}
        style={styles.avatarButton}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        <Avatar name={profile.full_name} url={profile.avatar_url} size={88} />
        <View style={styles.avatarBadge}>
          {uploadAvatar.isPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="camera-outline" size={15} color={colors.white} />
          )}
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>A clear photo of your face helps people trust who they're hiring or working for.</Text>

      <FormInput
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={showErrors ? errors.fullName : null}
        maxLength={LIMITS.nameMax}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <FormInput
        label="About you"
        value={bio}
        onChangeText={setBio}
        error={showErrors ? errors.bio : null}
        hint="Your experience, skills and the areas you cover."
        multiline
        maxLength={LIMITS.bioMax}
        showCount
        style={styles.multiline}
      />

      <Text style={styles.label}>How you use Siza</Text>
      <View style={styles.roles} accessibilityRole="radiogroup">
        {ROLE_OPTIONS.map((option) => {
          const selected = role === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.select();
                setRole(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}. ${option.description}`}
              style={[styles.role, selected && styles.roleSelected]}
            >
              <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button title="Save changes" onPress={onSave} loading={updateProfile.isPending} disabled={!changed} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  avatarButton: { alignSelf: "center", marginTop: spacing.sm },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: { fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  roles: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  role: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  roleSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  roleLabel: { fontSize: 13, fontWeight: "500", color: colors.text, textAlign: "center" },
  roleLabelSelected: { color: colors.white },
});
