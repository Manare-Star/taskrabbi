import { ScrollView, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../lib/theme";
import { categoryStyle } from "../lib/categories";
import { haptics } from "../lib/haptics";
import { Bouncy } from "./Bouncy";

interface CategoryFilterChipsProps {
  categories: readonly string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilterChips({ categories, selected, onSelect }: CategoryFilterChipsProps) {
  const pick = (category: string | null) => {
    haptics.select();
    onSelect(category);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      <Chip label="All" emoji="🌈" color={colors.primary} active={selected === null} onPress={() => pick(null)} />
      {categories.map((category) => {
        const style = categoryStyle(category);
        return (
          <Chip
            key={category}
            label={category}
            emoji={style.emoji}
            color={style.color}
            active={selected === category}
            onPress={() => pick(category)}
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  emoji,
  color,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Bouncy
      onPress={onPress}
      pressedScale={0.92}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 58 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.white },
});
