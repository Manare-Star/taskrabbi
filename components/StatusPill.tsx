import { StyleSheet, Text, View } from "react-native";
import { radius, statusColors } from "../lib/theme";

// What each stored status is called in the UI. Tasks and bids share the vocabulary.
const LABELS: Record<string, string> = {
  open: "Open",
  assigned: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = statusColors[status] ?? statusColors.completed;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label ?? statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  text: { fontSize: 11, fontWeight: "600" },
});
