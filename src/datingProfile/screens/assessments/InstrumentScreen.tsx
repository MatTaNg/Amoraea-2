import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { AssessmentHeader } from "@/shared/components/assessments/AssessmentHeader";
import { LikertScale } from "@/shared/components/assessments/LikertScale";
import { getInstrumentConfig } from "@/data/assessments/instruments";
import type { ECRItem } from "@/data/assessments/instruments/ecrItems";
import { getShuffledItems } from "@/data/assessments/instruments/ecrItems";
import {
  saveAssessmentResult,
  saveAssessmentProgress,
  getCompletedAssessments,
  getFirstIncompleteAssessment,
  ASSESSMENT_IDS,
  type AssessmentId,
} from "@/data/services/assessmentService";
import { computeRelationshipTraitsQualityFlags } from "@/data/assessments/instruments/relationshipTraits8";
import { useProfile } from "@/shared/hooks/useProfile";
import { theme } from "@/shared/theme/theme";

const SAVE_PROGRESS_EVERY = 5;
const ATTACHMENT_STYLE_LABELS = new Set([
  "Secure",
  "Anxious",
  "Avoidant",
  "Fearful Avoidant / Disorganized",
]);

function renderIntroDescription(description: string, instrumentId: AssessmentId) {
  if (instrumentId !== "ECR-36") {
    return description;
  }

  const lines = description.split("\n");
  return lines.map((line, index) => (
    <React.Fragment key={`${line}-${index}`}>
      {ATTACHMENT_STYLE_LABELS.has(line.trim()) ? (
        <Text style={styles.introTypeLabel}>{line}</Text>
      ) : (
        line
      )}
      {index < lines.length - 1 ? "\n" : ""}
    </React.Fragment>
  ));
}

export function InstrumentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route = useRoute<RouteProp<DatingProfileStackParamList, "DatingInstrument">>();
  const { user } = useAuth();
  const { profile, refreshProfile, loading: profileLoading } = useProfile();
  const rawInstrument = route.params?.instrument;
  const instrumentId = (
    Array.isArray(rawInstrument) ? rawInstrument[0] : rawInstrument || "ECR-36"
  ) as AssessmentId;
  const config = getInstrumentConfig(instrumentId);

  const sessionSeed = useMemo(
    () => (user?.id || "anon").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    [user?.id]
  );

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [showIntro, setShowIntro] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [surveysComplete, setSurveysComplete] = useState(0);
  /** `null` until the first fetch finishes (avoids redirecting before we know completion state). */
  const [completedInstruments, setCompletedInstruments] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ecrOrder, setEcrOrder] = useState<ECRItem[] | null>(null);
  /** Wall-clock start when the user leaves the intro (used for time-on-task flags). */
  const assessmentStartMsRef = useRef<number | null>(null);

  const ecrShuffle = instrumentId === "ECR-36";
  const totalQuestions = config?.items.length ?? 0;

  useEffect(() => {
    setEcrOrder(null);
  }, [instrumentId]);

  useEffect(() => {
    if (!ecrShuffle || showIntro || !user?.id) return;
    setEcrOrder((prev) => prev ?? getShuffledItems(sessionSeed));
  }, [ecrShuffle, showIntro, user?.id, sessionSeed]);
  const isIntro = showIntro && totalQuestions > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setCompletedInstruments([]);
        setLoading(false);
        return;
      }
      const res = await getCompletedAssessments(user.id);
      if (cancelled) return;
      const list = res.success ? res.data : [];
      setCompletedInstruments(list);
      setSurveysComplete(list.length);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    assessmentStartMsRef.current = null;
  }, [instrumentId]);

  const isCoreOnboardingInstrument = (ASSESSMENT_IDS as readonly string[]).includes(instrumentId);

  useLayoutEffect(() => {
    if (!user?.id || loading || profileLoading) return;
    if (completedInstruments === null || !isCoreOnboardingInstrument) return;
    if (!completedInstruments.includes(instrumentId)) return;

    const next = getFirstIncompleteAssessment(completedInstruments);
    if (next) {
      if (next === "CONFLICT-30") {
        navigation.replace("DatingConflictStyle", {});
      } else {
        navigation.replace("DatingInstrument", { instrument: next });
      }
      return;
    }
    navigation.replace("DatingProfileBuilder");
  }, [
    user?.id,
    loading,
    profileLoading,
    completedInstruments,
    instrumentId,
    navigation,
    isCoreOnboardingInstrument,
  ]);

  // Resume from saved question if this instrument was in progress
  useEffect(() => {
    if (!config || loading) return;
    if (
      profile?.currentAssessment === instrumentId &&
      typeof profile?.currentAssessmentQuestion === "number" &&
      profile.currentAssessmentQuestion > 1
    ) {
      const q = Math.min(
        profile.currentAssessmentQuestion,
        config.items.length
      );
      setShowIntro(false);
      setCurrentIndex(Math.max(0, Math.min(q - 1, config.items.length - 1)));
    }
  }, [config, instrumentId, loading, profile?.currentAssessment, profile?.currentAssessmentQuestion]);

  const safeIndexForSync =
    totalQuestions > 0
      ? Math.max(0, Math.min(currentIndex, totalQuestions - 1))
      : 0;
  useEffect(() => {
    if (totalQuestions === 0) return;
    if (currentIndex !== safeIndexForSync) {
      setCurrentIndex(safeIndexForSync);
    }
  }, [currentIndex, safeIndexForSync, totalQuestions]);

  const saveProgress = useCallback(
    async (questionNumber1Based: number) => {
      if (!user?.id) return;
      await saveAssessmentProgress(user.id, instrumentId, questionNumber1Based);
    },
    [user?.id, instrumentId]
  );

  const finalizeAssessment = useCallback(
    async (next: Record<string, number>) => {
      setSaving(true);
      try {
        if (!user?.id || !config) {
          Alert.alert(
            "Couldn't save",
            "Your session may have expired. Sign in again and retake or contact support."
          );
          return;
        }
        const scores = config.score(next);
        const elapsedSec =
          assessmentStartMsRef.current != null
            ? Math.max(0, Math.floor((Date.now() - assessmentStartMsRef.current) / 1000))
            : undefined;
        const result = await saveAssessmentResult(user.id, instrumentId, scores, next, {
          timeTakenSec: elapsedSec,
          qualityFlags:
            instrumentId === "RELATIONSHIP_TRAITS_8"
              ? computeRelationshipTraitsQualityFlags(next, elapsedSec ?? 0)
              : undefined,
        });
        if (result.success) {
          await refreshProfile();
          navigation.replace("DatingInsight", { instrument: instrumentId });
        } else {
          Alert.alert(
            "Couldn't save",
            result.error?.message ?? "Please check your connection and try again."
          );
        }
      } catch (e) {
        console.error("saveAssessmentResult failed:", e);
        Alert.alert(
          "Couldn't save",
          e instanceof Error ? e.message : "Please try again."
        );
      } finally {
        setSaving(false);
      }
    },
    [user?.id, config, instrumentId, navigation, refreshProfile]
  );

  const handleResponse = useCallback(
    (value: number) => {
      const idx =
        totalQuestions > 0
          ? Math.max(0, Math.min(currentIndex, totalQuestions - 1))
          : 0;
      const activeItem = ecrShuffle && ecrOrder ? ecrOrder[idx] : null;
      const responseKey = activeItem ? activeItem.id : idx + 1;

      setResponses((prev) => {
        const next = { ...prev, [String(responseKey)]: value };

        if (idx >= totalQuestions - 1) {
          queueMicrotask(() => {
            void finalizeAssessment(next);
          });
        }

        return next;
      });

      if (idx >= totalQuestions - 1) {
        return;
      }

      const nextIndex = idx + 1;
      const nextQuestion1Based = nextIndex + 1;
      if (nextQuestion1Based % SAVE_PROGRESS_EVERY === 0) {
        saveProgress(nextQuestion1Based);
      }
      setTimeout(() => setCurrentIndex(nextIndex), 300);
    },
    [
      currentIndex,
      totalQuestions,
      ecrShuffle,
      ecrOrder,
      finalizeAssessment,
      saveProgress,
    ]
  );

  if (!config) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Unknown instrument.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isIntro) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.introScrollContent}
        >
          <View style={styles.introCard}>
            <Text style={styles.introEyebrow}>
              {instrumentId === "RELATIONSHIP_TRAITS_8"
                ? "Relationship traits"
                : "Relationship typology"}
            </Text>
            <Text style={styles.introTitle}>{config.title}</Text>
            <Text style={styles.introDesc}>
              {renderIntroDescription(config.description, instrumentId)}
            </Text>
            {instrumentId === "BRS" && (
              <Text style={styles.brsNote}>
                Some of these questions may seem similar to each other. That's
                intentional — answering each one carefully gives a more accurate
                result.
              </Text>
            )}
            <Button
              title="Begin"
              onPress={() => {
                assessmentStartMsRef.current = Date.now();
                if (instrumentId === "ECR-36") {
                  setEcrOrder(getShuffledItems(sessionSeed));
                }
                setShowIntro(false);
              }}
              variant="primary"
              style={styles.introButton}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const questionNumber = safeIndexForSync + 1;
  const activeEcrItem = ecrShuffle && ecrOrder ? ecrOrder[safeIndexForSync] : null;
  const itemText = activeEcrItem?.text ?? config.items[safeIndexForSync];
  const canonicalId = activeEcrItem?.id ?? safeIndexForSync + 1;
  const flowProgressPct = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;

  if (ecrShuffle && !showIntro && !ecrOrder) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${flowProgressPct}%` }]} />
      </View>
      <ScrollView
        style={[styles.scroll, Platform.OS === "web" && styles.scrollWeb]}
        contentContainerStyle={styles.questionScrollContent}
      >
        <View style={styles.questionCard}>
          <AssessmentHeader
            surveysComplete={surveysComplete}
            currentQ={questionNumber}
            totalQ={totalQuestions}
            assessmentName={config.title}
            totalAssessments={ASSESSMENT_IDS.length}
            subtitle={
              instrumentId === "RELATIONSHIP_TRAITS_8"
                ? "A few quick questions about how you tend to respond to stress and trust in relationships."
                : undefined
            }
          />
          <Text style={styles.questionText}>{itemText}</Text>
          <LikertScale
            value={responses[String(canonicalId)] ?? null}
            onChange={handleResponse}
            min={config.min}
            max={config.max}
            minLabel={config.minLabel}
            maxLabel={config.maxLabel}
          />
          {instrumentId === "RELATIONSHIP_TRAITS_8" && (
            <Text style={styles.scaleLegend}>
              1 = Strongly disagree · 2 = Disagree · 3 = Slightly disagree · 4 = Neutral · 5 =
              Slightly agree · 6 = Agree · 7 = Strongly agree
            </Text>
          )}
        </View>
      </ScrollView>
      {saving && (
        <View
          style={styles.savingOverlay}
          pointerEvents="auto"
          accessibilityRole="progressbar"
          accessibilityLabel="Saving your answers"
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.savingOverlayHint}>Saving…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollWeb: {
    minHeight: 280,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },
  questionScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    paddingBottom: 56,
    alignItems: "center",
  },
  introScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    paddingBottom: 56,
    alignItems: "center",
  },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "#E0E0E0",
    width: "100%",
  },
  flowProgressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  introTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 16,
    lineHeight: 38,
  },
  introDesc: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 26,
  },
  introTypeLabel: {
    color: theme.colors.text,
    fontWeight: "800",
  },
  introCard: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 28,
  },
  introEyebrow: {
    color: "#9CB4D8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  introButton: {
    marginTop: 28,
    alignSelf: "flex-start",
    minWidth: 180,
  },
  brsNote: {
    fontSize: 14,
    fontStyle: "italic",
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  questionText: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: 30,
    marginTop: 12,
    marginBottom: 24,
  },
  questionCard: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 28,
  },
  scaleLegend: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  savingOverlayHint: {
    marginTop: 16,
    fontSize: 16,
    color: "#F3F4F6",
  },
});
