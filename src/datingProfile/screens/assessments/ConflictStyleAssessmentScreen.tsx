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
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
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
import {
  getCompletedAssessments,
  getFirstIncompleteAssessment,
} from "@/data/services/assessmentService";

const SAVE_PROGRESS_EVERY = 5;

export function ConflictStyleAssessmentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route = useRoute<RouteProp<DatingProfileStackParamList, "DatingConflictStyle">>();
  const { user } = useAuth();
  const { profile, refreshProfile, loading: profileLoading } = useProfile();
  const fromFlow = route.params?.from === "edit" ? "edit" : "onboarding";
  const isRetake = route.params?.retake === "1";

  const [showIntro, setShowIntro] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Record<number, { style: ConflictStyleKey; selectedOptionIndex: number }>
  >({});
  const [saving, setSaving] = useState(false);
  /** Re-render option disable state while a background upsert runs (refs alone would not update Pressable). */
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [surveysComplete, setSurveysComplete] = useState(0);
  const [completedInstruments, setCompletedInstruments] = useState<string[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  /** After manual Begin or one-time server resume — stops profile refetches from resetting question index. */
  const resumeSyncDoneRef = useRef(false);
  /** Blocks double-taps while a non-final answer persists in the background. */
  const selectionInFlightRef = useRef(false);

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
        setSurveysComplete(list.length);
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
    navigation.replace("DatingProfileBuilder");
  }, [
    user?.id,
    loadingMeta,
    profileLoading,
    completedInstruments,
    fromFlow,
    isRetake,
    navigation,
  ]);

  React.useEffect(() => {
    if (resumeSyncDoneRef.current) return;
    if (profileLoading) return;
    if (
      profile?.currentAssessment === "CONFLICT-30" &&
      typeof profile.currentAssessmentQuestion === "number" &&
      profile.currentAssessmentQuestion >= 1
    ) {
      const q = Math.min(profile.currentAssessmentQuestion, total);
      setShowIntro(false);
      setCurrentIndex(Math.max(0, Math.min(q - 1, total - 1)));
      resumeSyncDoneRef.current = true;
    }
  }, [profileLoading, profile?.currentAssessment, profile?.currentAssessmentQuestion, total]);

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
    if (saving || selectionInFlightRef.current) return;

    const idx = currentIndex;
    const next = {
      ...answers,
      [idx]: { style, selectedOptionIndex: displayIndex },
    };
    setAnswers(next);

    if (idx >= total - 1) {
      setSaving(true);
      selectionInFlightRef.current = true;
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
            const prof = await profilesRepo.updateProfile(user.id, {
              currentAssessment: "PVQ-21",
              currentAssessmentQuestion: 1,
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
        selectionInFlightRef.current = false;
      }
      return;
    }

    const nextIndex = idx + 1;
    const q1 = nextIndex + 1;

    selectionInFlightRef.current = true;
    setSelectionBusy(true);
    setCurrentIndex(nextIndex);

    const uid = user?.id;
    if (!uid) {
      selectionInFlightRef.current = false;
      setSelectionBusy(false);
      return;
    }

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
        selectionInFlightRef.current = false;
        setSelectionBusy(false);
      }
    })();
  };

  const goBack = () => {
    if (currentIndex <= 0 || saving || selectionBusy) return;
    setCurrentIndex((i) => i - 1);
  };

  if (loadingMeta) {
    return (
      <View style={[styles.centered, { flex: 1 }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (showIntro) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.introTitle}>How do you handle conflict?</Text>
          <Text style={styles.introBody}>
            3–4 minutes. Helps us find someone whose conflict style works with yours.
          </Text>
          <Text style={styles.introMeta}>
            20 questions · one at a time · your answers are saved as you go
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={async () => {
              resumeSyncDoneRef.current = true;
              if (user?.id && isRetake) {
                const cleared = await clearConflictStyleResponseDrafts(user.id);
                if (!cleared.success) {
                  Alert.alert("Couldn't reset", cleared.error.message);
                  return;
                }
                setAnswers({});
                setCurrentIndex(0);
              }
              setShowIntro(false);
              if (user?.id) {
                void saveAssessmentProgress(user.id, "CONFLICT-30", 1).then(() =>
                  refreshProfile?.()
                );
              }
            }}
          >
            <Text style={styles.primaryBtnText}>Begin</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const qNum = currentIndex + 1;
  const progressPct = (qNum / total) * 100;
  const selected = answers[currentIndex];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${progressPct}%` }]} />
      </View>
      <AssessmentHeader
        surveysComplete={surveysComplete}
        currentQ={qNum}
        totalQ={total}
        assessmentName="Conflict style"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.question}>{pair?.prompt ?? ""}</Text>
        {shuffled &&
          [shuffled.first, shuffled.second].map((opt, displayIdx) => {
            const isSel = selected?.selectedOptionIndex === displayIdx;
            return (
              <Pressable
                key={`${currentIndex}-${displayIdx}`}
                style={[styles.option, isSel && styles.optionReviewed]}
                disabled={saving || selectionBusy}
                onPress={() => selectOption(displayIdx, opt.style)}
              >
                <Text style={styles.optionText}>{opt.text}</Text>
              </Pressable>
            );
          })}
        <Pressable
          style={styles.backBtn}
          onPress={goBack}
          disabled={currentIndex === 0 || saving || selectionBusy}
        >
          <Text style={[styles.backText, currentIndex === 0 && styles.backDisabled]}>← Back</Text>
        </Pressable>
      </ScrollView>
      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" />
          <Text style={styles.savingText}>Saving…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "#E0E0E0",
    width: "100%",
  },
  flowProgressFill: { height: "100%", backgroundColor: "#007AFF" },
  introTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 12,
  },
  introBody: { fontSize: 16, color: theme.colors.textSecondary, lineHeight: 24 },
  introMeta: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 16 },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: theme.colors.textInverse, fontSize: 16, fontWeight: "600" },
  question: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    lineHeight: 26,
    marginBottom: 20,
  },
  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 56,
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  optionReviewed: { borderColor: theme.colors.primary },
  optionText: { fontSize: 16, color: theme.colors.text, lineHeight: 22 },
  backBtn: { marginTop: 16, paddingVertical: 8 },
  backText: { fontSize: 16, color: theme.colors.primary },
  backDisabled: { opacity: 0.35 },
  savingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  savingText: { fontSize: 14, color: theme.colors.textSecondary },
});
