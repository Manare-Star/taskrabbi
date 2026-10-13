import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { unreadCount, useNotifications } from "../lib/queries/notifications";
import { colors } from "../lib/theme";
import { Bouncy } from "./Bouncy";

export function ActivityBell() {
  const { profile } = useAuth();
  const { data } = useNotifications(profile?.id);
  const count = unreadCount(data);

  // Wiggle when the unread count goes up (something new just arrived), not on first load.
  const wiggle = useRef(new Animated.Value(0)).current;
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (previous.current !== null && count > previous.current) {
      wiggle.setValue(0);
      Animated.sequence(
        [1, -1, 0.7, -0.7, 0.3, 0].map((toValue) =>
          Animated.timing(wiggle, { toValue, duration: 70, useNativeDriver: true })
        )
      ).start();
    }
    previous.current = count;
  }, [count, wiggle]);

  return (
    <Bouncy
      onPress={() => router.push("/activity")}
      pressedScale={0.85}
      hitSlop={10}
      accessibilityLabel={count ? `Activity, ${count} new` : "Activity"}
      containerStyle={styles.container}
    >
      <Animated.View
        style={{
          transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }],
        }}
      >
        <Ionicons name={count ? "notifications" : "notifications-outline"} size={24} color={colors.text} />
      </Animated.View>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  container: { marginRight: 16 },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
});
