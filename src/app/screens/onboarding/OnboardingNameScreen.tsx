import React, { useState } from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { nameSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { TextInput } from '@ui/components/TextInput';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';

export const OnboardingNameScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: state.name || '' },
  });

  const nameValue = watch('name');

  React.useEffect(() => {
    register('name');
    if (state.name) {
      setValue('name', state.name);
    }
  }, [register, setValue, state.name]);

  const onSubmit = async (data: { name: string }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { name: data.name },
      });
      navigation.navigate('OnboardingAge');
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

  return (
    <SafeAreaContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>This is how others will see you</Text>

            <TextInput
              label="Name"
              value={nameValue}
              onChangeText={(text) => setValue('name', text)}
              placeholder="Enter your name"
              error={errors.name?.message}
            />
          </View>
        </ScrollView>
        <OnboardingNavigation
          onBack={onBack}
          onNext={onNext}
          canGoBack={canGoBack}
          nextDisabled={!nameValue || nameValue.trim().length === 0}
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

