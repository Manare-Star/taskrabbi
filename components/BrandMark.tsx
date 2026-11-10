import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";
import { APP_NAME } from "../lib/config";

interface BrandMarkProps {
  // Side of the icon square, in points.
  size?: number;
  // Show the name next to the icon.
  wordmark?: boolean;
}

// The app's logo: the same artwork as the launcher icon, so the brand is one thing everywhere.
export function BrandMark({ size = 40, wordmark = true }: BrandMarkProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={APP_NAME}>
      <Image
        source={require("../assets/icon.png")}
        style={{ width: size, height: size, borderRadius: size * 0.24 }}
        accessibilityIgnoresInvertColors
      />
      {wordmark && <Text style={[styles.wordmark, { fontSize: size * 0.7 }]}>{APP_NAME.toLowerCase()}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { fontWeight: "600", color: colors.text, letterSpacing: -0.8 },
});
