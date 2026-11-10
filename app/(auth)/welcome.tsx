import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/Button";
import { colors, radius, spacing, typography } from "../../lib/theme";

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: "create-outline", title: "Post what you need done", body: "Cleaning, moving, repairs, deliveries. It takes about a minute." },
  { icon: "people-outline", title: "Choose who does it", body: "Compare offers and reviews from people near you." },
  { icon: "shield-checkmark-outline", title: "Pay when it's done", body: "Secure payment in the app, only after the work is finished." },
];

// First screen for someone who isn't signed in: what the app is, and the two ways in.
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <BrandMark size={44} />

      <View style={styles.hero}>
        <Text style={styles.headline} accessibilityRole="header">
          Help is nearby.
        </Text>
        <Text style={styles.subhead}>Get everyday tasks done by people in your area, or earn by helping out.</Text>
      </View>

      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.title} style={styles.point}>
            <View style={styles.pointIcon}>
              <Ionicons name={point.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointBody}>{point.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push("/(auth)/signup")} />
        <Button title="Log in" variant="secondary" onPress={() => router.push("/(auth)/login")} />
        <Text style={styles.legal}>
          By continuing you agree to our{" "}
          <Link href="/legal/terms" style={styles.legalLink}>
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" style={styles.legalLink}>
            Privacy Policy
          </Link>
          .
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, backgroundColor: colors.background },
  hero: { marginTop: spacing.xxl, gap: spacing.sm },
  headline: { fontSize: 34, fontWeight: "600", letterSpacing: -0.8, color: colors.text },
  subhead: { ...typography.body, fontSize: 17, lineHeight: 25, color: colors.textMuted },
  points: { marginTop: spacing.xl, gap: spacing.lg },
  point: { flexDirection: "row", gap: spacing.md - 2 },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: { flex: 1, gap: 2 },
  pointTitle: { ...typography.bodyStrong, color: colors.text },
  pointBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  actions: { marginTop: "auto", paddingTop: spacing.xl, gap: spacing.sm + 2 },
  legal: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
  legalLink: { color: colors.primary, fontWeight: "500" },
});
