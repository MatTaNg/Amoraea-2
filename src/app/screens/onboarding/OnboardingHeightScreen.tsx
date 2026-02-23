import React from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { heightSchema } from '@utilities/validation/onboardingSchemas';
import { ProgressBar } from '@ui/components/ProgressBar';
import { TextInput } from '@ui/components/TextInput';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';

export const OnboardingHeightScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(heightSchema),
    defaultValues: { heightCentimeters: state.heightCentimeters || undefined },
  });

  const heightValue = watch('heightCentimeters');

  React.useEffect(() => {
    register('heightCentimeters');
    if (state.heightCentimeters) {
      setValue('heightCentimeters', state.heightCentimeters);
    }
  }, [register, setValue, state.heightCentimeters]);

  const onSubmit = async (data: { heightCentimeters: number }) => {
    try {
      await updateStep({
        step: currentStep + 1,
        update: { heightCentimeters: data.heightCentimeters },
      });
      navigation.navigate('OnboardingOccupation');
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

  const handleHeightChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      setValue('heightCentimeters', num, { shouldValidate: true });
    } else if (text === '') {
      setValue('heightCentimeters', undefined, { shouldValidate: false });
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
            <Text style={styles.title}>What's your height?</Text>
            <Text style={styles.subtitle}>Enter your height in centimeters</Text>

            <TextInput
              label="Height (cm)"
              value={heightValue?.toString() || ''}
              onChangeText={handleHeightChange}
              placeholder="Enter your height"
              keyboardType="numeric"
              error={errors.heightCentimeters?.message}
            />
          </View>
        </ScrollView>
        <OnboardingNavigation
          onBack={onBack}
          onNext={onNext}
          canGoBack={canGoBack}
          nextDisabled={!heightValue || heightValue < 100 || heightValue > 250}
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

