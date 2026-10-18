import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";
import { haptics } from "../lib/haptics";
import { SLOTS, dayLabel, isSameDay, upcomingDays, FLEXIBLE, type ScheduleValue } from "../lib/schedule";
import { Bouncy } from "./Bouncy";

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const days = useMemo(() => upcomingDays(), []);

  const pick = (next: ScheduleValue) => {
    haptics.select();
    onChange(next);
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="Flexible" active={value.day === null} onPress={() => pick(FLEXIBLE)} />
        {days.map((day) => (
          <Chip
            key={day.toDateString()}
            label={dayLabel(day)}
            active={value.day !== null && isSameDay(value.day, day)}
            // Keep the chosen part of day when switching days.
            onPress={() => pick({ day, slot: value.day === null ? "morning" : value.slot })}
          />
        ))}
      </ScrollView>

      {value.day !== null && (
        <View style={[styles.row, styles.slotRow]}>
          {SLOTS.map((slot) => (
            <Chip
              key={slot.key}
              label={slot.label}
              sublabel={slot.hours}
              active={value.slot === slot.key}
              onPress={() => pick({ day: value.day, slot: slot.key })}
              grow
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  sublabel,
  active,
  onPress,
  grow,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onPress: () => void;
  grow?: boolean;
}) {
  return (
    <Bouncy
      onPress={onPress}
      containerStyle={grow ? styles.chipGrow : undefined}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {sublabel ? <Text style={[styles.sublabel, active && styles.sublabelActive]}>{sublabel}</Text> : null}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.sm },
  slotRow: { marginTop: spacing.xs },
  chip: {
    alignItems: "center",
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  chipGrow: { flex: 1 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "500" },
  sublabel: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  chipTextActive: { color: colors.white },
  sublabelActive: { color: "#C9CDD2" },
});
