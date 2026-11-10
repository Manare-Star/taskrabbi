import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "./theme";
import { haptics } from "./haptics";

// Brief feedback after an action: a toast at the top of the screen with a matching haptic.
// Success toasts confirm ("Bid sent"); error toasts report a failure that needs no decision
// from the user. Confetti is reserved for the one moment that earns it, a completed payment,
// and stays within the brand palette.

type ToastKind = "success" | "error" | "info";

interface ToastApi {
  success: (message: string, options?: { confetti?: boolean }) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ICONS: Record<ToastKind, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: "checkmark-circle", color: "#5DCAA5" },
  error: { name: "alert-circle", color: "#F4A29B" },
  info: { name: "information-circle", color: "#C9CDD2" },
};

const CONFETTI_COLORS = [colors.primary, "#5DCAA5", "#9FE1CB", colors.ink, "#C9CDD2"];
const PIECE_COUNT = 28;
const CONFETTI_MS = 2400;

// Long enough to read: a base time plus more for longer messages.
function durationFor(message: string, kind: ToastKind): number {
  const base = kind === "error" ? 3200 : 2200;
  return Math.min(6000, base + Math.max(0, message.length - 30) * 40);
}

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ id: number; kind: ToastKind; message: string; confetti: boolean; duration: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, message: string, confetti = false) => {
    if (kind === "success") haptics.success();
    if (kind === "error") haptics.error();
    AccessibilityInfo.announceForAccessibility(message);

    if (timer.current) clearTimeout(timer.current);
    const duration = Math.max(durationFor(message, kind), confetti ? CONFETTI_MS : 0);
    setToast({ id: Date.now(), kind, message, confetti, duration });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => show("success", message, options?.confetti ?? false),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {toast.confetti && <Confetti key={`confetti-${toast.id}`} />}
          <ToastView key={`toast-${toast.id}`} kind={toast.kind} message={toast.message} duration={toast.duration} />
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastView({ kind, message, duration }: { kind: ToastKind; message: string; duration: number }) {
  const insets = useSafeAreaInsets();
  const [shown] = useState(() => new Animated.Value(0));
  const icon = ICONS[kind];

  useEffect(() => {
    Animated.sequence([
      Animated.timing(shown, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(Math.max(0, duration - 180 - 220)),
      Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [shown, duration]);

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
        <Ionicons name={icon.name} size={18} color={icon.color} />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    </View>
  );
}

// Each piece gets its own start position, fall speed, sway and spin, fixed for the burst.
function makeConfetti(width: number) {
  return Array.from({ length: PIECE_COUNT }, (_, index) => ({
    key: index,
    startX: Math.random() * width,
    drift: (Math.random() - 0.5) * 100,
    delay: Math.random() * 0.2,
    speed: 0.75 + Math.random() * 0.25,
    spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
    size: 6 + Math.random() * 5,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  }));
}

function Confetti() {
  const { width, height } = Dimensions.get("window");
  const [progress] = useState(() => new Animated.Value(0));
  const [pieces] = useState(() => makeConfetti(width));

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
  toastWrap: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    maxWidth: "100%",
    ...shadow.raised,
  },
  toastText: { color: colors.white, fontSize: 14, fontWeight: "500", flexShrink: 1 },
});
