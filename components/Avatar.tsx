import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({ name, url, size = 40 }: AvatarProps) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={[styles.image, dimensions]} />;
  }

  return (
    <View style={[styles.fallback, dimensions]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  initials: { color: colors.primaryDark, fontWeight: "600" },
});
