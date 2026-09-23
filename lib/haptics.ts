import * as Haptics from "expo-haptics";

// Fire-and-forget: haptics are a nicety, so a device without a vibration motor (or a
// rejected promise) must never surface as an error in the UI.
function safely(run: () => Promise<void>) {
  run().catch(() => {});
}

export const haptics = {
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => safely(() => Haptics.selectionAsync()),
};
