import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius, shadow, spacing } from "../lib/theme";

export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.image} />
      <View style={styles.headerRow}>
        <View style={styles.titleBlock} />
        <View style={styles.budgetBlock} />
      </View>
      <View style={styles.lineBlock} />
      <View style={[styles.lineBlock, { width: "60%" }]} />
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  image: { width: "100%", height: 100, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  titleBlock: { height: 16, width: "55%", borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  budgetBlock: { height: 16, width: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  lineBlock: { height: 12, width: "90%", borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginTop: spacing.sm },
});
