import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing } from "./theme";
import { haptics } from "./haptics";

const CONFETTI_COLORS = ["#2E7D32", "#F5A623", "#8E5BD9", "#1E9BD7", "#D64545", "#C2559A", "#3A9B48", "#FFD23F"];
const PIECE_COUNT = 48;
const BURST_MS = 2800;

interface CelebrationContextValue {
  celebrate: (message?: string) => void;
}

const CelebrationContext = createContext<CelebrationContextValue>({ celebrate: () => {} });

export function CelebrationProvider({ children }: PropsWithChildren) {
  const [burst, setBurst] = useState<{ id: number; message?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((message?: string) => {
    haptics.success();
    if (timer.current) clearTimeout(timer.current);
    setBurst({ id: Date.now(), message });
    timer.current = setTimeout(() => setBurst(null), BURST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {burst && <ConfettiBurst key={burst.id} message={burst.message} />}
    </CelebrationContext.Provider>
  );
}

export function useCelebrate() {
  return useContext(CelebrationContext).celebrate;
}

function ConfettiBurst({ message }: { message?: string }) {
  const { width, height } = Dimensions.get("window");
  const progress = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;

  // Each piece gets its own start position, fall speed, sway, spin and shape — fixed for the burst.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        key: index,
        startX: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        delay: Math.random() * 0.25,
        speed: 0.75 + Math.random() * 0.25,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        size: 7 + Math.random() * 7,
        round: Math.random() > 0.6,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [width]
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: BURST_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.spring(badge, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
      Animated.delay(1300),
      Animated.timing(badge, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [progress, badge]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => {
        // Map overall progress into this piece's own window so pieces start staggered.
        const local = progress.interpolate({
          inputRange: [piece.delay, Math.min(1, piece.delay + piece.speed)],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={piece.key}
            style={[
              styles.piece,
              {
                left: piece.startX,
                width: piece.size,
                height: piece.round ? piece.size : piece.size * 0.45,
                borderRadius: piece.round ? piece.size / 2 : 2,
                backgroundColor: piece.color,
                opacity: local.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 30] }) },
                  {
                    translateX: local.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, piece.drift, piece.drift * 0.4],
                    }),
                  },
                  { rotate: local.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${piece.spin}deg`] }) },
                ],
              },
            ]}
          />
        );
      })}
      {message ? (
        <View style={styles.badgeWrap}>
          <Animated.View
            style={[
              styles.badge,
              {
                opacity: badge,
                transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              },
            ]}
          >
            <Text style={styles.badgeText}>{message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", top: 0 },
  badgeWrap: { position: "absolute", top: "38%", left: 0, right: 0, alignItems: "center" },
  badge: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    ...shadow.raised,
  },
  badgeText: { fontSize: 20, fontWeight: "800", color: colors.text },
});
