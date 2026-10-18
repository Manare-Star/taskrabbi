import { ScrollView, StyleSheet, Text } from "react-native";
import { colors, spacing } from "../lib/theme";
import { haptics } from "../lib/haptics";
import { Bouncy } from "./Bouncy";

interface CategoryFilterChipsProps {
  categories: readonly string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  // The "All" chip clears the filter; leave it out when a category must be chosen.
  showAll?: boolean;
}

export function CategoryFilterChips({ categories, selected, onSelect, showAll = true }: CategoryFilterChipsProps) {
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
      {showAll && <Chip label="All" active={selected === null} onPress={() => pick(null)} />}
      {categories.map((category) => (
        <Chip key={category} label={category} active={selected === category} onPress={() => pick(category)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Bouncy
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 52 },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "500" },
  chipTextActive: { color: colors.white },
});
