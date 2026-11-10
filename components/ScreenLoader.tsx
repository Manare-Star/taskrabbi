import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

// A whole screen waiting for its first data.
export function ScreenLoader() {
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
