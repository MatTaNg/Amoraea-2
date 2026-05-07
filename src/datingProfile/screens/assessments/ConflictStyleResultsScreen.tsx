import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { getConflictStyleScores } from "@/data/services/conflictStyleService";
import {
  countsToPercentages,
  hasDominantTie,
  tiedForDominant,
} from "@/data/assessments/instruments/conflictStyleScoring";
import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import { CONFLICT_STYLE_KEYS } from "@/data/assessments/instruments/conflictStyleTypes";
import { buildRelationshipInterpretation, styleDisplayName } from "@/data/assessments/conflictStyleResultsNarrative";
import type { ConflictStyleCounts } from "@/data/assessments/instruments/conflictStyleScoring";
import { theme } from "@/shared/theme/theme";

const STYLE_DESC: Record<
  ConflictStyleKey,
  { short: string; long: string }
> = {
  competing: {
    short: "You tend to pursue your goals firmly in conflict, even at short-term relational cost.",
    long: "You value directness and are comfortable with disagreement.",
  },
  collaborating: {
    short:
      "You seek solutions that fully satisfy both parties and lean into conflict as an opportunity for mutual understanding.",
    long: "You invest time and depth in working things through.",
  },
  compromising: {
    short: "You look for middle ground and are willing to give something up to move forward.",
    long: "You value fairness and practical resolution.",
  },
  avoiding: {
    short: "You tend to sidestep or delay engaging with conflict.",
    long: "You may prefer to let issues resolve naturally or wait for a better moment.",
  },
  accommodating: {
    short: "You prioritize the relationship and the other person's needs over your own position in conflict.",
    long: "You are willing to concede to keep things peaceful.",
  },
};

const WHAT_WE_USE = `Your conflict style profile helps us find someone whose approach to disagreement complements yours. We look at the full profile — not just your dominant style — to identify combinations that research suggests work well together.`;

export function ConflictStyleResultsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route = useRoute<RouteProp<DatingProfileStackParamList, "DatingConflictResults">>();
  const { user } = useAuth();
  const fromFlow = route.params?.from === "edit" ? "edit" : "onboarding";

  const [loading, setLoading] = useState(true);
  const [dominant, setDominant] = useState<ConflictStyleKey | null>(null);
  const [counts, setCounts] = useState<ConflictStyleCounts | null>(null);
  const [percents, setPercents] = useState<Record<ConflictStyleKey, number> | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const res = await getConflictStyleScores(user.id);
      if (c) return;
      if (res.success && res.data) {
        setDominant(res.data.dominant);
        setCounts(res.data.counts);
        setPercents(countsToPercentages(res.data.counts));
      }
      setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [user?.id]);

  const narrative = counts ? buildRelationshipInterpretation(counts) : null;
  const dominantLabel =
    counts && hasDominantTie(counts)
      ? tiedForDominant(counts).map((k) => styleDisplayName(k)).join(" · ")
      : dominant
        ? styleDisplayName(dominant)
        : "";
  const leadText =
    counts && dominant
      ? hasDominantTie(counts)
        ? tiedForDominant(counts)
            .map((k) => `${STYLE_DESC[k].short} ${STYLE_DESC[k].long}`)
            .join(" ")
        : `${STYLE_DESC[dominant].short} ${STYLE_DESC[dominant].long}`
      : "";

  if (loading) {
    return (
      <View style={[styles.centered, { flex: 1 }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!dominant || !percents || !counts) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.body}>No conflict style results found.</Text>
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const ranked = [...CONFLICT_STYLE_KEYS]
    .map((k) => ({ k, p: percents[k] }))
    .sort((a, b) => b.p - a.p);

  const handleContinue = () => {
    if (fromFlow === "onboarding") {
      navigation.replace("DatingInsight", { instrument: "CONFLICT-30" });
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Conflict style</Text>
        <Text style={styles.dominantTitle}>{dominantLabel}</Text>
        <Text style={styles.lead}>{leadText}</Text>

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
              {STYLE_DESC[k].short} {STYLE_DESC[k].long}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>What this means in a relationship</Text>
        {narrative?.paragraphs.map((p, i) => (
          <Text key={i} style={styles.body}>
            {p}
          </Text>
        ))}
        {narrative?.demandWithdrawNote ? (
          <Text style={[styles.body, { marginTop: 12 }]}>{narrative.demandWithdrawNote}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>What we use this for</Text>
        <Text style={styles.body}>{WHAT_WE_USE}</Text>

        <Button
          title={fromFlow === "onboarding" ? "Continue →" : "Done"}
          onPress={handleContinue}
          variant="primary"
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  scroll: { padding: 24, paddingBottom: 48 },
  eyebrow: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  dominantTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 12,
  },
  lead: { fontSize: 16, lineHeight: 24, color: theme.colors.text, marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  row: { marginBottom: 18 },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  rowPct: { fontSize: 15, color: theme.colors.textSecondary },
  barTrack: {
    height: 10,
    backgroundColor: theme.colors.border,
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
});
