import { StyleSheet, Text, View } from "react-native";
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

  return (
    <Bouncy
      onPress={() => router.push("/activity")}
      pressedScale={0.9}
      hitSlop={10}
      accessibilityLabel={count ? `Activity, ${count} new` : "Activity"}
      containerStyle={styles.container}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
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
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: "700" },
});
