import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Button } from "@/shared/ui/Button";
import {
  CONFLICT_STYLE_RESULT_DESCRIPTIONS,
  useConflictStyleResultsPayload,
} from "@/screens/assessments/useConflictStyleResultsPayload";
import { styleDisplayName } from "@/data/assessments/conflictStyleResultsNarrative";
import { AssessmentPreparingResults } from "@/shared/components/assessments/AssessmentPreparingResults";
import { theme } from "@/shared/theme/theme";
import { PAGE_CONTENT_MAX_WIDTH } from "@utilities/pageContentWidth";

export type ConflictStyleResultsFooter =
  | { kind: "none" }
  | { kind: "onboarding"; onContinue: () => void }
  | { kind: "stack"; label: string; onPress: () => void };

type Props = {
  userId: string;
  footer: ConflictStyleResultsFooter;
  /** Edit profile: grow with the page scroll instead of scrolling inside the panel. */
  embedded?: boolean;
};

/**
 * Same conflict-style results body as {@link ConflictStyleResultsScreen}, for embedding or stack.
 */
export function ConflictStyleResultsPanel({ userId, footer, embedded = false }: Props) {
  const {
    loading,
    dominant,
    percents,
    counts,
    ranked,
    dominantLabel,
    leadText,
    narrative,
  } = useConflictStyleResultsPayload(userId);

  if (loading) {
    return (
      <AssessmentPreparingResults subtitle="Calculating your conflict style mix from your answers." />
    );
  }

  if (!dominant || !percents || !counts) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.body}>
          {footer.kind === "none"
            ? "No conflict style results saved for this profile yet."
            : "No conflict style results found."}
        </Text>
        {footer.kind === "stack" ? (
          <Button title={footer.label} onPress={footer.onPress} variant="solid" />
        ) : null}
      </View>
    );
  }

  const body = (
    <>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Conflict style</Text>
          <Text style={styles.dominantTitle}>{dominantLabel}</Text>
          <Text style={styles.lead}>{leadText}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your profile</Text>
          {ranked.map(({ k, p }) => (
            <View key={k} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowLabel}>{styleDisplayName(k)}</Text>
                <Text style={styles.rowPct}>{p.toFixed(1)}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(100, p)}%` }]} />
              </View>
              <Text style={styles.rowDesc}>
                {CONFLICT_STYLE_RESULT_DESCRIPTIONS[k].short}{" "}
                {CONFLICT_STYLE_RESULT_DESCRIPTIONS[k].long}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What this means in a relationship</Text>
          {narrative?.paragraphs.map((para, i) => (
            <Text key={i} style={styles.body}>
              {para}
            </Text>
          ))}
          {narrative?.demandWithdrawNote ? (
            <Text style={[styles.body, styles.bodySpaced]}>
              {narrative.demandWithdrawNote}
            </Text>
          ) : null}
        </View>

        {footer.kind === "onboarding" ? (
          <Button
            title="Continue →"
            onPress={footer.onContinue}
            variant="solid"
            style={{ marginTop: 24 }}
          />
        ) : null}
        {footer.kind === "stack" ? (
          <Button
            title={footer.label}
            onPress={footer.onPress}
            variant="solid"
            style={{ marginTop: 24 }}
          />
        ) : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embedded}>{body}</View>;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Must fill the screen so `ScrollView` gets a bounded height and can scroll. */
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  embedded: {
    width: "100%",
    overflow: "visible",
    backgroundColor: theme.colors.background,
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  emptyWrap: {
    padding: 24,
    gap: 16,
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
    width: "100%",
    maxWidth: PAGE_CONTENT_MAX_WIDTH,
    alignSelf: "center",
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(91,168,232,0.28)",
    backgroundColor: "rgba(91,168,232,0.08)",
    padding: 22,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CB4D8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dominantTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 12,
    lineHeight: 34,
  },
  lead: { fontSize: 16, lineHeight: 25, color: theme.colors.text },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(82,142,220,0.18)",
    backgroundColor: "rgba(5,6,13,0.36)",
    padding: 14,
  },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  rowPct: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
  barTrack: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
  },
  rowDesc: { fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  bodySpaced: { marginTop: 2 },
});
