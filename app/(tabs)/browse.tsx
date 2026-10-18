import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useNearbyTasks } from "../../lib/queries/tasks";
import { TaskCard } from "../../components/TaskCard";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES, type NearbyTask } from "../../lib/types";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { haptics } from "../../lib/haptics";
import { formatMoney } from "../../lib/format";

type ViewMode = "list" | "map";

function hasCoords(task: NearbyTask): task is NearbyTask & { task_lat: number; task_lng: number } {
  return Number.isFinite(task.task_lat) && Number.isFinite(task.task_lng);
}

export default function BrowseScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>("list");
  // Suburb or town name for the header, from the phone's own reverse geocoder. Optional.
  const [placeName, setPlaceName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied. Enable it in Settings to see tasks near you.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      try {
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        setPlaceName(place?.district || place?.subregion || place?.city || null);
      } catch {
        // The header just leaves the place name out.
      }
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

  const pinnedTasks = useMemo(() => (filteredTasks ?? []).filter(hasCoords), [filteredTasks]);

  if (locationError) {
    return <EmptyState icon="location-outline" title="Location is off" subtitle={locationError} />;
  }

  const toggleMode = () => {
    haptics.select();
    setMode((current) => (current === "list" ? "map" : "list"));
  };

  const renderContent = () => {
    if (!coords || isLoading) {
      return (
        <View style={styles.listContent}>
          <SkeletonList />
        </View>
      );
    }
    if (error) {
      return <EmptyState icon="cloud-offline-outline" title="Couldn't load tasks" subtitle={(error as Error).message} />;
    }

    if (mode === "map") {
      return (
        <View style={styles.flex}>
          <MapView
            style={styles.flex}
            initialRegion={{ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
            showsUserLocation
          >
            {pinnedTasks.map((task) => (
              <Marker
                key={task.id}
                coordinate={{ latitude: task.task_lat, longitude: task.task_lng }}
                pinColor={colors.primary}
              >
                <Callout onPress={() => router.push(`/task/${task.id}`)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={styles.calloutMeta}>
                      {formatMoney(task.budget)} · {task.category}
                    </Text>
                    <Text style={styles.calloutLink}>View task</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          {pinnedTasks.length === 0 && (
            <View style={styles.mapNotice}>
              <Text style={styles.mapNoticeText}>
                {filteredTasks?.length
                  ? "These tasks don't have map locations yet."
                  : search
                    ? "No tasks match your search."
                    : "No open tasks nearby right now."}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon={search ? "search-outline" : "map-outline"}
            title={search ? "No matching tasks" : "No open tasks nearby"}
            subtitle={search ? "Try a different search term." : "New tasks appear here as they're posted. Try another category."}
          />
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />}
      />
    );
  };

  const count = filteredTasks?.length ?? 0;
  const summary = !coords || isLoading ? "Finding tasks near you" : `${count} open`;
  const tagline = placeName ? `${placeName} · ${summary}` : summary;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks near you</Text>
        <Text style={styles.headerSubtitle}>{tagline}</Text>
      </View>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={colors.textFaint}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
          onPress={toggleMode}
          accessibilityLabel={mode === "list" ? "Show map" : "Show list"}
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
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  headerTitle: { ...typography.h1, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  callout: { minWidth: 160, maxWidth: 220, padding: 4, gap: 2 },
  calloutTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  calloutMeta: { fontSize: 12, color: colors.textMuted },
  calloutLink: { fontSize: 12, color: colors.primary, fontWeight: "500", marginTop: 2 },
  mapNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    ...shadow.raised,
  },
  mapNoticeText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});
