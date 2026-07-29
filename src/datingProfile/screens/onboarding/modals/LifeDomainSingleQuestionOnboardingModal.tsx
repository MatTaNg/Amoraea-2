import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceModal } from './SingleChoiceModal';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  findLifeDomainQuestionDef,
  getLifeDomainOnboardingMeta,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import { styles } from './LifeDomainQuestionsModal.styled';

interface Props {
  domainId: LifeDomainId;
  questionId: string;
  value: string;
  onValueChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const LifeDomainSingleQuestionOnboardingModal: React.FC<Props> = ({
  domainId,
  questionId,
  value,
  onValueChange,
  onNext,
  onBack,
}) => {
  const question = findLifeDomainQuestionDef(domainId, questionId);
  const domainMeta = getLifeDomainOnboardingMeta(domainId);

  if (!question) {
    return null;
  }

  if (question.input === 'dropdown' && question.options?.length) {
    const options = question.options
      .filter((o) => o.value.trim() !== '')
      .map((o) => ({ label: o.label, value: o.value }));

    return (
      <SingleChoiceModal
        title={question.text}
        options={options}
        value={value}
        onValueChange={onValueChange}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  const canContinue = value.trim().length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title={`${domainMeta.icon} ${domainMeta.name}`} onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.questionText}>{question.text}</Text>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onValueChange}
            placeholder="Required — share your answer here"
            placeholderTextColor="rgba(123,154,190,0.65)"
            multiline={question.multiline !== false}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button
            title="Next"
            onPress={onNext}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
