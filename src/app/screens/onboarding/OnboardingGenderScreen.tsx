import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { genderSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { SelectButton } from '@ui/components/SelectButton';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';
import { Gender } from '@domain/models/Profile';

export const OnboardingGenderScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(genderSchema),
    defaultValues: { gender: state.gender || undefined },
  });

  const selectedGender = watch('gender');

  React.useEffect(() => {
    register('gender');
    if (state.gender) {
      setValue('gender', state.gender);
    }
  }, [register, setValue, state.gender]);

  const onSubmit = async (data: { gender: Gender }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { gender: data.gender },
      });
      navigation.navigate('OnboardingAttractedTo');
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

  const genders: Gender[] = ['Man', 'Woman', 'Non-binary'];

  return (
    <SafeAreaContainer>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>What's your gender?</Text>
          <Text style={styles.subtitle}>Select the option that best describes you</Text>

          {genders.map((gender) => (
            <SelectButton
              key={gender}
              label={gender}
              selected={selectedGender === gender}
              onPress={() => setValue('gender', gender, { shouldValidate: true })}
            />
          ))}

          {errors.gender && <Text style={styles.errorText}>{errors.gender.message}</Text>}
        </View>
      </ScrollView>
      <OnboardingNavigation
        onBack={onBack}
        onNext={onNext}
        canGoBack={canGoBack}
        nextDisabled={!selectedGender}
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

