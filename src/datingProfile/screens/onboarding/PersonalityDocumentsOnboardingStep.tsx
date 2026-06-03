import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonalityDocumentsUpload } from '@/features/profile/PersonalityDocumentsUpload';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/theme';

interface Props {
  userId: string;
  onNext: () => void;
  onBack?: () => void;
}

/** Optional personality-documents step at the end of modal profile onboarding. */
export function PersonalityDocumentsOnboardingStep({ userId, onNext, onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          ) : null}

          <PersonalityDocumentsUpload userId={userId} showOptionalNote />

          <View style={styles.actions}>
            <Button title="Continue →" onPress={onNext} variant="solid" />
            <TouchableOpacity onPress={onNext} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexGrow: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 4,
  },
  backText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
