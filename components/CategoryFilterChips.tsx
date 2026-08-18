import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radius, shadow, spacing } from "../lib/theme";

interface CategoryFilterChipsProps {
  categories: readonly string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilterChips({ categories, selected, onSelect }: CategoryFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      <Chip label="All" active={selected === null} onPress={() => onSelect(null)} />
      {categories.map((category) => (
        <Chip key={category} label={category} active={selected === category} onPress={() => onSelect(category)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 56 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.button },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.white },
});
