import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { onlineManager } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../lib/theme";

// Tell React Query when the device goes offline and comes back: it pauses requests while
// offline and refetches what's on screen on reconnect, instead of failing and retrying.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // isInternetReachable is null while still being determined; don't call that offline.
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  })
);

// A strip at the bottom of the screen while there's no connection.
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setOnline), []);

  if (online) return null;

  return (
    <View
      style={[styles.banner, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={styles.text}>No internet connection. Showing what was last loaded.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.ink,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { color: colors.white, fontSize: 13, fontWeight: "500", flexShrink: 1 },
});
