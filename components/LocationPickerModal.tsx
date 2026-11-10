import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_TOUCH, colors, radius, shadow, spacing, typography } from "../lib/theme";
import { Button } from "./Button";

export interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  visible: boolean;
  // Where the map opens: the current choice, else the device's position, else Johannesburg.
  initial: Coordinates | null;
  onClose: () => void;
  onConfirm: (coordinates: Coordinates) => void;
}

const FALLBACK: Coordinates = { lat: -26.2041, lng: 28.0473 };
const ZOOM = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

// Choose a place by moving the map under a fixed pin. Used when posting a task for
// somewhere other than where you're standing. (LocationPickerModal.web.tsx replaces this
// in the browser.)
export function LocationPickerModal({ visible, initial, onClose, onConfirm }: LocationPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Mounted afresh each time it opens, so it always starts from the current choice. */}
      {visible && <Picker initial={initial} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  );
}

function Picker({ initial, onClose, onConfirm }: Omit<LocationPickerModalProps, "visible">) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<Coordinates>(initial ?? FALLBACK);
  // With nothing chosen yet, the picker opens by finding the device.
  const [locating, setLocating] = useState(!initial);

  const findMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      const here = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCenter(here);
      mapRef.current?.animateToRegion({ latitude: here.lat, longitude: here.lng, ...ZOOM }, 350);
    } catch {
      // Stay where the map is; the user can still pan to the place.
    } finally {
      setLocating(false);
    }
  }, []);

  const start = initial ?? FALLBACK;

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={styles.flex}
        initialRegion={{ latitude: start.lat, longitude: start.lng, ...ZOOM }}
        onMapReady={() => {
          if (!initial) void findMe();
        }}
        onRegionChangeComplete={(region: Region) => setCenter({ lat: region.latitude, lng: region.longitude })}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      />

      {/* The pin stays put while the map moves beneath it; its tip marks the spot. */}
      <View pointerEvents="none" style={styles.pinLayer}>
        <Ionicons name="location" size={44} color={colors.primary} style={styles.pin} />
      </View>

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable onPress={onClose} style={styles.roundButton} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.instruction}>
          <Text style={styles.instructionText}>Move the map to place the pin</Text>
        </View>
        <Pressable
          onPress={() => {
            setLocating(true);
            void findMe();
          }}
          style={styles.roundButton}
          accessibilityRole="button"
          accessibilityLabel="Go to my current location"
        >
          {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate-outline" size={22} color={colors.text} />}
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Use this location" onPress={() => onConfirm(center)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pinLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  // Lift the icon by half its height so the tip, not the middle, sits on the map's centre.
  pin: { marginBottom: 44 },
  topBar: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  roundButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  instruction: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    ...shadow.raised,
  },
  instructionText: { ...typography.label, color: colors.text },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
});
