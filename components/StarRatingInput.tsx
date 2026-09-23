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
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={disabled || !onChange}
          onPress={() => {
            haptics.select();
            onChange?.(star);
          }}
          hitSlop={8}
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
