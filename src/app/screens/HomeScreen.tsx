import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { ProgressBar } from '@ui/components/ProgressBar';
import { EditProfileModal } from '@ui/components/EditProfileModal';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { useProfileCompletion } from '@features/profile/hooks/useProfileCompletion';

const profileRepository = new ProfileRepository();

interface HomeButtonProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  showArrow?: boolean;
}

interface RequirementItemProps {
  label: string;
  done: boolean;
  onPress: () => void;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ label, done, onPress }) => (
  <TouchableOpacity style={styles.requirementRow} onPress={onPress} activeOpacity={0.7}>
    <Ionicons
      name={done ? 'checkmark-circle' : 'ellipse-outline'}
      size={22}
      color={done ? colors.success : colors.textSecondary}
      style={styles.requirementIcon}
    />
    <Text style={[styles.requirementLabel, done && styles.requirementLabelDone]}>{label}</Text>
  </TouchableOpacity>
);

const HomeButton: React.FC<HomeButtonProps> = ({
  title,
  icon,
  color,
  onPress,
  disabled,
  showArrow = true,
}) => {
  return (
    <TouchableOpacity
      style={[styles.homeButton, { backgroundColor: color + '20' }, disabled && styles.homeButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={24} color={disabled ? colors.disabled : color} style={styles.buttonIcon} />
      <Text style={[styles.homeButtonText, disabled && styles.homeButtonTextDisabled]} numberOfLines={1}>
        {title}
      </Text>
      {showArrow && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={disabled ? colors.disabled : colors.textSecondary}
          style={styles.buttonArrow}
        />
      )}
    </TouchableOpacity>
  );
};

export const HomeScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
  });
  const { data: completion } = useProfileCompletion(userId);

  const totalSteps = completion?.totalCount ?? 4;
  const currentStep = completion?.completedCount ?? 0;
  const isComplete = completion?.isComplete ?? false;

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

        <View style={styles.progressSection}>
          <Text style={styles.requirementsTitle}>To complete your profile and start matching:</Text>
          <View style={styles.requirementsList}>
            <RequirementItem
              label="Complete Compatibility Assessment (ECR, TIPI, DSI, BRS, PVQ)"
              done={!!completion?.hasFullAssessment}
              onPress={() => navigation.navigate('FullAssessment', { userId })}
            />
            <RequirementItem
              label="Fill out Compatibility"
              done={completion?.hasCompatibility ?? false}
              onPress={() => navigation.navigate('Compatibility', { userId })}
            />
          </View>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>{currentStep} / {totalSteps} complete</Text>
          </View>
          <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
          {isComplete && (
            <View style={styles.completeBanner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.completeMessage}>We are now looking for a match for you</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <HomeButton
            title="Compatibility Assessment (~15m)"
            icon="analytics"
            color={colors.primary}
            onPress={() => navigation.navigate('FullAssessment', { userId })}
          />
          <HomeButton
            title="Compatibility (10m)"
            icon="people"
            color={colors.compatibility}
            onPress={() => navigation.navigate('Compatibility', { userId })}
          />
          <HomeButton
            title="Contacts (optional)"
            icon="call"
            color={colors.primary}
            onPress={() => navigation.navigate('Contacts', { userId })}
          />
          <HomeButton
            title="AI Interviewer (Voice)"
            icon="mic"
            color={colors.aiAgent}
            onPress={() => navigation.navigate('Aria', { userId })}
            showArrow={true}
          />
          <HomeButton
            title="Human Design (optional)"
            icon="planet"
            color={colors.primary}
            onPress={() => navigation.navigate('HumanDesign', { userId })}
          />
        </View>
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
  requirementsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  requirementsList: {
    marginBottom: spacing.md,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  requirementIcon: {
    marginRight: spacing.sm,
  },
  requirementLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  requirementLabelDone: {
    color: colors.text,
    textDecorationLine: 'line-through',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
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
  content: {
    padding: spacing.lg,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  homeButtonDisabled: {
    opacity: 0.5,
  },
  buttonArrow: {
    marginLeft: spacing.sm,
  },
  buttonIcon: {
    marginRight: spacing.md,
  },
  homeButtonText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  homeButtonTextDisabled: {
    color: colors.disabled,
  },
});

