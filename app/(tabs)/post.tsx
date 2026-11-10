import { useRef, useState } from "react";
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useCreateTask } from "../../lib/queries/tasks";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { FormScreen } from "../../components/FormScreen";
import { Notice } from "../../components/Notice";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { SchedulePicker } from "../../components/SchedulePicker";
import { LocationPickerModal, type Coordinates } from "../../components/LocationPickerModal";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES } from "../../lib/types";
import { LIMITS } from "../../lib/config";
import { getErrorMessage } from "../../lib/errors";
import { isValid, parseMoney, validateLength, validateMoney } from "../../lib/validation";
import { haptics } from "../../lib/haptics";
import { useToast } from "../../lib/toast";
import { FLEXIBLE, toScheduledFor, type ScheduleValue } from "../../lib/schedule";

// What the phone's reverse geocoder knows about a point, split into the part everyone sees
// (suburb, town) and the part only the hired tasker sees (street address).
function describePlace(place: Location.LocationGeocodedAddress | undefined): { area: string; address: string } {
  if (!place) return { area: "", address: "" };
  const unique = (parts: (string | null | undefined)[]) =>
    parts.map((part) => part?.trim()).filter((part, index, all): part is string => !!part && all.indexOf(part) === index);

  const street = place.street ? [place.streetNumber, place.street].filter(Boolean).join(" ") : place.name;
  const area = unique([place.district ?? place.subregion, place.city]);
  return {
    area: area.join(", "),
    address: unique([street, ...area, place.postalCode]).join(", "),
  };
}

export default function PostTaskScreen() {
  const { profile } = useAuth();
  const createTask = useCreateTask();
  const toast = useToast();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>(FLEXIBLE);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [areaText, setAreaText] = useState("");
  const [addressText, setAddressText] = useState("");
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const errors = {
    title: validateLength(title, { min: LIMITS.taskTitleMin, max: LIMITS.taskTitleMax, label: "the title" }),
    description: validateLength(description, { min: 1, max: LIMITS.taskDescriptionMax, label: "a description" }),
    category: category ? null : "Choose a category.",
    budget: validateMoney(budget, "your budget"),
    location: coords ? null : "Set where the task needs doing.",
    area: coords ? validateLength(areaText, { min: 2, max: LIMITS.areaMax, label: "the suburb or area" }) : null,
    address: coords ? validateLength(addressText, { min: 1, max: LIMITS.addressMax, label: "the street address" }) : null,
  };

  // Fill in the area and address for a chosen point, without overwriting what the user typed
  // if the phone can't name the place.
  const applyLocation = async (coordinates: Coordinates) => {
    setCoords(coordinates);
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: coordinates.lat, longitude: coordinates.lng });
      const { area, address } = describePlace(place);
      if (area) setAreaText(area);
      if (address) setAddressText(address);
    } catch {
      // The fields stay as they are, to be typed in.
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location is off",
          "Allow location access to use where you are now, or choose the place on the map instead.",
          permission.canAskAgain
            ? [{ text: "OK" }]
            : [{ text: "Not now", style: "cancel" }, { text: "Open settings", onPress: () => Linking.openSettings() }]
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await applyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      haptics.success();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't get your location. Try choosing it on the map."));
    } finally {
      setLocating(false);
    }
  };

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access is off", "Allow access to your photos to add a picture to this task.", [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
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

  const reset = () => {
    setTitle("");
    setDescription("");
    setBudget("");
    setCategory(null);
    setSchedule(FLEXIBLE);
    setImageUri(null);
    setCoords(null);
    setAreaText("");
    setAddressText("");
    setShowErrors(false);
  };

  const onSubmit = async () => {
    setShowErrors(true);
    const amount = parseMoney(budget);
    if (!isValid(errors) || !profile || !category || !coords || amount === null) {
      haptics.error();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    try {
      const task = await createTask.mutateAsync({
        clientId: profile.id,
        title: title.trim(),
        description: description.trim(),
        category,
        budget: amount,
        areaText: areaText.trim(),
        addressText: addressText.trim(),
        lat: coords.lat,
        lng: coords.lng,
        imageUri: imageUri ?? undefined,
        scheduledFor: toScheduledFor(schedule),
      });
      reset();
      if (imageUri && !task.image_url) {
        toast.info("Task posted, but the photo didn't upload");
      } else {
        toast.success("Task posted");
      }
      router.push(`/task/${task.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const hasErrors = showErrors && !isValid(errors);

  return (
    <FormScreen scrollRef={scrollRef}>
      {hasErrors && (
        <View style={styles.block}>
          <Notice tone="danger">A few things need your attention before this can be posted.</Notice>
        </View>
      )}

      <FormInput
        label="What do you need done?"
        value={title}
        onChangeText={setTitle}
        error={showErrors ? errors.title : null}
        placeholder="Assemble a flat-pack wardrobe"
        maxLength={LIMITS.taskTitleMax}
        showCount
        returnKeyType="next"
      />
      <FormInput
        label="Details"
        value={description}
        onChangeText={setDescription}
        error={showErrors ? errors.description : null}
        hint="Size of the job, tools or materials needed, access, parking, pets."
        multiline
        maxLength={LIMITS.taskDescriptionMax}
        showCount
        style={styles.multiline}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipsBleed}>
        <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} showAll={false} />
      </View>
      <FieldError message={showErrors ? errors.category : null} />

      <FormInput
        label="Budget"
        value={budget}
        onChangeText={setBudget}
        error={showErrors ? errors.budget : null}
        hint="What you expect to pay. Taskers can bid higher or lower."
        prefix="R"
        keyboardType="decimal-pad"
        placeholder="500"
        maxLength={12}
      />

      <Text style={styles.label}>When do you need it?</Text>
      <View style={[styles.chipsBleed, styles.block]}>
        <SchedulePicker value={schedule} onChange={setSchedule} />
      </View>

      <Text style={styles.label}>Photo (optional)</Text>
      {imageUri ? (
        <View style={styles.block}>
          <Image source={{ uri: imageUri }} style={styles.photoPreview} accessibilityLabel="Photo attached to this task" />
          <View style={styles.photoActions}>
            <Button title="Change photo" variant="secondary" size="sm" onPress={onPickPhoto} />
            <Button title="Remove" variant="ghost" size="sm" onPress={() => setImageUri(null)} />
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.photoPlaceholder, styles.block, pressed && styles.pressed]}
          onPress={onPickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
        >
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          <Text style={styles.photoPlaceholderText}>Add a photo</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Where?</Text>
      <View style={styles.locationButtons}>
        <View style={styles.locationButton}>
          <Button title="Use my location" variant="secondary" size="sm" icon="locate-outline" onPress={useCurrentLocation} loading={locating} />
        </View>
        <View style={styles.locationButton}>
          <Button title="Choose on map" variant="secondary" size="sm" icon="map-outline" onPress={() => setPickerOpen(true)} />
        </View>
      </View>
      <FieldError message={showErrors ? errors.location : null} />

      {coords && (
        <View style={styles.locationFields}>
          <View style={styles.pinnedRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.pinnedText}>Location set. Check the details below.</Text>
          </View>
          <FormInput
            label="Suburb or area"
            value={areaText}
            onChangeText={setAreaText}
            error={showErrors ? errors.area : null}
            hint="Shown to everyone browsing tasks."
            placeholder="Sandton, Johannesburg"
            maxLength={LIMITS.areaMax}
            autoCapitalize="words"
          />
          <FormInput
            label="Street address"
            value={addressText}
            onChangeText={setAddressText}
            error={showErrors ? errors.address : null}
            hint="Private. Only shared with the tasker you hire."
            placeholder="12 Main Road, Sandton"
            maxLength={LIMITS.addressMax}
            autoCapitalize="words"
          />
        </View>
      )}

      <View style={styles.submit}>
        <Button title="Post task" onPress={onSubmit} loading={createTask.isPending} />
      </View>

      <LocationPickerModal
        visible={pickerOpen}
        initial={coords}
        onClose={() => setPickerOpen(false)}
        onConfirm={(coordinates) => {
          setPickerOpen(false);
          void applyLocation(coordinates);
        }}
      />
    </FormScreen>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.fieldError} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md },
  label: { ...typography.label, fontWeight: "500", color: colors.text, marginBottom: 6 },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  chipsBleed: { marginHorizontal: -spacing.md, marginBottom: spacing.sm },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: -spacing.xs, marginBottom: spacing.md },
  photoPreview: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  photoPlaceholder: {
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  photoPlaceholderText: { fontSize: 13, color: colors.textMuted },
  pressed: { opacity: 0.6 },
  locationButtons: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  locationButton: { flex: 1 },
  locationFields: { marginTop: -spacing.xs },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  pinnedText: { fontSize: 13, color: colors.primaryDark },
  submit: { marginTop: spacing.sm },
});
