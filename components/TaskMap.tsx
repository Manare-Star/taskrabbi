import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Circle, Marker } from "react-native-maps";
import { colors, typography } from "../lib/theme";
import { formatMoney } from "../lib/format";
import type { NearbyTask } from "../lib/types";

interface TaskMapProps {
  center: { lat: number; lng: number };
  tasks: NearbyTask[];
  onOpenTask: (taskId: string) => void;
}

// Radius of the shaded circle drawn around each pin, in metres. A task's position is only
// approximate (see nearby_open_tasks), and the circle says so without words.
const APPROXIMATE_RADIUS = 400;

// The Browse map. (TaskMap.web.tsx replaces this in the browser, where react-native-maps
// doesn't run.)
export function TaskMap({ center, tasks, onOpenTask }: TaskMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
      showsUserLocation
      showsMyLocationButton
      toolbarEnabled={false}
    >
      {tasks.map((task) => {
        const coordinate = { latitude: task.task_lat, longitude: task.task_lng };
        return (
          <Fragment key={task.id}>
            <Circle
              center={coordinate}
              radius={APPROXIMATE_RADIUS}
              strokeColor="rgba(15, 110, 86, 0.35)"
              fillColor="rgba(15, 110, 86, 0.10)"
            />
            <Marker coordinate={coordinate} pinColor={colors.primary} accessibilityLabel={`${task.title}, ${formatMoney(task.budget)}`}>
              <Callout onPress={() => onOpenTask(task.id)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.calloutMeta}>
                    {formatMoney(task.budget)} · {task.area_text}
                  </Text>
                  <Text style={styles.calloutLink}>View task</Text>
                </View>
              </Callout>
            </Marker>
          </Fragment>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  callout: { minWidth: 160, maxWidth: 220, padding: 4, gap: 2 },
  calloutTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  calloutMeta: { fontSize: 12, color: colors.textMuted },
  calloutLink: { fontSize: 12, color: colors.primary, fontWeight: "500", marginTop: 2 },
});
