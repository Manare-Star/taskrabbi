import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../lib/theme";
import { haptics } from "../lib/haptics";

interface StarRatingInputProps {
  value: number;
  onChange?: (stars: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarRatingInput({ value, onChange, size = 32, disabled = false }: StarRatingInputProps) {
  return (
    <View
      style={styles.row}
      accessible={disabled}
      accessibilityLabel={disabled ? `${value} out of 5 stars` : undefined}
      accessibilityRole={disabled ? "image" : "radiogroup"}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={disabled || !onChange}
          onPress={() => {
            haptics.select();
            onChange?.(star);
          }}
          hitSlop={8}
          accessibilityRole="radio"
          accessibilityLabel={`${star} ${star === 1 ? "star" : "stars"}`}
          accessibilityState={{ selected: star === value }}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? colors.accent : colors.borderStrong}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.xs },
});
