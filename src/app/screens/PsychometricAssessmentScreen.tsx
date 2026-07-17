import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { AdminInterviewDashboard } from '@app/screens/AdminInterviewDashboard';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { supabase } from '@data/supabase/client';
import { PsychometricsAdminPanelButton } from '@features/psychometrics/PsychometricsAdminPanelButton';
import { PsychometricsBackButton } from '@features/psychometrics/PsychometricsBackButton';
import {
  ASSESSMENTS,
  ASSESSMENT_ORDER,
  hasPsychometricQuestionResponse,
  isForcedChoiceAssessment,
  resolvePsychometricsResumePosition,
  psychometricBatteryProgressPosition,
  psychometricBatteryTotalQuestions,
  type AssessmentId,
  type NpiEntitlementResponse,
  type PsychometricResponsesMap,
} from '@features/psychometrics/assessmentContent';
import { shuffleNpiPair } from '@features/psychometrics/npiEntitlementShuffle';
import {
  clearPsychometricsCompleted,
  formatMissingPsychometricAssessmentNames,
  loadPsychometricAssessmentResponses,
  markPsychometricsCompleted,
  persistPsychometricProgress,
  savePsychometricAssessmentResult,
  verifyAllPsychometricsPersisted,
} from '@features/psychometrics/psychometricsPersistence';
import { MarketResearchModal } from '@features/onboarding/MarketResearchModal';
import { useMarketResearchCompletion } from '@features/referrals/MarketResearchCompletionContext';
import { WelcomeModal } from '@features/psychometrics/WelcomeModal';
import {
  loadPsychometricsWebFontsOnce,
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_BG,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_FONT_DISPLAY,
  PSYCHOMETRICS_GLASS_BORDER,
} from '@features/psychometrics/psychometricsTheme';
import { spacing } from '@ui/theme/spacing';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import {
  resolveInitialInterviewRoute,
  PSYCHOMETRICS_ENABLED,
  type InterviewStackRoute,
} from '@features/psychometrics/resolveInitialInterviewRoute';
import {
  useAssessmentScrollContent,
  useNarrowAssessmentViewport,
} from '@utilities/assessmentMobileLayout';

type Props = {
  navigation: {
    replace: (screen: InterviewStackRoute, params?: { userId: string; openAdminPanel?: boolean }) => void;
    setParams?: (params: { openAdminPanel?: boolean }) => void;
  };
  route: {
    params?: {
      userId?: string;
      interviewAlreadyCompleted?: boolean;
      legacyPsychometricsMode?: boolean;
      openAdminPanel?: boolean;
      needsMarketResearch?: boolean;
    };
  };
};

export function PsychometricAssessmentScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { notifyMarketResearchComplete } = useMarketResearchCompletion();
  const userId = route.params?.userId ?? '';
  const legacyPsychometricsMode =
    route.params?.legacyPsychometricsMode === true ||
    route.params?.interviewAlreadyCompleted === true;
  const interviewAlreadyCompleted = legacyPsychometricsMode;
  const isAdminUser = isAmoraeaAdminConsoleEmail(user?.email);

  const [showWelcome, setShowWelcome] = useState(false);
  const [needsMarketResearch, setNeedsMarketResearch] = useState(
    () => route.params?.needsMarketResearch === true,
  );
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [currentAssessmentIndex, setCurrentAssessmentIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<PsychometricResponsesMap>({});
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cameFromAssessments, setCameFromAssessments] = useState(false);
  const scrollContentStyle = useAssessmentScrollContent({ paddingTop: 32 });
  const narrowViewport = useNarrowAssessmentViewport();

  useEffect(() => {
    if (!route.params?.openAdminPanel || !isAdminUser) return;
    setShowAdminPanel(true);
    navigation.setParams?.({ openAdminPanel: undefined });
  }, [route.params?.openAdminPanel, isAdminUser, navigation]);

  useEffect(() => {
    if (PSYCHOMETRICS_ENABLED || !userId) return;
    let cancelled = false;
    void (async () => {
      const { screen } = await resolveInitialInterviewRoute(userId);
      if (cancelled || screen === 'PsychometricAssessment') return;
      navigation.replace(screen, { userId });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, userId]);

  const navigateAfterComplete = useCallback(
    async (options?: { showCongrats?: boolean }) => {
      if (!userId) return;
      const adminPanelParams = isAdminUser ? { openAdminPanel: true as const } : {};
      if (interviewAlreadyCompleted) {
        const { screen } = await resolveInitialInterviewRoute(userId);
        if (screen !== 'PsychometricAssessment') {
          navigation.replace(screen, {
            userId,
            ...(screen === 'Amoraea' ? adminPanelParams : {}),
          });
          return;
        }
        navigation.replace('PostInterview', { userId });
        return;
      }
      navigation.replace('Amoraea', { userId, ...adminPanelParams });
    },
    [interviewAlreadyCompleted, isAdminUser, navigation, userId],
  );

  const completeAllAssessments = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const verification = await verifyAllPsychometricsPersisted(userId);
    if (!verification.complete) {
      Alert.alert(
        'Some assessments were not saved',
        `These questionnaires still need to be completed: ${formatMissingPsychometricAssessmentNames(verification.missingAssessmentIds)}.`,
      );
      return false;
    }

    const marked = await markPsychometricsCompleted(userId);
    if (!marked.ok) {
      Alert.alert('Could not finish', marked.message);
      return false;
    }

    if (legacyPsychometricsMode && !PSYCHOMETRICS_ENABLED) {
      const completedAttemptId = await fetchMostRecentCompletedInterviewAttemptId(userId);
      if (completedAttemptId) {
        await applyPsychometricModifierToAttempt(userId, completedAttemptId, {
          preservePassIfPreviouslyPassing: true,
        });
      }
    }

    await navigateAfterComplete({ showCongrats: true });
    return true;
  }, [legacyPsychometricsMode, navigateAfterComplete, userId]);

  const sessionSeed = useMemo(
    () => userId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    [userId],
  );

  const loadSavedResponsesForAssessment = useCallback(
    async (assessmentId: AssessmentId): Promise<PsychometricResponsesMap> => {
      if (!userId) return {};
      return loadPsychometricAssessmentResponses(userId, assessmentId);
    },
    [userId],
  );

  const resumeAtFirstMissingAssessment = useCallback(
    async (missingAssessmentIds: AssessmentId[]) => {
      const firstMissing = missingAssessmentIds[0];
      if (!firstMissing || !userId) return;

      const assessmentIndex = ASSESSMENT_ORDER.indexOf(firstMissing);
      if (assessmentIndex < 0) return;

      const saved = await loadSavedResponsesForAssessment(firstMissing);
      const questions = ASSESSMENTS[firstMissing].questions;
      let questionIndex = 0;
      for (let i = 0; i < questions.length; i++) {
        if (!hasPsychometricQuestionResponse(saved[questions[i]!.id])) {
          questionIndex = i;
          break;
        }
      }

      setCurrentAssessmentIndex(assessmentIndex);
      setCurrentQuestionIndex(questionIndex);
      setResponses(saved);
      setShowWelcome(false);
      setFinishing(false);
      setSaving(false);
      setLoading(false);

      await persistPsychometricProgress(userId, firstMissing, questionIndex, saved);
    },
    [loadSavedResponsesForAssessment, userId],
  );

  const loadResumeState = useCallback(async () => {
    if (!userId) {
      setShowWelcome(PSYCHOMETRICS_ENABLED ? false : true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select(
        'market_research_completed_at, psychometrics_completed_at, psychometrics_current_assessment, psychometrics_current_question_index, psychometrics_partial_responses',
      )
      .eq('id', userId)
      .single();

    if (error || !data) {
      setNeedsMarketResearch(true);
      setShowWelcome(!PSYCHOMETRICS_ENABLED);
      setLoading(false);
      return;
    }

    const marketResearchPending = data.market_research_completed_at == null;
    setNeedsMarketResearch(marketResearchPending);

    if (data.psychometrics_completed_at) {
      const verification = await verifyAllPsychometricsPersisted(userId);
      if (verification.complete) {
        await navigateAfterComplete();
        return;
      }
      await clearPsychometricsCompleted(userId);
      await resumeAtFirstMissingAssessment(verification.missingAssessmentIds);
      return;
    }

    if (data.psychometrics_current_assessment) {
      const resume = resolvePsychometricsResumePosition(
        data.psychometrics_current_assessment as AssessmentId,
        data.psychometrics_current_question_index ?? 0,
      );

      if (resume.allQuestionsAnswered) {
        setFinishing(true);
        const finished = await completeAllAssessments();
        if (!finished) {
          const verification = await verifyAllPsychometricsPersisted(userId);
          await resumeAtFirstMissingAssessment(verification.missingAssessmentIds);
        }
        return;
      }

      setCurrentAssessmentIndex(resume.assessmentIndex);
      setCurrentQuestionIndex(resume.questionIndex);
      setResponses((data.psychometrics_partial_responses as PsychometricResponsesMap) ?? {});
      setShowWelcome(false);
      setLoading(false);
      return;
    }

    if (interviewAlreadyCompleted) {
      if (marketResearchPending) {
        setShowWelcome(true);
      } else {
        setShowWelcome(false);
        void persistPsychometricProgress(userId, 'brs', 0, {});
      }
      setLoading(false);
      return;
    }

    setShowWelcome(!PSYCHOMETRICS_ENABLED);
    setLoading(false);
  }, [completeAllAssessments, interviewAlreadyCompleted, navigateAfterComplete, resumeAtFirstMissingAssessment, userId]);

  useEffect(() => {
    loadPsychometricsWebFontsOnce();
    void loadResumeState();
  }, [loadResumeState]);

  async function persistProgress(
    assessmentId: AssessmentId,
    questionIndex: number,
    currentResponses: PsychometricResponsesMap,
  ) {
    if (!userId) return;
    const result = await persistPsychometricProgress(userId, assessmentId, questionIndex, currentResponses);
    if (!result.ok) {
      Alert.alert('Could not save progress', result.message);
    }
  }

  async function advanceAfterAnswer(
    assessmentId: AssessmentId,
    newResponses: PsychometricResponsesMap,
    isLastQuestion: boolean,
    isLastAssessment: boolean,
  ) {
    if (!isLastQuestion) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      await persistProgress(assessmentId, nextIndex, newResponses);
      return;
    }

    setSaving(true);
    const saveResult = await savePsychometricAssessmentResult(userId, assessmentId, newResponses);
    if (!saveResult.ok) {
      Alert.alert('Could not save your answer', saveResult.message);
      setSaving(false);
      return;
    }

    if (isLastAssessment) {
      setFinishing(true);
      const finished = await completeAllAssessments();
      if (!finished) {
        const verification = await verifyAllPsychometricsPersisted(userId);
        await resumeAtFirstMissingAssessment(verification.missingAssessmentIds);
      }
      return;
    }

    const nextAssessmentId = ASSESSMENT_ORDER[currentAssessmentIndex + 1];
    setCurrentAssessmentIndex((prev) => prev + 1);
    setCurrentQuestionIndex(0);
    setResponses({});
    await persistProgress(nextAssessmentId, 0, {});
    setSaving(false);
  }

  async function handleAnswer(value: number) {
    const assessmentId = ASSESSMENT_ORDER[currentAssessmentIndex];
    const assessment = ASSESSMENTS[assessmentId];
    const question = assessment.questions[currentQuestionIndex];
    if (!question || saving || finishing || isForcedChoiceAssessment(assessment)) return;

    const newResponses = { ...responses, [question.id]: value };
    setResponses(newResponses);

    const isLastQuestion = currentQuestionIndex === assessment.questions.length - 1;
    const isLastAssessment = currentAssessmentIndex === ASSESSMENT_ORDER.length - 1;
    await advanceAfterAnswer(assessmentId, newResponses, isLastQuestion, isLastAssessment);
  }

  async function handleForcedChoiceAnswer(
    selectedOptionIndex: 0 | 1,
    wasEntitlement: boolean,
  ) {
    const assessmentId = ASSESSMENT_ORDER[currentAssessmentIndex];
    const assessment = ASSESSMENTS[assessmentId];
    if (!isForcedChoiceAssessment(assessment) || saving || finishing) return;

    const question = assessment.questions[currentQuestionIndex];
    if (!question) return;

    const response: NpiEntitlementResponse = { selectedOptionIndex, wasEntitlement };
    const newResponses = { ...responses, [question.id]: response };
    setResponses(newResponses);

    const isLastQuestion = currentQuestionIndex === assessment.questions.length - 1;
    const isLastAssessment = currentAssessmentIndex === ASSESSMENT_ORDER.length - 1;
    await advanceAfterAnswer(assessmentId, newResponses, isLastQuestion, isLastAssessment);
  }

  async function handleBack() {
    if (saving || finishing) return;

    if (currentQuestionIndex > 0) {
      const assessmentId = ASSESSMENT_ORDER[currentAssessmentIndex];
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      await persistProgress(assessmentId, prevIndex, responses);
      return;
    }

    if (currentAssessmentIndex > 0) {
      const prevAssessmentId = ASSESSMENT_ORDER[currentAssessmentIndex - 1];
      const prevAssessment = ASSESSMENTS[prevAssessmentId];
      const lastIndex = prevAssessment.questions.length - 1;
      const prevResponses = await loadSavedResponsesForAssessment(prevAssessmentId);

      setCurrentAssessmentIndex((prev) => prev - 1);
      setCurrentQuestionIndex(lastIndex);
      setResponses(prevResponses);
      await persistProgress(prevAssessmentId, lastIndex, prevResponses);
      return;
    }

    if (currentAssessmentIndex === 0 && currentQuestionIndex === 0) {
      if (interviewAlreadyCompleted && userId) {
        navigation.replace('InterviewComplete', { userId });
        return;
      }
      setCameFromAssessments(true);
      setShowWelcome(!PSYCHOMETRICS_ENABLED);
    }
  }

  function handleWelcomeContinue() {
    if (needsMarketResearch) return;
    setShowWelcome(false);
    setCameFromAssessments(false);
    if (!cameFromAssessments && currentAssessmentIndex === 0 && currentQuestionIndex === 0) {
      void persistProgress('brs', 0, {});
    }
  }

  function handleWelcomeBack() {
    setShowWelcome(false);
    setCameFromAssessments(false);
  }

  function handleMarketResearchComplete() {
    notifyMarketResearchComplete();
    setNeedsMarketResearch(false);
    if (interviewAlreadyCompleted) {
      setShowWelcome(false);
      void persistPsychometricProgress(userId, 'brs', 0, {});
    }
  }

  const openAdminPanel = isAdminUser ? () => setShowAdminPanel(true) : undefined;

  if (showAdminPanel && isAdminUser) {
    return <AdminInterviewDashboard onClose={() => setShowAdminPanel(false)} />;
  }

  if (loading || finishing) {
    return (
      <SafeAreaContainer style={styles.container}>
        {openAdminPanel ? <PsychometricsAdminPanelButton onPress={openAdminPanel} /> : null}
        <ActivityIndicator size="large" color={PSYCHOMETRICS_ACCENT} style={styles.loader} />
        {finishing ? (
          <Text style={styles.finishingText}>Saving your results…</Text>
        ) : null}
      </SafeAreaContainer>
    );
  }

  if (showWelcome) {
    if (needsMarketResearch && userId) {
      return (
        <MarketResearchModal
          visible
          userId={userId}
          onComplete={handleMarketResearchComplete}
        />
      );
    }
    return (
      <WelcomeModal
        visible
        variant="psychometricsFirst"
        onContinue={handleWelcomeContinue}
        onOpenAdminPanel={openAdminPanel}
        onBackPress={cameFromAssessments ? handleWelcomeBack : undefined}
      />
    );
  }

  const assessmentId = ASSESSMENT_ORDER[currentAssessmentIndex];
  const assessment = ASSESSMENTS[assessmentId];
  const question = assessment?.questions[currentQuestionIndex];
  const isForcedChoice = assessment != null && isForcedChoiceAssessment(assessment);
  const forcedChoiceQuestion = isForcedChoice ? assessment.questions[currentQuestionIndex] : null;
  const shuffledNpiPair = forcedChoiceQuestion
    ? shuffleNpiPair(forcedChoiceQuestion, sessionSeed)
    : null;

  if (!assessment || !question) {
    return (
      <SafeAreaContainer style={styles.container}>
        <ActivityIndicator size="large" color={PSYCHOMETRICS_ACCENT} style={styles.loader} />
      </SafeAreaContainer>
    );
  }
  const batteryProgress = psychometricBatteryProgressPosition(
    currentAssessmentIndex,
    currentQuestionIndex,
  );
  const questionProgress = batteryProgress.current / batteryProgress.total;

  const scaleEntries =
    !isForcedChoice && 'scale' in assessment
      ? Object.entries(assessment.scale.labels).sort(([a], [b]) => Number(a) - Number(b))
      : [];

  const selectedForcedChoice =
    typeof question.id === 'number' &&
    typeof responses[question.id] === 'object' &&
    responses[question.id] != null &&
    !Array.isArray(responses[question.id])
      ? (responses[question.id] as NpiEntitlementResponse)
      : undefined;

  const instrumentPreamble =
    !isForcedChoice &&
    'preamble' in assessment &&
    typeof assessment.preamble === 'string' &&
    assessment.preamble.length > 0 &&
    currentQuestionIndex === 0
      ? assessment.preamble
      : null;

  return (
    <SafeAreaContainer style={styles.container}>
      {openAdminPanel ? <PsychometricsAdminPanelButton onPress={openAdminPanel} /> : null}
      <ScrollView contentContainerStyle={scrollContentStyle} bounces={false}>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${questionProgress * 100}%` }]} />
        </View>

        <View style={styles.questionContainer}>
          {instrumentPreamble ? (
            <Text style={styles.preambleText}>{instrumentPreamble}</Text>
          ) : null}
          {isForcedChoice ? (
            <Text style={[styles.questionText, narrowViewport && styles.questionTextNarrow]}>
              {assessment.description}
            </Text>
          ) : question.scenario && question.response ? (
            <>
              <Text style={styles.scenarioText}>{question.scenario}</Text>
              <Text style={styles.responsePrompt}>{question.response}</Text>
            </>
          ) : (
            <Text style={[styles.questionText, narrowViewport && styles.questionTextNarrow]}>
              {question.text}
            </Text>
          )}
        </View>

        <View style={styles.optionsContainer}>
          {isForcedChoice && shuffledNpiPair
            ? [shuffledNpiPair.first, shuffledNpiPair.second].map((opt, displayIdx) => {
                const displayIndex = displayIdx as 0 | 1;
                const isSelected = selectedForcedChoice?.selectedOptionIndex === displayIndex;
                return (
                  <Pressable
                    key={`${question.id}-${displayIndex}`}
                    style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                    onPress={() =>
                      void handleForcedChoiceAnswer(displayIndex, opt.isEntitlement)
                    }
                    disabled={saving}
                  >
                    <Text style={styles.optionText}>{opt.text}</Text>
                  </Pressable>
                );
              })
            : scaleEntries.map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={styles.optionButton}
                  onPress={() => void handleAnswer(Number(value))}
                  disabled={saving}
                >
                  <Text style={styles.optionText}>{label}</Text>
                </TouchableOpacity>
              ))}
          <PsychometricsBackButton
            variant="inline"
            onPress={() => void handleBack()}
            disabled={saving || finishing}
          />
        </View>

        {saving ? <ActivityIndicator size="small" color={PSYCHOMETRICS_ACCENT} style={styles.savingSpinner} /> : null}
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
  },
  loader: {
    marginTop: 48,
  },
  finishingText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: '#7A9ABE',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  progressBar: {
    height: '100%',
    backgroundColor: PSYCHOMETRICS_ACCENT,
    borderRadius: 2,
  },
  questionContainer: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  preambleText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    color: '#7A9ABE',
    lineHeight: 21,
    textAlign: 'left',
    marginBottom: spacing.md,
  },
  questionText: {
    fontFamily: PSYCHOMETRICS_FONT_DISPLAY,
    fontSize: 22,
    fontWeight: '500',
    color: '#F4F8FC',
    lineHeight: 30,
    textAlign: 'left',
  },
  questionTextNarrow: {
    fontSize: 20,
    lineHeight: 28,
  },
  scenarioText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 16,
    color: '#B8C9DC',
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 12,
  },
  responsePrompt: {
    fontFamily: PSYCHOMETRICS_FONT_DISPLAY,
    fontSize: 20,
    fontWeight: '500',
    color: '#F4F8FC',
    lineHeight: 28,
    textAlign: 'left',
  },
  optionsContainer: {
    gap: 10,
    alignSelf: 'stretch',
  },
  optionButton: {
    borderWidth: 1,
    borderColor: PSYCHOMETRICS_GLASS_BORDER,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionButtonSelected: {
    borderColor: PSYCHOMETRICS_ACCENT,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: '#E8F0F8',
    textAlign: 'left',
  },
  savingSpinner: {
    marginTop: 16,
  },
});
