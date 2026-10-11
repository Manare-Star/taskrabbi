import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useNearbyTasks } from "../../lib/queries/tasks";
import { TaskCard } from "../../components/TaskCard";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { TASK_CATEGORIES, type NearbyTask } from "../../lib/types";
import { CategoryFilterChips } from "../../components/CategoryFilterChips";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonList } from "../../components/SkeletonCard";
import { haptics } from "../../lib/haptics";

type ViewMode = "list" | "map";

function hasCoords(task: NearbyTask): task is NearbyTask & { task_lat: number; task_lng: number } {
  return Number.isFinite(task.task_lat) && Number.isFinite(task.task_lng);
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function BrowseScreen() {
  const { profile } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>("list");

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

  const pinnedTasks = useMemo(() => (filteredTasks ?? []).filter(hasCoords), [filteredTasks]);

  if (locationError) {
    return <EmptyState emoji="🧭" title="Where are you?" subtitle={locationError} />;
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
      return <EmptyState emoji="😵‍💫" title="Couldn't load tasks" subtitle={(error as Error).message} />;
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
                      ${task.budget.toFixed(0)} · {task.category}
                    </Text>
                    <Text style={styles.calloutLink}>Tap to view</Text>
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
            emoji={search ? "🔍" : "🌤️"}
            title={search ? "Nothing matches that" : "All quiet nearby"}
            subtitle={search ? "Try a different search term." : "Check back soon, or try another category."}
          />
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={() => router.push(`/task/${item.id}`)} />}
      />
    );
  };

  const firstName = profile?.full_name.split(" ")[0] || "there";
  const count = filteredTasks?.length ?? 0;
  const tagline = !coords || isLoading
    ? "Finding tasks around you..."
    : count === 0
      ? "Quiet around here — check back soon ☕"
      : `${count} ${count === 1 ? "task" : "tasks"} near you, ready to go`;

  return (
    <View style={styles.flex}>
      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>
          {greetingFor(new Date())}, {firstName} 👋
        </Text>
        <Text style={styles.greetingSubtitle}>{tagline}</Text>
      </View>
      <View style={styles.toolbar}>
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
        <Pressable
          style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
          onPress={toggleMode}
          accessibilityLabel={mode === "list" ? "Show map" : "Show list"}
        >
          <Ionicons name={mode === "list" ? "map-outline" : "list-outline"} size={20} color={colors.primaryDark} />
        </Pressable>
      </View>
      <CategoryFilterChips categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md },
  greeting: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  greetingTitle: { ...typography.h2, color: colors.text },
  greetingSubtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  modeButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  callout: { minWidth: 160, maxWidth: 220, padding: 4, gap: 2 },
  calloutTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  calloutMeta: { fontSize: 12, color: colors.textMuted },
  calloutLink: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
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
