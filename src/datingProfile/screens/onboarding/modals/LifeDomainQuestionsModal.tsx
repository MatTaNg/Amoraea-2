import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, FlatList, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './LifeDomainQuestionsModal.styled';
import {
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  countAnsweredInDomain,
  isLifeDomainAnswerFilled,
  getLifeDomainOnboardingMeta,
  getOptionalOpenEndedQuestionsForDomain,
  isLifeDomainQuestionRequiredForOnboarding,
  validateLifeDomainStep,
  type LifeDomainId,
  type LifeDomainQuestionDef,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  fetchLifeDomainAnswersMap,
  saveLifeDomainAnswersFromOnboarding,
  syncLifeDomainImportanceFromOnboarding,
  type LifeDomainAnswersMap,
  type OnboardingLifeDomainsSliders,
} from '@/screens/profile/editProfile/lifeDomainProfileService';
import { AppSelect } from '@/shared/ui/AppSelect';
import { deferAfterNavigationPaint } from '@/shared/utils/deferAfterPaint';

function QuestionSeparator() {
  return <View style={styles.questionSeparator} />;
}

function mergeLifeDomainAnswerMaps(
  fromDb: LifeDomainAnswersMap,
  seed: LifeDomainAnswersMap | undefined,
): LifeDomainAnswersMap {
  const merged: LifeDomainAnswersMap = { ...fromDb };
  for (const id of Object.keys(seed ?? {}) as LifeDomainId[]) {
    merged[id] = { ...merged[id], ...seed![id] };
  }
  return merged;
}

interface LifeDomainQuestionsModalProps {
  userId: string;
  domainId: LifeDomainId;
  lifeDomains?: OnboardingLifeDomainsSliders;
  initialAnswers?: LifeDomainAnswersMap;
  onAnswersChange?: (answers: LifeDomainAnswersMap) => void;
  /** Profile `wantKids` — drives conditional required questions (e.g. raising children in faith). */
  wantKids?: string | null;
  /** When true, blocks Next until required questions are answered (onboarding only). */
  enforceRequired?: boolean;
  /** Show only unanswered optional follow-up questions (post-slider onboarding). */
  optionalOpenEndedLeftover?: boolean;
  onNext: () => void;
  onBack: () => void;
}

export const LifeDomainQuestionsModal: React.FC<LifeDomainQuestionsModalProps> = ({
  userId,
  domainId,
  lifeDomains,
  initialAnswers,
  onAnswersChange,
  wantKids,
  enforceRequired = true,
  optionalOpenEndedLeftover = false,
  onNext,
  onBack,
}) => {
  const domainMeta = getLifeDomainOnboardingMeta(domainId);
  const [answers, setAnswers] = useState<LifeDomainAnswersMap>(() =>
    mergeLifeDomainAnswerMaps({}, initialAnswers),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [questionSuggestion, setQuestionSuggestion] = useState('');
  const answersBaselineRef = useRef<LifeDomainAnswersMap>({});
  const draftSeedRef = useRef(initialAnswers);

  draftSeedRef.current = initialAnswers;

  useEffect(() => {
    setQuestionSuggestion('');
  }, [domainId, userId]);

  const didSyncSeedRef = useRef(false);
  useEffect(() => {
    if (!didSyncSeedRef.current) {
      didSyncSeedRef.current = true;
      answersBaselineRef.current = answers;
      return;
    }
    const merged = mergeLifeDomainAnswerMaps({}, draftSeedRef.current);
    setAnswers(merged);
    answersBaselineRef.current = merged;
    // Seed is already applied in useState; repeating it on mount re-renders every field.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- answers is the initial snapshot only
  }, [domainId, initialAnswers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (lifeDomains && domainId === 'finance') {
          void syncLifeDomainImportanceFromOnboarding(userId, lifeDomains).catch((e) => {
            if (__DEV__) console.warn('[LifeDomainQuestionsModal] finance importance sync', e);
          });
        }
        const fromDb = await fetchLifeDomainAnswersMap(userId);
        if (cancelled) return;
        const merged = mergeLifeDomainAnswerMaps(fromDb, draftSeedRef.current);
        setAnswers(merged);
        answersBaselineRef.current = merged;
      } catch (e) {
        if (__DEV__) console.warn('[LifeDomainQuestionsModal] load', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [domainId, lifeDomains, userId]);

  const questions = useMemo(() => {
    if (optionalOpenEndedLeftover) {
      return getOptionalOpenEndedQuestionsForDomain(domainId, { wantKids });
    }
    const all = LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId] ?? [];
    if (!enforceRequired) return all;
    return all.filter((q) => isLifeDomainQuestionRequiredForOnboarding(q, { wantKids }));
  }, [domainId, optionalOpenEndedLeftover, wantKids, enforceRequired]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setValidationError(null);
    setAnswers((prev) => ({
      ...prev,
      [domainId]: { ...prev[domainId], [questionId]: value },
    }));
  }, [domainId]);

  const handleBack = useCallback(() => {
    onAnswersChange?.(answers);
    answersBaselineRef.current = answers;
    onBack();
  }, [answers, onAnswersChange, onBack]);

  const handleNext = () => {
    const domainAnswers = answers[domainId] ?? {};
    const validation = validateLifeDomainStep(domainId, domainAnswers, {
      enforceRequired,
      wantKids,
    });
    if (!validation.valid) {
      const labels = validation.missingQuestions.map((q) => q.text).join('\n• ');
      setValidationError(`Please answer all required questions:\n• ${labels}`);
      return;
    }

    const snapshot = answers;
    onAnswersChange?.(snapshot);
    onNext();

    const uid = userId;
    const domains = lifeDomains;
    const domain = domainId;
    deferAfterNavigationPaint(() => {
      answersBaselineRef.current = snapshot;
      void (async () => {
        try {
          if (domains && domain === 'finance') {
            await syncLifeDomainImportanceFromOnboarding(uid, domains);
          }
          await saveLifeDomainAnswersFromOnboarding(uid, snapshot);
        } catch (e) {
          if (__DEV__) console.warn('[LifeDomainQuestionsModal] save', e);
        }
      })();
    });
  };

  const questionLabelSuffix = (q: LifeDomainQuestionDef) => {
    if (q.explicitlyOptional) return '(optional)';
    if (isLifeDomainQuestionRequiredForOnboarding(q, { wantKids })) return '(required)';
    return null;
  };

  const textPlaceholder = (q: LifeDomainQuestionDef) => {
    if (q.explicitlyOptional) {
      return 'Optional — you can skip this question';
    }
    if (isLifeDomainQuestionRequiredForOnboarding(q, { wantKids })) {
      return 'Required — share your answer here';
    }
    return 'Optional — share as much or as little as you like';
  };

  const renderQuestion = (q: LifeDomainQuestionDef) => {
    const value = answers[domainId]?.[q.id] ?? '';
    const suffix = questionLabelSuffix(q);
    if (q.input === 'dropdown' && q.options?.length) {
      return (
        <View key={q.id} style={styles.questionBlock}>
          <View style={styles.questionTextRow}>
            <Text style={styles.questionText}>{q.text}</Text>
            {suffix ? (
              <Text
                style={
                  q.explicitlyOptional ? styles.optionalBadge : styles.requiredBadge
                }
              >
                {suffix}
              </Text>
            ) : null}
          </View>
          <AppSelect
            bare
            value={value}
            options={q.options}
            onValueChange={(picked) => setAnswer(q.id, picked)}
            allowUnset
            unsetLabel="Select an option"
            placeholder="Select an option"
            sheetTitle={q.text}
          />
        </View>
      );
    }

    return (
      <View key={q.id} style={styles.questionBlock}>
        <View style={styles.questionTextRow}>
          <Text style={styles.questionText}>{q.text}</Text>
          {suffix ? (
            <Text style={q.explicitlyOptional ? styles.optionalBadge : styles.requiredBadge}>
              {suffix}
            </Text>
          ) : null}
        </View>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={(t) => setAnswer(q.id, t)}
          placeholder={textPlaceholder(q)}
          placeholderTextColor="rgba(123,154,190,0.65)"
          multiline={q.multiline !== false}
          textAlignVertical="top"
        />
      </View>
    );
  };

  const domainAnswers = answers[domainId] ?? {};

  const { answered, total } = useMemo(() => {
    if (optionalOpenEndedLeftover) {
      // For progress count, we still want to filter the current questions list to see which of them are answered
      const answeredCount = questions.filter((q) => isLifeDomainAnswerFilled(domainAnswers[q.id])).length;
      return { answered: answeredCount, total: questions.length };
    }
    return countAnsweredInDomain(domainId, domainAnswers, {
      wantKids,
      countRequiredOnly: enforceRequired,
    });
  }, [domainAnswers, domainId, wantKids, enforceRequired, optionalOpenEndedLeftover, questions]);

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader
        title={`${domainMeta.icon} ${domainMeta.name}`}
        onBack={handleBack}
      />
      <FlatList
        data={questions}
        keyExtractor={(q) => q.id}
        renderItem={({ item }) => renderQuestion(item)}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, styles.container]}
        keyboardShouldPersistTaps="always"
        initialNumToRender={typeof jest === 'undefined' ? 2 : questions.length}
        maxToRenderPerBatch={typeof jest === 'undefined' ? 2 : questions.length}
        windowSize={5}
        updateCellsBatchingPeriod={32}
        ItemSeparatorComponent={QuestionSeparator}
        ListHeaderComponent={
          !optionalOpenEndedLeftover || validationError ? (
            <View>
              {!optionalOpenEndedLeftover ? (
                <Text style={styles.domainMeta}>
                  {answered} of {total} required answered on this step
                </Text>
              ) : null}
              {validationError ? (
                <Text style={styles.validationError}>{validationError}</Text>
              ) : null}
            </View>
          ) : null
        }
      />

      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            immediate
            style={styles.backButton}
          />
          <Button
            title="Next"
            onPress={handleNext}
            immediate
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
