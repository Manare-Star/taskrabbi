import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

// Placeholder shaped like a TaskCard row while the list loads.
export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <View style={styles.icon} />
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock} />
          <View style={styles.priceBlock} />
        </View>
        <View style={styles.metaBlock} />
      </View>
    </Animated.View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  text: { flex: 1, gap: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between" },
  titleBlock: { height: 14, width: "55%", borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  priceBlock: { height: 14, width: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  metaBlock: { height: 11, width: "70%", borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
});
