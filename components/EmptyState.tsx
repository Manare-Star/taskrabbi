import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../lib/theme";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  // A big gently-bobbing emoji; takes the place of the icon when given.
  emoji?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = "sparkles-outline", emoji, title, subtitle }: EmptyStateProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!emoji) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, emoji]);

  return (
    <View style={styles.container}>
      {emoji ? (
        <Animated.Text
          style={[styles.emoji, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}
        >
          {emoji}
        </Animated.Text>
      ) : (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={28} color={colors.primary} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xs },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});
