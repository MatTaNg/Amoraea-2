import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { renderDealbreakerQuestionHighlight } from '@/shared/components/profileFields/dealbreakerQuestionHighlight';
import { deferAfterPaint } from '@/shared/utils/deferAfterPaint';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './SingleChoiceModal.styled';

export interface ChoiceOption {
  label: string;
  value: string;
}

function renderDealbreakerHighlight(text: string) {
  return renderDealbreakerQuestionHighlight(text, styles.dealbreakerEmphasis);
}

interface SingleChoiceModalProps {
  title: string;
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  description?: string;
  secondaryTitle?: string;
  secondaryOptions?: ChoiceOption[];
  secondaryValue?: string;
  onSecondaryValueChange?: (value: string) => void;
  secondaryRequired?: boolean;
  /** When true, selecting an option immediately saves and advances to next step (no Next button). */
  autoAdvanceOnSelect?: boolean;
}

export const SingleChoiceModal: React.FC<SingleChoiceModalProps> = ({
  title,
  options,
  value,
  onValueChange,
  onNext,
  onBack,
  description,
  secondaryTitle,
  secondaryOptions,
  secondaryValue = '',
  onSecondaryValueChange,
  secondaryRequired = false,
  autoAdvanceOnSelect = true,
}) => {
  const hasSecondaryQuestion = Boolean(secondaryTitle && secondaryOptions?.length && onSecondaryValueChange);
  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    if (autoAdvanceOnSelect && !hasSecondaryQuestion) {
      deferAfterPaint(onNext);
    }
  };
  const hasPrimarySelection = options.some((option) => option.value === value);
  const hasSecondarySelection =
    !secondaryRequired ||
    Boolean(
      hasSecondaryQuestion &&
        secondaryOptions?.some((option) => option.value === secondaryValue),
    );
  const nextDisabled = !hasPrimarySelection || !hasSecondarySelection;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title={title} onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <SingleChoiceOptionList options={options} value={value} onSelect={handleSelect} />
          {hasSecondaryQuestion ? (
            <View style={styles.secondaryQuestionBlock}>
              <Text style={styles.secondaryQuestionTitle}>
                {renderDealbreakerHighlight(secondaryTitle ?? '')}
              </Text>
              <SingleChoiceOptionList
                options={secondaryOptions}
                value={secondaryValue}
                onSelect={(optionValue) => onSecondaryValueChange?.(optionValue)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
      {!autoAdvanceOnSelect || hasSecondaryQuestion ? (
        <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
          <View style={styles.buttonRow}>
            <Button
              title="Back"
              variant="outline"
              onPress={onBack}
              style={styles.backButton}
            />
            <Button
              title="Next"
              onPress={onNext}
              disabled={nextDisabled}
              style={styles.nextButton}
            />
          </View>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
          <View style={styles.buttonRow}>
            <Button
              title="Back"
              variant="outline"
              onPress={onBack}
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
};
