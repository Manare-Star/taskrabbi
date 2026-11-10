import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

export type DeviceLocation =
  | { status: "ready"; lat: number; lng: number; placeName: string | null }
  | { status: "denied"; canAskAgain: boolean };

async function readDeviceLocation(): Promise<DeviceLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    return { status: "denied", canAskAgain: permission.canAskAgain };
  }

  // A recent fix is plenty for "what's near me" and returns at once; fall back to a fresh
  // one only when the phone has none.
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

  // Suburb or town, from the phone's own reverse geocoder. Nice to have, never required.
  let placeName: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync(position.coords);
    placeName = place?.district || place?.subregion || place?.city || null;
  } catch {
    // Leave it out.
  }

  return { status: "ready", lat: position.coords.latitude, lng: position.coords.longitude, placeName };
}

// Where the device is, asked for once and shared by every screen that needs it. `refetch`
// asks again (after the user changes the permission, or to retry a failure).
export function useDeviceLocation() {
  return useQuery({
    queryKey: ["device-location"],
    queryFn: readDeviceLocation,
    staleTime: 5 * 60_000,
    retry: false,
    // Coming back from the Settings app may have changed the permission.
    refetchOnWindowFocus: (query) => query.state.data?.status === "denied",
  });
}
