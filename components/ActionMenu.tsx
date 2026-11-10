import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_TOUCH, colors, radius, spacing, typography } from "../lib/theme";

export interface ActionMenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionMenuProps {
  visible: boolean;
  title?: string;
  items: ActionMenuItem[];
  onClose: () => void;
}

// A bottom sheet of actions, opened from a "more" button. Looks the same on both platforms
// (the system action sheets don't), and closes on backdrop tap or the Android back button.
export function ActionMenu({ visible, title, items, onClose }: ActionMenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        {title ? (
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <Ionicons name={item.icon} size={20} color={item.destructive ? colors.danger : colors.textMuted} />
            <Text style={[styles.itemLabel, item.destructive && styles.itemLabelDestructive]}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.item, styles.cancel, pressed && styles.itemPressed]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22, 24, 26, 0.45)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  title: { ...typography.label, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  itemPressed: { backgroundColor: colors.surface },
  itemLabel: { ...typography.body, fontSize: 16, color: colors.text },
  itemLabelDestructive: { color: colors.danger },
  cancel: { justifyContent: "center", marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, borderRadius: 0 },
  cancelLabel: { ...typography.bodyStrong, fontSize: 16, color: colors.text },
});
