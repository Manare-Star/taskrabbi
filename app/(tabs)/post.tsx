import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useCreateTask } from "../../lib/queries/tasks";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/FormInput";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { colors, radius, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES } from "../../lib/types";
import { getErrorMessage } from "../../lib/errors";

export default function PostTaskScreen() {
  const { profile } = useAuth();
  const createTask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

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
      });
      setTitle("");
      setDescription("");
      setBudget("");
      setCategory(null);
      setAddressText("");
      setCoords(null);
      router.push(`/task/${task.id}`);
    } catch (err) {
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
          placeholder="Describe what you need done..."
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
        <FormInput
          label="Budget (USD)"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="50"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsBleed}>
          <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} />
        </View>

        <View style={styles.locationSection}>
          <FormInput
            label="Location"
            value={addressText}
            onChangeText={setAddressText}
            placeholder="Tap 'Use my location' or type an address"
          />
          <Button title="Use my location" variant="secondary" onPress={useCurrentLocation} loading={locating} />
          {coords && (
            <View style={styles.coordsPill}>
              <Text style={styles.coordsText}>
                Pinned at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        <Button title="Post Task" onPress={onSubmit} loading={createTask.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  chipsBleed: { marginHorizontal: -spacing.lg, marginBottom: spacing.sm },
  locationSection: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  coordsPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  coordsText: { fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
});
