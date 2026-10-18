import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "./theme";
import { haptics } from "./haptics";

// Confirmation feedback after an action succeeds: a short toast plus a success haptic.
// Confetti is reserved for the one moment that earns it (a completed payment) and stays
// within the brand palette.
const CONFETTI_COLORS = [colors.primary, "#5DCAA5", "#9FE1CB", colors.ink, "#C9CDD2"];
const PIECE_COUNT = 28;
const TOAST_MS = 2200;
const CONFETTI_MS = 2400;

interface CelebrateOptions {
  confetti?: boolean;
}

interface CelebrationContextValue {
  celebrate: (message: string, options?: CelebrateOptions) => void;
}

const CelebrationContext = createContext<CelebrationContextValue>({ celebrate: () => {} });

export function CelebrationProvider({ children }: PropsWithChildren) {
  const [event, setEvent] = useState<{ id: number; message: string; confetti: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((message: string, options?: CelebrateOptions) => {
    haptics.success();
    if (timer.current) clearTimeout(timer.current);
    const confetti = options?.confetti ?? false;
    setEvent({ id: Date.now(), message, confetti });
    timer.current = setTimeout(() => setEvent(null), confetti ? CONFETTI_MS : TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {event && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {event.confetti && <Confetti key={`c${event.id}`} />}
          <Toast key={`t${event.id}`} message={event.message} durationMs={event.confetti ? CONFETTI_MS : TOAST_MS} />
        </View>
      )}
    </CelebrationContext.Provider>
  );
}

export function useCelebrate() {
  return useContext(CelebrationContext).celebrate;
}

function Toast({ message, durationMs }: { message: string; durationMs: number }) {
  const insets = useSafeAreaInsets();
  const shown = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(shown, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(durationMs - 180 - 220),
      Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [shown, durationMs]);

  return (
    <View style={[styles.toastWrap, { top: insets.top + spacing.sm }]}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: shown,
            transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color="#5DCAA5" />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    </View>
  );
}

function Confetti() {
  const { width, height } = Dimensions.get("window");
  const progress = useRef(new Animated.Value(0)).current;

  // Each piece gets its own start position, fall speed, sway and spin — fixed for the burst.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        key: index,
        startX: Math.random() * width,
        drift: (Math.random() - 0.5) * 100,
        delay: Math.random() * 0.2,
        speed: 0.75 + Math.random() * 0.25,
        spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
        size: 6 + Math.random() * 5,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [width]
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: CONFETTI_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <>
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
                height: piece.size * 0.45,
                backgroundColor: piece.color,
                opacity: local.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [-20, height * 0.75] }) },
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
    </>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", top: 0, borderRadius: 1 },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    maxWidth: "90%",
    ...shadow.raised,
  },
  toastText: { color: colors.white, fontSize: 14, fontWeight: "500" },
});
