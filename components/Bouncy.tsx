import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

interface BouncyProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  // Layout for the outer touch target, e.g. { flex: 1 } so it can share a row.
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  // How far it presses in; cards press in less than buttons.
  pressedScale?: number;
}

// A Pressable that presses in slightly on touch and eases back on release: tactile, without
// the springy overshoot.
export function Bouncy({
  style,
  containerStyle,
  children,
  pressedScale = 0.98,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: BouncyProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const easeTo = (toValue: number) =>
    Animated.timing(scale, { toValue, duration: toValue === 1 ? 140 : 90, useNativeDriver: true }).start();

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPressIn={(e) => {
        easeTo(pressedScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        easeTo(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
