import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

interface StarRatingProps {
  rating: number;
  count: number;
  size?: number;
}

export function StarRating({ rating, count, size = 14 }: StarRatingProps) {
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.accent} />
      <Text style={styles.text}>
        {rating > 0 ? rating.toFixed(1) : "New"} {count > 0 ? `(${count})` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontSize: 12, color: colors.textMuted },
});
