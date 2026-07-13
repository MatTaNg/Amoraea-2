import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { replaceWithPreviousOnboardingAssessment } from "@/datingProfile/onboarding/navigateToPreviousOnboardingAssessment";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { useProfile } from "@/shared/hooks/useProfile";
import { CONFLICT_STYLE_PAIRS } from "@/data/assessments/instruments/conflictStyleQuestions";
import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import {
  saveConflictStyleCompletion,
  fetchConflictStyleResponseDrafts,
  upsertConflictStyleDraftAnswer,
  clearConflictStyleResponseDrafts,
} from "@/data/services/conflictStyleService";
import type { ConflictStyleResponseRow } from "@/data/services/conflictStyleService";
import { shufflePair } from "@/data/assessments/instruments/conflictStyleShuffle";
import { saveAssessmentProgress } from "@/data/services/assessmentService";
import { profilesRepo } from "@/data/repos/profilesRepo";
import { theme } from "@/shared/theme/theme";
import { AssessmentHeader } from "@/shared/components/assessments/AssessmentHeader";
import { AssessmentPreparingResults } from "@/shared/components/assessments/AssessmentPreparingResults";
import {
  ASSESSMENT_IDS,
  getCompletedAssessments,
  getFirstIncompleteAssessment,
  getNextInstrument,
  onboardingAssessmentBatteryIndex,
} from "@/data/services/assessmentService";
import { useNavigateAfterAssessments } from "@/datingProfile/onboarding/useNavigateAfterAssessments";

const SAVE_PROGRESS_EVERY = 5;

export function ConflictStyleAssessmentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route = useRoute<RouteProp<DatingProfileStackParamList, "DatingConflictStyle">>();
  const { user } = useAuth();
  const { profile, refreshProfile, loading: profileLoading } = useProfile();
  const navigateAfterAssessments = useNavigateAfterAssessments(user?.id);
  const fromFlow = route.params?.from === "edit" ? "edit" : "onboarding";
  const isRetake = route.params?.retake === "1";

  const [showIntro, setShowIntro] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Record<number, { style: ConflictStyleKey; selectedOptionIndex: number }>
  >({});
  const [saving, setSaving] = useState(false);
  const [completedInstruments, setCompletedInstruments] = useState<string[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  /** After manual Begin or one-time server resume — stops profile refetches from resetting question index. */
  const resumeSyncDoneRef = useRef(false);
  /** Prevents double-tap on the same question while its draft upsert runs — does not block later questions. */
  const selectionInFlightRef = useRef<number | null>(null);

  const total = CONFLICT_STYLE_PAIRS.length;
  const sessionSeed = useMemo(
    () =>
      (user?.id || "anon").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    [user?.id]
  );

  React.useEffect(() => {
    let c = false;
    (async () => {
      if (!user?.id) {
        setCompletedInstruments([]);
        setLoadingMeta(false);
        return;
      }
      const res = await getCompletedAssessments(user.id);
      if (!c) {
        const list = res.success ? res.data : [];
        setCompletedInstruments(list);
      }
      setLoadingMeta(false);
    })();
    return () => {
      c = true;
    };
  }, [user?.id]);

  React.useLayoutEffect(() => {
    if (!user?.id || loadingMeta || profileLoading) return;
    if (fromFlow === "edit" || isRetake) return;
    if (completedInstruments === null) return;
    if (!completedInstruments.includes("CONFLICT-30")) return;

    const next = getFirstIncompleteAssessment(completedInstruments);
    if (next) {
      navigation.replace("DatingInstrument", { instrument: next });
      return;
    }
    void navigateAfterAssessments();
  }, [
    user?.id,
    loadingMeta,
    profileLoading,
    completedInstruments,
    fromFlow,
    isRetake,
    navigateAfterAssessments,
  ]);

  React.useEffect(() => {
    if (resumeSyncDoneRef.current) return;
    if (profileLoading) return;
    if (
      profile?.currentAssessment === "CONFLICT-30" &&
      typeof profile.currentAssessmentQuestion === "number" &&
      profile.currentAssessmentQuestion > 1
    ) {
      const q = Math.min(profile.currentAssessmentQuestion, total);
      setShowIntro(false);
      setCurrentIndex(Math.max(0, Math.min(q - 1, total - 1)));
      resumeSyncDoneRef.current = true;
    }
  }, [profileLoading, profile?.currentAssessment, profile?.currentAssessmentQuestion, total]);

  React.useEffect(() => {
    if (fromFlow === "edit") return;
    if (resumeSyncDoneRef.current) return;
    if (!user?.id) return;

    let cancelled = false;
    void (async () => {
      if (isRetake) {
        const cleared = await clearConflictStyleResponseDrafts(user.id);
        if (cancelled) return;
        if (!cleared.success) {
          Alert.alert("Couldn't reset", cleared.error.message);
          return;
        }
        setAnswers({});
        setCurrentIndex(0);
      }
      if (
        profile?.currentAssessment === "CONFLICT-30" &&
        typeof profile.currentAssessmentQuestion === "number" &&
        profile.currentAssessmentQuestion > 1
      ) {
        resumeSyncDoneRef.current = true;
        return;
      }
      resumeSyncDoneRef.current = true;
      await saveAssessmentProgress(user.id, "CONFLICT-30", 1);
      if (!cancelled) await refreshProfile?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fromFlow,
    isRetake,
    user?.id,
    profile?.currentAssessment,
    profile?.currentAssessmentQuestion,
    refreshProfile,
  ]);

  /** Restore answers after refresh / resume (server is source of truth for partial progress). */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || showIntro) return;
      const res = await fetchConflictStyleResponseDrafts(user.id);
      if (cancelled || !res.success || !res.data?.length) return;
      setAnswers((prev) => {
        const merged = { ...prev };
        for (const row of res.data!) {
          merged[row.question_index] = {
            style: row.selected_style as ConflictStyleKey,
            selectedOptionIndex: row.selected_option_index,
          };
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, showIntro]);

  const pair = CONFLICT_STYLE_PAIRS[currentIndex];
  const shuffled = useMemo(
    () => (pair ? shufflePair(pair, sessionSeed) : null),
    [pair, sessionSeed]
  );

  const persistProgress = useCallback(
    async (question1Based: number) => {
      if (!user?.id) return;
      await saveAssessmentProgress(user.id, "CONFLICT-30", question1Based);
      await refreshProfile?.();
    },
    [user?.id, refreshProfile]
  );

  const selectOption = async (displayIndex: number, style: ConflictStyleKey) => {
    if (saving) return;

    const idx = currentIndex;
    if (selectionInFlightRef.current === idx) return;

    const next = {
      ...answers,
      [idx]: { style, selectedOptionIndex: displayIndex },
    };
    setAnswers(next);

    if (idx >= total - 1) {
      setSaving(true);
      selectionInFlightRef.current = idx;
      try {
        if (user?.id) {
          const up = await upsertConflictStyleDraftAnswer(user.id, {
            questionIndex: idx,
            selectedOptionIndex: displayIndex,
            selectedStyle: style,
          });
          if (!up.success) {
            Alert.alert("Couldn't save your answer", up.error.message);
            setAnswers((prev) => {
              const copy = { ...prev };
              delete copy[idx];
              return copy;
            });
            return;
          }
        }

        const rows: ConflictStyleResponseRow[] = [];
        for (let i = 0; i < total; i += 1) {
          const a = next[i];
          if (!a) {
            Alert.alert(
              "Can't finish yet",
              "Some earlier answers are missing (for example after a refresh before progress was saved). Please use Back to review, or leave and restart this section."
            );
            return;
          }
          rows.push({
            questionIndex: i,
            selectedOptionIndex: a.selectedOptionIndex,
            selectedStyle: a.style,
          });
        }
        if (!user?.id) {
          Alert.alert("Not signed in", "Sign in again to save your results.");
          return;
        }
        const result = await saveConflictStyleCompletion(user.id, rows, { isRetake });
        if (result.success) {
          if (fromFlow === "onboarding") {
            const nextInstrument = getNextInstrument("CONFLICT-30");
            const prof = await profilesRepo.updateProfile(user.id, {
              currentAssessment: nextInstrument ?? null,
              currentAssessmentQuestion: nextInstrument ? 1 : null,
            });
            if (!prof.success) {
              Alert.alert("Profile update failed", prof.error?.message ?? "Try again.");
              return;
            }
          }
          await refreshProfile?.();
          navigation.replace("DatingConflictResults", { from: fromFlow });
        } else {
          Alert.alert("Couldn't save results", result.error?.message ?? "Please try again.");
        }
      } finally {
        setSaving(false);
        selectionInFlightRef.current = null;
      }
      return;
    }

    const nextIndex = idx + 1;
    const q1 = nextIndex + 1;
    setCurrentIndex(nextIndex);

    const uid = user?.id;
    if (!uid) {
      return;
    }

    selectionInFlightRef.current = idx;
    void (async () => {
      try {
        const up = await upsertConflictStyleDraftAnswer(uid, {
          questionIndex: idx,
          selectedOptionIndex: displayIndex,
          selectedStyle: style,
        });
        if (!up.success) {
          Alert.alert("Couldn't save your answer", up.error.message);
          setCurrentIndex(idx);
          setAnswers((prev) => {
            const copy = { ...prev };
            delete copy[idx];
            return copy;
          });
          return;
        }
        if (q1 % SAVE_PROGRESS_EVERY === 0) {
          await persistProgress(q1);
        }
      } finally {
        if (selectionInFlightRef.current === idx) {
          selectionInFlightRef.current = null;
        }
      }
    })();
  };

  const goBack = () => {
    if (saving) return;
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      return;
    }
    replaceWithPreviousOnboardingAssessment(navigation, "CONFLICT-30");
  };

  if (loadingMeta) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (saving) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <AssessmentPreparingResults />
      </SafeAreaView>
    );
  }

  const qNum = currentIndex + 1;
  const progressPct = (qNum / total) * 100;
  const selected = answers[currentIndex];
  const assessmentIndex = onboardingAssessmentBatteryIndex("CONFLICT-30");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${progressPct}%` }]} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.questionScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.questionCard}>
          <AssessmentHeader
            assessmentIndex={assessmentIndex}
            currentQ={qNum}
            totalQ={total}
            assessmentName="Conflict style"
            totalAssessments={ASSESSMENT_IDS.length}
          />
          <Text style={styles.question}>{pair?.prompt ?? ""}</Text>
          {shuffled &&
            [shuffled.first, shuffled.second].map((opt, displayIdx) => {
              const isSel = selected?.selectedOptionIndex === displayIdx;
              return (
                <Pressable
                  key={`${currentIndex}-${displayIdx}`}
                  style={[styles.option, isSel && styles.optionReviewed]}
                  disabled={saving}
                  onPress={() => selectOption(displayIdx, opt.style)}
                >
                  <Text style={styles.optionText}>{opt.text}</Text>
                </Pressable>
              );
            })}
          <Pressable
            style={styles.backBtn}
            onPress={goBack}
            disabled={saving}
          >
            <Text style={[styles.backText, saving && styles.backDisabled]}>← Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  questionScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    paddingBottom: 56,
    alignItems: "flex-start",
  },
  introScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    paddingBottom: 56,
    alignItems: "flex-start",
  },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "#E0E0E0",
    width: "100%",
  },
  flowProgressFill: { height: "100%", backgroundColor: "#007AFF" },
  introTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 16,
    lineHeight: 38,
  },
  introBody: { fontSize: 16, color: theme.colors.textSecondary, lineHeight: 26 },
  introMeta: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 16 },
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
  primaryBtn: {
    marginTop: 28,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "flex-start",
    minWidth: 180,
  },
  primaryBtnText: { color: theme.colors.textInverse, fontSize: 16, fontWeight: "600" },
  question: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: 30,
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
  option: {
    borderWidth: 1,
    borderColor: "rgba(82,142,220,0.25)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    minHeight: 56,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  optionReviewed: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(91,168,232,0.2)",
  },
  optionText: { fontSize: 16, color: theme.colors.text, lineHeight: 22 },
  backBtn: { marginTop: 16, paddingVertical: 8 },
  backText: { fontSize: 16, color: theme.colors.primary },
  backDisabled: { opacity: 0.35 },
});
