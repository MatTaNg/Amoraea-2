import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { ProfileUseCase } from '@domain/useCases/ProfileUseCase';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

const profileRepository = new ProfileRepository();
const profileUseCase = new ProfileUseCase(profileRepository);

export const EditProfileScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { userId } = route.params;
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileUseCase.getProfile(userId),
  });

  // This is a placeholder screen. In a real app, you would have proper form fields here
  // to edit all the onboarding fields (name, age, gender, etc.)

  return (
    <SafeAreaContainer>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.placeholderText}>
            Edit Profile Screen - This is a placeholder. In a real app, you would have form fields
            to edit name, age, gender, attracted to, height, occupation, location, and photos.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  content: {
    marginTop: spacing.xl,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

