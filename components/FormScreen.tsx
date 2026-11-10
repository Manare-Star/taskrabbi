import type { ReactNode, RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useHeaderHeight } from "expo-router/react-navigation";
import { colors, spacing } from "../lib/theme";

interface FormScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  // For scrolling back to the top, e.g. to show a validation summary.
  scrollRef?: RefObject<ScrollView | null>;
}

// A scrolling screen with text fields: the keyboard never covers the focused field, taps on
// buttons work while the keyboard is up, and dragging the content dismisses the keyboard.
export function FormScreen({ children, contentContainerStyle, scrollRef }: FormScreenProps) {
  // On iOS the avoiding view must account for the navigation header above it.
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
});
