import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useCreateTask } from "../../lib/queries/tasks";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";
import { haptics } from "../../lib/haptics";
import { useCelebrate } from "../../lib/celebration";
import { SchedulePicker } from "../../components/SchedulePicker";
import { FLEXIBLE, toScheduledFor, type ScheduleValue } from "../../lib/schedule";

export default function PostTaskScreen() {
  const { profile } = useAuth();
  const createTask = useCreateTask();
  const celebrate = useCelebrate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>(FLEXIBLE);

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos access needed", "Enable photo library access to attach a picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Enable location permission to attach it to your task.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (place) {
        setAddressText([place.name, place.street, place.city, place.region].filter(Boolean).join(", "));
      }
    } catch (err) {
      Alert.alert("Couldn't get location", getErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const onSubmit = async () => {
    const parsedBudget = Number(budget);
    if (!title || !description || !category || !addressText || !coords || !parsedBudget || parsedBudget <= 0) {
      Alert.alert("Missing info", "Fill in every field, pick a category, and set a location.");
      return;
    }
    if (!profile) return;

    try {
      const task = await createTask.mutateAsync({
        clientId: profile.id,
        title: title.trim(),
        description: description.trim(),
        category,
        budget: parsedBudget,
        addressText: addressText.trim(),
        lat: coords.lat,
        lng: coords.lng,
        imageUri: imageUri ?? undefined,
        scheduledFor: toScheduledFor(schedule),
      });
      setTitle("");
      setDescription("");
      setBudget("");
      setCategory(null);
      setAddressText("");
      setCoords(null);
      setImageUri(null);
      setSchedule(FLEXIBLE);
      celebrate("Task posted");
      router.push(`/task/${task.id}`);
    } catch (err) {
      haptics.error();
      Alert.alert("Couldn't post task", getErrorMessage(err));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormInput label="Title" value={title} onChangeText={setTitle} placeholder="Assemble IKEA bookshelf" />
        <FormInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What needs doing, and anything a tasker should know"
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
        <FormInput
          label="Budget (R)"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="500"
        />

        <Text style={styles.label}>When do you need it?</Text>
        <View style={styles.chipsBleed}>
          <SchedulePicker value={schedule} onChange={setSchedule} />
        </View>

        <Text style={styles.label}>Photo (optional)</Text>
        <Pressable style={styles.photoPicker} onPress={onPickPhoto}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
              <Text style={styles.photoPlaceholderText}>Add a photo</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsBleed}>
          <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} showAll={false} />
        </View>

        <View style={styles.locationSection}>
          <FormInput
            label="Location"
            value={addressText}
            onChangeText={setAddressText}
            placeholder="Street address or suburb"
          />
          <Button title="Use my location" variant="secondary" onPress={useCurrentLocation} loading={locating} />
          {coords && (
            <View style={styles.coordsRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.coordsText}>Location pinned on the map</Text>
            </View>
          )}
        </View>

        <Button title="Post task" onPress={onSubmit} loading={createTask.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  chipsBleed: { marginHorizontal: -spacing.md, marginBottom: spacing.md },
  photoPicker: { marginBottom: spacing.lg },
  photoPreview: { width: "100%", height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: {
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  photoPlaceholderText: { ...typography.caption, color: colors.textMuted },
  locationSection: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coordsText: { fontSize: 13, color: colors.primaryDark },
});
