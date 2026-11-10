import { useMemo, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNearbyTasks } from "../../lib/queries/tasks";
import { TaskCard } from "../../components/TaskCard";
import { TaskMap } from "../../components/TaskMap";
import { MIN_TOUCH, colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES, type NearbyTask } from "../../lib/types";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { haptics } from "../../lib/haptics";
import { getErrorMessage } from "../../lib/errors";
import { useDeviceLocation } from "../../lib/use-device-location";

type ViewMode = "list" | "map";

export default function BrowseScreen() {
  const location = useDeviceLocation();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>("list");

  const place = location.data?.status === "ready" ? location.data : null;
  const coords = useMemo(() => (place ? { lat: place.lat, lng: place.lng } : null), [place]);
  const retryLocate = () => void location.refetch();

  const { data: tasks, isLoading, isRefetching, refetch, error } = useNearbyTasks({
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    category,
  });

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!tasks || !query) return tasks ?? [];
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.area_text.toLowerCase().includes(query)
    );
  }, [tasks, search]);

  const openTask = (taskId: string) => router.push(`/task/${taskId}`);

  const toggleMode = () => {
    haptics.select();
    setMode((current) => (current === "list" ? "map" : "list"));
  };

  const renderContent = () => {
    if (location.data?.status === "denied") {
      return (
        <EmptyState
          icon="location-outline"
          title="Turn on location to see tasks near you"
          subtitle="Siza uses your location only while the app is open, to find tasks in your area."
          action={
            location.data.canAskAgain
              ? { label: "Allow location", onPress: retryLocate }
              : { label: "Open settings", onPress: () => Linking.openSettings() }
          }
        />
      );
    }
    if (location.isError) {
      return (
        <EmptyState
          icon="location-outline"
          title="Couldn't find your location"
          subtitle="Check that location services are on, then try again."
          action={{ label: "Try again", onPress: retryLocate }}
        />
      );
    }
    if (!coords || isLoading) {
      return (
        <View style={styles.listContent}>
          <SkeletonList />
        </View>
      );
    }
    if (error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load tasks"
          subtitle={getErrorMessage(error)}
          action={{ label: "Try again", onPress: () => refetch() }}
        />
      );
    }

    if (mode === "map") {
      return (
        <View style={styles.flex}>
          <TaskMap center={coords} tasks={filteredTasks} onOpenTask={openTask} />
          <View style={styles.mapNotice} pointerEvents="none">
            <Text style={styles.mapNoticeText}>
              {filteredTasks.length === 0
                ? search
                  ? "No tasks match your search."
                  : "No open tasks nearby right now."
                : "Pins show the general area. The exact address is shared only with the tasker who's hired."}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <FlatList<NearbyTask>
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          search ? (
            <EmptyState
              icon="search-outline"
              title="No matching tasks"
              subtitle="Try a different word, or clear the search."
              action={{ label: "Clear search", onPress: () => setSearch("") }}
            />
          ) : (
            <EmptyState
              icon="map-outline"
              title={category ? `No ${category.toLowerCase()} tasks nearby` : "No open tasks nearby"}
              subtitle="New tasks appear here as they're posted. Pull down to refresh."
              action={category ? { label: "Show all categories", onPress: () => setCategory(null) } : undefined}
            />
          )
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={() => openTask(item.id)} />}
      />
    );
  };

  const count = filteredTasks.length;
  const summary =
    location.isLoading || location.isRefetching || (coords && isLoading)
      ? "Finding tasks near you"
      : coords
        ? `${count} open ${count === 1 ? "task" : "tasks"}`
        : "";
  const tagline = [place?.placeName, summary].filter(Boolean).join(" · ");

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Tasks near you
        </Text>
        <Text style={styles.headerSubtitle}>{tagline || " "}</Text>
      </View>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color={colors.placeholder} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Search tasks"
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.placeholder} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
          onPress={toggleMode}
          accessibilityRole="button"
          accessibilityLabel={mode === "list" ? "Show tasks on a map" : "Show tasks as a list"}
        >
          <Ionicons name={mode === "list" ? "map-outline" : "list-outline"} size={19} color={colors.text} />
        </Pressable>
      </View>
      <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  headerTitle: { ...typography.h1, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md - 4,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md - 4,
    height: MIN_TOUCH,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  modeButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  mapNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    ...shadow.raised,
  },
  mapNoticeText: { fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: "center" },
});
