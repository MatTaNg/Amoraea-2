import React, { useState } from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ageSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { TextInput } from '@ui/components/TextInput';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';

export const OnboardingAgeScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(ageSchema),
    defaultValues: { age: state.age || undefined },
  });

  const ageValue = watch('age');

  React.useEffect(() => {
    register('age');
    if (state.age) {
      setValue('age', state.age);
    }
  }, [register, setValue, state.age]);

  const onSubmit = async (data: { age: number }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { age: data.age },
      });
      navigation.navigate('OnboardingGender');
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

  const handleAgeChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      setValue('age', num, { shouldValidate: true });
    } else if (text === '') {
      setValue('age', undefined, { shouldValidate: false });
    }
  };

  return (
    <SafeAreaContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>How old are you?</Text>
            <Text style={styles.subtitle}>You must be at least 18 years old</Text>

            <TextInput
              label="Age"
              value={ageValue?.toString() || ''}
              onChangeText={handleAgeChange}
              placeholder="Enter your age"
              keyboardType="numeric"
              error={errors.age?.message}
            />
          </View>
        </ScrollView>
        <OnboardingNavigation
          onBack={onBack}
          onNext={onNext}
          canGoBack={canGoBack}
          nextDisabled={!ageValue || ageValue < 18}
          nextLoading={isLoading}
        />
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
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
});

