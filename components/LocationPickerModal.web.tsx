import { Modal, StyleSheet, View } from "react-native";
import { colors, spacing } from "../lib/theme";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  visible: boolean;
  initial: Coordinates | null;
  onClose: () => void;
  onConfirm: (coordinates: Coordinates) => void;
}

// The browser build is a development preview and has no native map to pick from.
export function LocationPickerModal({ visible, onClose }: LocationPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <EmptyState icon="map-outline" title="Pick on the map in the mobile app" subtitle="Here, use your current location instead." />
        <Button title="Close" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
});
