import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

interface BouncyProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  // How far it squishes on press; cards squish less than buttons.
  pressedScale?: number;
}

// A Pressable that springs down on touch and bounces back on release.
export function Bouncy({ style, children, pressedScale = 0.96, onPressIn, onPressOut, disabled, ...rest }: BouncyProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 12 : 0 }).start();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        springTo(pressedScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        springTo(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
