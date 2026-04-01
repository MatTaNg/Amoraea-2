import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { EditProfileModal } from '@ui/components/EditProfileModal';
import { ProfileTestsSummary } from '@ui/components/ProfileTestsSummary';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { useProfileCompletion } from '@features/profile/hooks/useProfileCompletion';

const profileRepository = new ProfileRepository();

export const HomeScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const profileLog = (...args: unknown[]) => {
    if (__DEV__) console.log('[HomeProfile]', ...args);
  };

  const {
    data: profile,
    isLoading: isProfileLoading,
    isFetching: isProfileFetching,
    error: profileError,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
  });
  const {
    data: completion,
    isLoading: isCompletionLoading,
    isFetching: isCompletionFetching,
    error: completionError,
  } = useProfileCompletion(userId);
  const isComplete = completion?.isComplete ?? false;

  useEffect(() => {
    profileLog('query state', {
      userId,
      isProfileLoading,
      isProfileFetching,
      hasProfile: !!profile,
      onboardingStage: profile?.onboardingStage ?? null,
      profileError: profileError instanceof Error ? profileError.message : profileError ? String(profileError) : null,
    });
  }, [userId, isProfileLoading, isProfileFetching, profile, profileError]);

  useEffect(() => {
    profileLog('completion state', {
      isCompletionLoading,
      isCompletionFetching,
      isComplete,
      completedCount: completion?.completedCount ?? null,
      totalCount: completion?.totalCount ?? null,
      completionError: completionError instanceof Error ? completionError.message : completionError ? String(completionError) : null,
    });
  }, [isCompletionLoading, isCompletionFetching, isComplete, completion?.completedCount, completion?.totalCount, completionError]);

  const handleCopyInviteCode = async () => {
    if (profile?.inviteCode) {
      await Clipboard.setStringAsync(profile.inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  return (
    <SafeAreaContainer>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.profileSection}>
            {profile?.primaryPhotoUrl ? (
              <Image source={{ uri: profile.primaryPhotoUrl }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={32} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name || 'User'}</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(true)}
                style={styles.editButton}
              >
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {profile?.inviteCode && (
          <TouchableOpacity style={styles.inviteCodeBanner} onPress={handleCopyInviteCode} activeOpacity={0.8}>
            <View style={styles.inviteCodeContent}>
              <Text style={styles.inviteCodeLabel}>Your invite code</Text>
              <Text style={styles.inviteCodeValue}>{profile.inviteCode}</Text>
              <Text style={styles.inviteCodeHint}>Tap to copy • Share with friends</Text>
            </View>
            <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {isComplete && (
          <View style={styles.progressSection}>
            <View style={styles.completeBanner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.completeMessage}>We are now looking for a match for you</Text>
            </View>
          </View>
        )}

        <ProfileTestsSummary profile={profile} />
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        userId={userId}
        profile={profile}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          queryClient.invalidateQueries({ queryKey: ['profileCompletion', userId] });
          queryClient.invalidateQueries({ queryKey: ['compatibility', userId] });
        }}
      />
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inviteCodeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.primary + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inviteCodeContent: {
    flex: 1,
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviteCodeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 2,
  },
  inviteCodeHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: spacing.md,
  },
  profileImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  progressSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  completeMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
});

