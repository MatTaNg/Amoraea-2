import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, ScrollView, Text, TextInput } from 'react-native';
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
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';

type PickerSheet = {
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onPick: (value: string) => void;
  anchor?: OptionAnchor;
};

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
  const [pickerSheet, setPickerSheet] = useState<PickerSheet | null>(null);
  const [questionSuggestion, setQuestionSuggestion] = useState('');
  const answersBaselineRef = useRef<LifeDomainAnswersMap>({});
  const draftSeedRef = useRef(initialAnswers);

  draftSeedRef.current = initialAnswers;

  useEffect(() => {
    setQuestionSuggestion('');
  }, [domainId, userId]);

  useEffect(() => {
    const merged = mergeLifeDomainAnswerMaps({}, draftSeedRef.current);
    setAnswers(merged);
    answersBaselineRef.current = JSON.parse(JSON.stringify(merged)) as LifeDomainAnswersMap;
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
        answersBaselineRef.current = JSON.parse(JSON.stringify(merged)) as LifeDomainAnswersMap;
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
    answersBaselineRef.current = JSON.parse(JSON.stringify(answers)) as LifeDomainAnswersMap;
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

    answersBaselineRef.current = JSON.parse(JSON.stringify(answers)) as LifeDomainAnswersMap;
    onAnswersChange?.(answers);
    onNext();

    void (async () => {
      try {
        if (lifeDomains && domainId === 'finance') {
          await syncLifeDomainImportanceFromOnboarding(userId, lifeDomains);
        }
        await saveLifeDomainAnswersFromOnboarding(userId, answers);
      } catch (e) {
        if (__DEV__) console.warn('[LifeDomainQuestionsModal] save', e);
      }
    })();
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
      const optionRows = [
        { label: 'Select an option', value: '' },
        ...q.options,
      ];
      const selectedLabel =
        optionRows.find((o) => o.value === value)?.label ?? 'Select an option';

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
          <OptionPickerTrigger
            style={styles.dropdownTrigger}
            onOpen={(anchor) =>
              setPickerSheet({
                title: q.text,
                options: optionRows,
                selectedValue: value,
                anchor,
                onPick: (picked) => setAnswer(q.id, picked),
              })
            }
          >
            <SelectTriggerRow
              label={selectedLabel}
              isPlaceholder={!value}
              labelStyle={styles.dropdownTriggerText}
              placeholderStyle={styles.dropdownPlaceholder}
            />
          </OptionPickerTrigger>
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            {optionalOpenEndedLeftover
              ? 'Optional: share more about this life area if you like. You can skip any question and tap Next.'
              : 'Answer each required question for this life area to continue. You can add more detail later from your profile.'}
          </Text>
          {!optionalOpenEndedLeftover ? (
            <Text style={styles.domainMeta}>
              {answered} of {total} required answered on this step
            </Text>
          ) : null}
          {validationError ? (
            <Text style={styles.validationError}>{validationError}</Text>
          ) : null}
          <View style={styles.domainBody}>{questions.map((q) => renderQuestion(q))}</View>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            style={styles.backButton}
          />
          <Button
            title="Next"
            onPress={handleNext}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>

      <BottomSheet
        visible={!!pickerSheet}
        title={pickerSheet?.title}
        anchor={pickerSheet?.anchor}
        onClose={() => setPickerSheet(null)}
      >
        {pickerSheet ? (
          <SingleChoiceOptionList
            options={pickerSheet.options}
            value={pickerSheet.selectedValue}
            onSelect={(next) => {
              pickerSheet.onPick(next);
              setPickerSheet(null);
            }}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
};
