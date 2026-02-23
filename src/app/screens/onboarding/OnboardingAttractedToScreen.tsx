import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { attractedToSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';
import { AttractedToOption } from '@domain/models/Profile';

export const OnboardingAttractedToScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(attractedToSchema),
    defaultValues: { attractedTo: state.attractedTo || [] },
  });

  const selectedOptions = watch('attractedTo') || [];

  React.useEffect(() => {
    register('attractedTo');
    if (state.attractedTo) {
      setValue('attractedTo', state.attractedTo);
    }
  }, [register, setValue, state.attractedTo]);

  const onSubmit = async (data: { attractedTo: AttractedToOption[] }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { attractedTo: data.attractedTo },
      });
      navigation.navigate('OnboardingHeight');
    } catch (error) {
      // Error handling
    }
  };

  const onNext = () => {
    handleSubmit(onSubmit)();
  };

  const onBack = () => {
    navigation.goBack();
  };

  const toggleOption = (option: AttractedToOption) => {
    const current = selectedOptions;
    const newSelection = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('attractedTo', newSelection, { shouldValidate: true });
  };

  const options: AttractedToOption[] = ['Men', 'Women', 'Non-binary'];

  return (
    <SafeAreaContainer>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Who are you attracted to?</Text>
          <Text style={styles.subtitle}>Select all that apply</Text>

          {options.map((option) => (
            <MultiSelectButton
              key={option}
              label={option}
              selected={selectedOptions.includes(option)}
              onPress={() => toggleOption(option)}
            />
          ))}

          {errors.attractedTo && <Text style={styles.errorText}>{errors.attractedTo.message}</Text>}
        </View>
      </ScrollView>
      <OnboardingNavigation
        onBack={onBack}
        onNext={onNext}
        canGoBack={canGoBack}
        nextDisabled={selectedOptions.length === 0}
        nextLoading={isLoading}
      />
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: spacing.sm,
  },
});

