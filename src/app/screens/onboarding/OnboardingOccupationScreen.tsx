import React from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { occupationSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { TextInput } from '@ui/components/TextInput';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';

export const OnboardingOccupationScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(occupationSchema),
    defaultValues: { occupation: state.occupation || '' },
  });

  const occupationValue = watch('occupation');

  React.useEffect(() => {
    register('occupation');
    if (state.occupation) {
      setValue('occupation', state.occupation);
    }
  }, [register, setValue, state.occupation]);

  const onSubmit = async (data: { occupation: string }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { occupation: data.occupation },
      });
      navigation.navigate('OnboardingLocation');
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
            <Text style={styles.title}>What's your occupation?</Text>
            <Text style={styles.subtitle}>Tell us what you do</Text>

            <TextInput
              label="Occupation"
              value={occupationValue}
              onChangeText={(text) => setValue('occupation', text)}
              placeholder="Enter your occupation"
              error={errors.occupation?.message}
            />
          </View>
        </ScrollView>
        <OnboardingNavigation
          onBack={onBack}
          onNext={onNext}
          canGoBack={canGoBack}
          nextDisabled={!occupationValue || occupationValue.trim().length === 0}
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

