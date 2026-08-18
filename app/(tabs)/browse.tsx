import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useNearbyTasks } from "../../lib/queries/tasks";
import { TaskCard } from "../../components/TaskCard";
import { colors, radius, spacing } from "../../lib/theme";
import { TASK_CATEGORIES } from "../../lib/types";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";

export default function BrowseScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied. Enable it in Settings to see tasks near you.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    })();
  }, []);

  const { data: tasks, isLoading, isRefetching, refetch, error } = useNearbyTasks({
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    category,
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return tasks;
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter(
      (task) => task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query)
    );
  }, [tasks, search]);

  if (locationError) {
    return <EmptyState icon="location-outline" title="Location needed" subtitle={locationError} />;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textFaint}
        />
      </View>
      <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} />
      {!coords || isLoading ? (
        <View style={styles.listContent}>
          <SkeletonList />
        </View>
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load tasks" subtitle={(error as Error).message} />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={search ? "No matching tasks" : "No open tasks nearby"}
              subtitle={search ? "Try a different search term." : "Check back soon, or try a different category."}
            />
          }
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
});
