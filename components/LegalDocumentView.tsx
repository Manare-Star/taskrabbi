import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import type { LegalDocument } from "../lib/legal";

// Renders the Terms or the Privacy Policy as plain, comfortable-to-read text.
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {document.title}
      </Text>
      <Text style={styles.updated}>Last updated {document.updated}</Text>
      <Text style={styles.paragraph}>{document.intro}</Text>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.body.map((text, index) =>
            text.startsWith("• ") ? (
              <View key={index} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.paragraph, styles.bulletText]}>{text.slice(2)}</Text>
              </View>
            ) : (
              <Text key={index} style={styles.paragraph}>
                {text}
              </Text>
            )
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text },
  updated: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  heading: { ...typography.h3, color: colors.text },
  paragraph: { ...typography.body, color: colors.text, lineHeight: 23 },
  bulletRow: { flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.xs },
  bullet: { ...typography.body, color: colors.textMuted, lineHeight: 23 },
  bulletText: { flex: 1 },
});
