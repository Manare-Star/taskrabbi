import type { NearbyTask } from "../lib/types";
import { EmptyState } from "./EmptyState";

interface TaskMapProps {
  center: { lat: number; lng: number };
  tasks: NearbyTask[];
  onOpenTask: (taskId: string) => void;
}

// The browser build is a development preview and has no native map.
export function TaskMap(_props: TaskMapProps) {
  return <EmptyState icon="map-outline" title="The map is available in the mobile app" subtitle="Switch back to the list to see tasks near you." />;
}
