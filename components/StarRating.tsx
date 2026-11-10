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
    <View
      style={styles.row}
      accessible
      accessibilityLabel={count > 0 ? `Rated ${Number(rating).toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}` : "No reviews yet"}
    >
      <Ionicons name={count > 0 ? "star" : "star-outline"} size={size} color={count > 0 ? colors.accent : colors.textFaint} />
      <Text style={styles.text}>{count > 0 ? `${Number(rating).toFixed(1)} (${count})` : "New"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontSize: 13, color: colors.textMuted },
});
