import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { useProfile } from '@/shared/hooks/useProfile';
import { NameModal } from './NameModal';
import { AttractionModal } from './AttractionModal';
import { DateOfBirthModal } from './DateOfBirthModal';
import { RelationshipStyleModal } from './RelationshipStyleModal';
import { LongestRelationshipModal } from './LongestRelationshipModal';
import { LocationModal } from './LocationModal';
import { HeightWeightModal } from './HeightWeightModal';
import { SingleChoiceModal } from './SingleChoiceModal';
import { EthnicityOnboardingModal } from './EthnicityOnboardingModal';
import { EthnicityAttractionOnboardingModal } from './EthnicityAttractionOnboardingModal';
import { TypologyModal } from './TypologyModal';
import { ArchetypesOnboardingModal } from './ArchetypesOnboardingModal';
import { normalizeArchetypesFromProfile, type ArchetypeId } from '@/shared/constants/archetypes';
import { PhotosVideoModal } from './PhotosVideoModal';
import { LifeDomainsModal } from './LifeDomainsModal';
import { LifeDomainQuestionsModal } from './LifeDomainQuestionsModal';
import { LifeDomainSingleQuestionOnboardingModal } from './LifeDomainSingleQuestionOnboardingModal';
import {
  findLifeDomainQuestionStepRow,
  getActiveLifeDomainOptionalOpenEndedSteps,
  getActiveLifeDomainRequiredQuestionSteps,
  isLifeDomainRequiredQuestionStep,
  normalizeLifeDomainQuestionOnboardingStep,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  getEffectiveOnboardingStepsOrder,
  getNextOnboardingStep,
  getOnboardingNavigationContext,
  getPrevOnboardingStep,
} from './onboardingStepNavigation';
import { upsertLifeDomainAnswer } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { syncLifeDomainImportanceFromOnboarding } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { mergeAndPersistMatchPreferences } from '@/screens/profile/editProfile/matchPreferencesProfileService';
import { MatchPreferencesModal } from './MatchPreferencesModal';
import { AttractionPreferencesModal } from './AttractionPreferencesModal';
import { ProfileOnboardingCompleteModal } from '../ProfileOnboardingCompleteModal';
import { PersonalityDocumentsOnboardingStep } from '../PersonalityDocumentsOnboardingStep';
import { SexInterestsOnboardingModal } from './SexInterestsOnboardingModal';
import {
  workoutOptions,
  smokingOptions,
  drinkingOptions,
  recreationalDrugsSocialOptions,
  psychedelicsRelationshipOptions,
  cannabisRelationshipOptions,
  politicsOptions,
  religionOptions,
  haveKidsOptions,
  wantChildrenYesNoOptions,
  PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS,
} from '@/shared/constants/filterOptions';
import { modalOnboardingService } from './services/modalOnboardingService';
import { OnboardingData } from './types';
import { fetchAccountGenderDb } from '@/shared/utils/accountGender';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { mapAttractionToDb, normalizeAttractedToUiLabels } from '@/shared/utils/attractionMapper';
import {
  EDUCATION_LEVEL_CHOICES,
  ETHNICITY_CHOICES,
} from '@/screens/profile/editProfile/aboutYouOptions';
import {
  SEX_DRIVE_OPTIONS,
  DATING_PACE_AFTER_EXCITEMENT_OPTIONS,
  RECENT_DATING_EARLY_WEEKS_OPTIONS,
  SPACE_FOR_NEW_RELATIONSHIP_OPTIONS,
  PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS,
  SEXUAL_FOCUS_OPTIONS,
  PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION,
  PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS,
  prefPartnerSharesSexualInterestsFromYesNo,
  prefPartnerSharesSexualInterestsYesNoSelected,
} from '@/shared/constants/sexualCompatibilityOptions';
import { ONBOARDING_STEPS_ORDER, type OnboardingStep } from './onboardingStepOrder';
import {
  PREF_PARTNER_HAS_CHILDREN_OPTIONS,
  PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
  PREF_PARTNER_SAME_RELIGION_OPTIONS,
} from '@/screens/profile/editProfile/constants';
import {
  buildHeightWeightProfileFields,
  mapRelationshipStyleUiToDb,
  mapRelationshipStyleUiToRelationshipType,
} from '@/screens/profile/editProfile/editProfileService';

export type { OnboardingStep } from './onboardingStepOrder';

const TOTAL_STEPS = ONBOARDING_STEPS_ORDER.filter(
  (s) => s !== 'complete' && s !== 'profileComplete' && s !== 'personalityDocuments',
).length;
const PARTNER_SUBSTANCE_ALIGNMENT_CHOICES = PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS.map((label) => ({
  label,
  value: label,
}));
const PARTNER_POLITICAL_SHARING_CHOICES = PREF_PARTNER_POLITICAL_SHARING_OPTIONS.map((label) => ({
  label,
  value: label,
}));
const PARTNER_HAS_CHILDREN_CHOICES = PREF_PARTNER_HAS_CHILDREN_OPTIONS.map((label) => ({
  label,
  value: label,
}));
const PARTNER_SAME_RELIGION_CHOICES = PREF_PARTNER_SAME_RELIGION_OPTIONS.map((label) => ({
  label,
  value: label,
}));

function OnboardingProgressBar({
  currentStep,
  navigationCtx,
}: {
  currentStep: OnboardingStep;
  navigationCtx: ReturnType<typeof getOnboardingNavigationContext>;
}) {
  const steps = getEffectiveOnboardingStepsOrder(navigationCtx);
  const index = steps.indexOf(currentStep);
  const total = steps.filter(
    (s) => s !== 'complete' && s !== 'profileComplete' && s !== 'personalityDocuments',
  ).length;
  const progress =
    index < 0 ||
    currentStep === 'complete' ||
    currentStep === 'profileComplete' ||
    currentStep === 'personalityDocuments'
      ? 1
      : (index + 1) / total;
  return (
    <View style={progressBarStyles.container}>
      <View style={[progressBarStyles.fill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

const progressBarStyles = StyleSheet.create({
  container: {
    height: 4,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  fill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
});

interface ModalOnboardingFlowProps {
  onComplete: () => void;
  /** From the first step only: return user to the post-interview passed handoff screen. */
  onExitToPostInterview?: () => void;
}

export const ModalOnboardingFlow: React.FC<ModalOnboardingFlowProps> = ({
  onComplete,
  onExitToPostInterview,
}) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('name');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const isInitialLoad = React.useRef(true);
  /** Prevents double step advances on rapid taps (saves run in the background). */
  const stepTransitionLockRef = React.useRef(false);

  // Use a ref to track the latest onboarding data for saves (declare early)
  const onboardingDataRef = React.useRef<OnboardingData>(onboardingData);
  
  // Keep ref in sync with state
  React.useEffect(() => {
    onboardingDataRef.current = onboardingData;
  }, [onboardingData]);

  // Load saved progress on mount
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const progress = await modalOnboardingService.getProgress(user.id);
        if (isMounted && progress.success && progress.data) {
          // Restore saved progress
          if (progress.data.currentStep) {
            const rawStep = progress.data.currentStep;
            const normalizedStep =
              rawStep === 'complete'
                ? 'profileComplete'
                : normalizeLifeDomainQuestionOnboardingStep(
                    rawStep,
                    progress.data.onboardingData?.wantKids,
                  ) ?? rawStep;
            setCurrentStep(normalizedStep as OnboardingStep);
            if (normalizedStep !== rawStep && user?.id) {
              void modalOnboardingService.saveProgress(user.id, {
                currentStep: normalizedStep,
                onboardingData: progress.data.onboardingData ?? {},
              });
            }
          }
          if (progress.data.onboardingData) {
            // Update both state and ref
            setOnboardingData(progress.data.onboardingData);
            onboardingDataRef.current = progress.data.onboardingData;
            console.log('Loaded onboarding progress:', {
              step: progress.data.currentStep,
              dataKeys: Object.keys(progress.data.onboardingData),
              name: progress.data.onboardingData.name,
            });
          }
        }
      } catch (error) {
        console.error('Error loading onboarding progress:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          isInitialLoad.current = false;
        }
      }
    })();

    return () => {
      isMounted = false;
    };
    // Progress + step restore only once per user — do not re-run when profile fields update (avoids step reset loops).
  }, [user?.id]);

  // Prefill empty onboarding fields from profile without changing currentStep.
  useEffect(() => {
    if (!user?.id || loading || profileLoading) return;

    const mapRelationshipStyleToUi = (dbStyle: string): string | undefined => {
      const normalized = dbStyle?.trim().toLowerCase();
      const mapping: Record<string, string> = {
        monogamous: 'Monogamous',
        polyamorous: 'Polyamorous',
        'monogamous-ish': 'Monogam-ish',
        open: 'Open',
        other: 'Other',
      };
      return mapping[normalized] || undefined;
    };

    const isDefaultLifeDomains = (lifeDomains: unknown): boolean => {
      if (!lifeDomains || typeof lifeDomains !== 'object') return false;
      const ld = lifeDomains as Record<string, number>;
      return (
        ld.intimacy === 50 &&
        ld.finance === 50 &&
        ld.spirituality === 50 &&
        ld.family === 50 &&
        ld.physicalHealth === 50
      );
    };

    if (profile?.displayName?.trim()) {
      setOnboardingData((prev) => {
        if (prev.name?.trim()) return prev;
        const updated = { ...prev, name: profile.displayName };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    void (async () => {
      const genderDb =
        typeof profile?.gender === 'string' && profile.gender.trim()
          ? profile.gender
          : await fetchAccountGenderDb(user.id);
      const uiGender = genderDb ? mapGenderToUi(genderDb) : undefined;
      if (uiGender) {
        setOnboardingData((prev) => {
          if (prev.gender?.trim()) return prev;
          const updated = { ...prev, gender: uiGender };
          onboardingDataRef.current = updated;
          return updated;
        });
        if (!profile?.gender || !String(profile.gender).trim()) {
          const mapped = mapGenderToDb(uiGender);
          if (mapped) void profilesRepo.updateProfile(user.id, { gender: mapped });
        }
      }
    })();

    if ((profile as { ethnicity?: string })?.ethnicity?.trim()) {
      setOnboardingData((prev) => {
        if (prev.ethnicity?.trim()) return prev;
        const updated = { ...prev, ethnicity: String((profile as { ethnicity?: string }).ethnicity) };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    const lookingFor = (profile as { looking_for?: string[] })?.looking_for;
    if (lookingFor?.length) {
      setOnboardingData((prev) => {
        if (prev.attractedTo?.length) return prev;
        const updated = { ...prev, attractedTo: normalizeAttractedToUiLabels(lookingFor) };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (profile?.location?.trim()) {
      setOnboardingData((prev) => {
        if (prev.location?.trim()) return prev;
        const updated = { ...prev, location: profile.location };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if ((profile as { occupation?: string })?.occupation?.trim()) {
      setOnboardingData((prev) => {
        if (prev.occupation?.trim()) return prev;
        const updated = { ...prev, occupation: String((profile as { occupation?: string }).occupation) };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    const educationLevel = (profile as { educationLevel?: string; education_level?: string }).educationLevel
      ?? (profile as { education_level?: string }).education_level;
    if (educationLevel?.trim()) {
      setOnboardingData((prev) => {
        if (prev.educationLevel?.trim()) return prev;
        const updated = { ...prev, educationLevel: String(educationLevel) };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (profile?.relationshipStyle) {
      const uiStyle = mapRelationshipStyleToUi(profile.relationshipStyle);
      if (uiStyle) {
        setOnboardingData((prev) => {
          if (prev.relationshipStyle?.trim()) return prev;
          const updated = { ...prev, relationshipStyle: uiStyle };
          onboardingDataRef.current = updated;
          return updated;
        });
      }
    }

    if (profile?.longestRomanticRelationship?.trim()) {
      setOnboardingData((prev) => {
        if (prev.longestRomanticRelationship?.trim()) return prev;
        const updated = {
          ...prev,
          longestRomanticRelationship: String(profile.longestRomanticRelationship),
        };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (profile?.availability?.length && profile.phoneNumber?.trim()) {
      setOnboardingData((prev) => {
        if (prev.availability?.length && prev.phoneNumber?.trim()) return prev;
        const updated = {
          ...prev,
          availability: profile.availability,
          phoneNumber: profile.phoneNumber,
          ...(profile.contactPreference ? { contactPreference: profile.contactPreference } : {}),
        };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (
      profile?.matchPreferences &&
      typeof profile.matchPreferences === 'object' &&
      (profile.matchPreferences.distanceRange || profile.matchPreferences.ageRange)
    ) {
      setOnboardingData((prev) => {
        if (prev.matchPreferences?.distanceRange || prev.matchPreferences?.ageRange) return prev;
        const updated = { ...prev, matchPreferences: profile.matchPreferences as OnboardingData['matchPreferences'] };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (profile?.photos?.length) {
      setOnboardingData((prev) => {
        if (prev.photos?.length) return prev;
        const validPhotos = profile.photos!.filter((p) => p?.trim());
        if (!validPhotos.length) return prev;
        const updated = { ...prev, photos: validPhotos };
        onboardingDataRef.current = updated;
        return updated;
      });
    }

    if (profile?.lifeDomains && typeof profile.lifeDomains === 'object' && !isDefaultLifeDomains(profile.lifeDomains)) {
      setOnboardingData((prev) => {
        if (prev.lifeDomains && typeof prev.lifeDomains === 'object' && !isDefaultLifeDomains(prev.lifeDomains)) {
          return prev;
        }
        const updated = { ...prev, lifeDomains: profile.lifeDomains as OnboardingData['lifeDomains'] };
        onboardingDataRef.current = updated;
        return updated;
      });
    }
  }, [
    user?.id,
    loading,
    profileLoading,
    profile?.displayName,
    profile?.gender,
    (profile as any)?.ethnicity,
    (profile as any)?.looking_for,
    profile?.location,
    profile?.relationshipStyle,
    profile?.longestRomanticRelationship,
    (profile as any)?.occupation,
    (profile as any)?.educationLevel,
    profile?.availability,
    profile?.phoneNumber,
    profile?.matchPreferences,
    profile?.photos,
    profile?.lifeDomains,
  ]);

  React.useEffect(() => {
    if (loading || profileLoading || !user?.id) return;
  }, [loading, profileLoading, user?.id, currentStep, onboardingData]);

  // No auto-skip: user resumes from saved step only.

  // Debounce save function to prevent too many API calls
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const profileSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = React.useRef<string>('');
  
  const updateData = React.useCallback((newData: Partial<OnboardingData>) => {
    // Merge into ref synchronously so goToNextStep (same tick as onValueChange) sees updates.
    const updatedData = { ...onboardingDataRef.current, ...newData };
    onboardingDataRef.current = updatedData;

    const dataString = JSON.stringify(updatedData);
    if (dataString === lastSavedDataRef.current) {
      setOnboardingData(updatedData);
      return;
    }

    if (user?.id && !isInitialLoad.current) {
        // Clear any pending save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Debounce the save
        saveTimeoutRef.current = setTimeout(() => {
          const latestData = onboardingDataRef.current;
          const latestDataString = JSON.stringify(latestData);
          
          // Only save if data has changed since we queued this save
          if (latestDataString !== lastSavedDataRef.current) {
            lastSavedDataRef.current = latestDataString;
            modalOnboardingService.saveProgress(user.id, {
              currentStep,
              onboardingData: latestData,
            }).then((saveResult) => {
              if (!saveResult.success) {
                console.error('Failed to save progress on data update:', saveResult.error);
              } else {
                console.log('Progress saved on data update:', { 
                  currentStep, 
                  updatedFields: Object.keys(newData),
                });
              }
            }).catch((error) => {
              console.error('Error saving on data update:', error);
            });
          }
        }, 500);

        // Also save critical fields to profile (debounced separately to prevent loops)
        const profileUpdates: any = {};
        if (newData.name && newData.name.trim() !== '') {
          profileUpdates.displayName = newData.name;
        }
        if (newData.dateOfBirth && newData.dateOfBirth.trim() !== '') {
          profileUpdates.birthDate = newData.dateOfBirth;
          try {
            const { calculateAgeFromBirthdate } = require('@/shared/utils/ageCalculator');
            const calculatedAge = calculateAgeFromBirthdate(newData.dateOfBirth);
            if (calculatedAge !== null) {
              profileUpdates.age = calculatedAge;
            }
          } catch (error) {
            console.error('Error calculating age:', error);
          }
        }
        if (newData.birthTime !== undefined && String(newData.birthTime).trim() !== '') {
          (profileUpdates as any).birthTime = String(newData.birthTime).trim();
        }
        if (newData.birthLocation !== undefined && String(newData.birthLocation).trim() !== '') {
          (profileUpdates as any).birthLocation = String(newData.birthLocation).trim();
        }
        if (newData.gender && newData.gender.trim() !== '') {
          const mappedGender = mapGenderToDb(newData.gender);
          if (mappedGender) {
            profileUpdates.gender = mappedGender;
          }
        }
        if (newData.ethnicity && newData.ethnicity.trim() !== '') {
          (profileUpdates as any).ethnicity = newData.ethnicity.trim();
        }
        if (newData.attractedTo && Array.isArray(newData.attractedTo) && newData.attractedTo.length > 0) {
          profileUpdates.attractedTo = newData.attractedTo;
          // Also save to looking_for column when on attraction step
          if (currentStep === 'attraction') {
            profileUpdates.lookingFor = newData.attractedTo;
          }
        }
        if (newData.relationshipStyle && newData.relationshipStyle.trim() !== '') {
          profileUpdates.relationshipStyle = newData.relationshipStyle;
        }
        if (
          newData.longestRomanticRelationship !== undefined &&
          String(newData.longestRomanticRelationship).trim() !== ''
        ) {
          (profileUpdates as any).longestRomanticRelationship = String(
            newData.longestRomanticRelationship
          ).trim();
        }
        if (newData.location && newData.location.trim() !== '') {
          profileUpdates.location = newData.location;
        }
        if (newData.occupation && newData.occupation.trim() !== '') {
          profileUpdates.occupation = newData.occupation;
        }
        if (newData.educationLevel && newData.educationLevel.trim() !== '') {
          profileUpdates.educationLevel = newData.educationLevel;
        }
        if (newData.workout && String(newData.workout).trim() !== '') {
          profileUpdates.workout = newData.workout as any;
        }
        if (newData.smoking && String(newData.smoking).trim() !== '') {
          profileUpdates.smoking = newData.smoking as any;
        }
        if (newData.drinking && String(newData.drinking).trim() !== '') {
          profileUpdates.drinking = newData.drinking as any;
        }
        if (
          newData.recreationalDrugsSocial !== undefined &&
          String(newData.recreationalDrugsSocial).trim() !== ''
        ) {
          (profileUpdates as any).recreationalDrugsSocial = String(newData.recreationalDrugsSocial).trim();
        }
        if (
          newData.relationshipWithPsychedelics !== undefined &&
          String(newData.relationshipWithPsychedelics).trim() !== ''
        ) {
          (profileUpdates as any).relationshipWithPsychedelics = String(
            newData.relationshipWithPsychedelics
          ).trim();
        }
        if (
          newData.relationshipWithCannabis !== undefined &&
          String(newData.relationshipWithCannabis).trim() !== ''
        ) {
          (profileUpdates as any).relationshipWithCannabis = String(
            newData.relationshipWithCannabis
          ).trim();
        }
        if (newData.availability && Array.isArray(newData.availability) && newData.availability.length > 0) {
          profileUpdates.availability = newData.availability;
        }
        if (newData.contactPreference && newData.contactPreference.trim() !== '') {
          profileUpdates.contactPreference = newData.contactPreference;
        }
        if (newData.phoneNumber && newData.phoneNumber.trim() !== '') {
          profileUpdates.phoneNumber = newData.phoneNumber;
        }
        if (newData.bio !== undefined && newData.bio !== null) {
          // Bio can be empty string, so check for undefined/null only
          profileUpdates.bio = newData.bio;
        }
        if (newData.prefPhysicalCompatImportance !== undefined)
          (profileUpdates as any).prefPhysicalCompatImportance = newData.prefPhysicalCompatImportance;
        if (newData.prefPartnerSharesSexualInterests !== undefined)
          (profileUpdates as any).prefPartnerSharesSexualInterests = newData.prefPartnerSharesSexualInterests;
        if (newData.prefPartnerHasChildren !== undefined)
          (profileUpdates as any).prefPartnerHasChildren = newData.prefPartnerHasChildren;
        if (newData.prefPartnerPoliticalAlignmentImportance !== undefined)
          (profileUpdates as any).prefPartnerPoliticalAlignmentImportance =
            newData.prefPartnerPoliticalAlignmentImportance;
        if (newData.sexDrive !== undefined) (profileUpdates as any).sexDrive = newData.sexDrive;
        if (newData.sexInterestCategories !== undefined)
          (profileUpdates as any).sexInterestCategories = newData.sexInterestCategories;
        if (newData.datingPaceAfterExcitement !== undefined)
          (profileUpdates as any).datingPaceAfterExcitement = newData.datingPaceAfterExcitement;
        if (newData.recentDatingEarlyWeeks !== undefined)
          (profileUpdates as any).recentDatingEarlyWeeks = newData.recentDatingEarlyWeeks;
        if (newData.spaceForNewRelationship !== undefined)
          (profileUpdates as any).spaceForNewRelationship = newData.spaceForNewRelationship;
        if (newData.partnerMoodMismatchResponse !== undefined)
          (profileUpdates as any).partnerMoodMismatchResponse = newData.partnerMoodMismatchResponse;
        if (newData.sexualFocusPreference !== undefined)
          (profileUpdates as any).sexualFocusPreference = newData.sexualFocusPreference;
        if (newData.lifeDomains) {
          profileUpdates.lifeDomains = newData.lifeDomains;
        }
        if (newData.matchPreferences) {
          profileUpdates.matchPreferences = newData.matchPreferences;
        }
        if (newData.typology) {
          const t = newData.typology;
          const existingAnswers =
            (onboardingDataRef.current as any)?.questionAnswers &&
            typeof (onboardingDataRef.current as any).questionAnswers === 'object'
              ? { ...(onboardingDataRef.current as any).questionAnswers }
              : {};

          profileUpdates.questionAnswers = {
            ...existingAnswers,
            loveLanguage: t.loveLanguage || undefined,
            myersBriggs: t.myersBriggs || undefined,
            enneagramType: t.enneagramType || undefined,
            enneagramWing: t.enneagramWing || undefined,
            enneagramInstinct: t.enneagramInstinct || undefined,
            sunSign: t.sunSign || undefined,
            risingSign: t.risingSign || undefined,
            moonSign: t.moonSign || undefined,
            venusSign: t.venusSign || undefined,
            marsSign: t.marsSign || undefined,
            saturnSign: t.saturnSign || undefined,
            humanDesignType: t.humanDesignType || undefined,
            humanDesignProfile: t.humanDesignProfile || undefined,
            humanDesignAuthority: t.humanDesignAuthority || undefined,
            eroticBlueprintType: t.eroticBlueprintType || undefined,
            spiralDynamics: t.spiralDynamics || undefined,
          };
          if (t.myersBriggs) {
            profileUpdates.myersBriggs = t.myersBriggs;
          }
        }
        const archetypesDraft = normalizeArchetypesFromProfile(newData.archetypes);
        if (archetypesDraft.length === 2) {
          profileUpdates.archetypes = archetypesDraft;
        }

        if (Object.keys(profileUpdates).length > 0) {
          // Clear any pending profile save
          if (profileSaveTimeoutRef.current) {
            clearTimeout(profileSaveTimeoutRef.current);
          }
          
          // Debounce profile save to prevent infinite loops
          profileSaveTimeoutRef.current = setTimeout(() => {
            import('@/data/repos/profilesRepo').then(({ profilesRepo }) => {
              profilesRepo.updateProfile(user.id, profileUpdates)
                .then((result) => {
                  if (result.success) {
                    console.log('Profile fields saved:', Object.keys(profileUpdates));
                  } else {
                    console.error('Failed to save profile fields:', result.error);
                  }
                })
                .catch((error) => {
                  console.error('Error saving profile fields:', error);
                });
            }).catch((error) => {
              console.error('Error importing profilesRepo:', error);
            });
          }, 1000); // Longer debounce for profile saves
        }
      }

    setOnboardingData(updatedData);
  }, [user?.id, currentStep]);

  const goToPrevStep = () => {
    if (stepTransitionLockRef.current) return;
    const prevStep = getPrevOnboardingStep(
      currentStep,
      getOnboardingNavigationContext(onboardingDataRef.current),
    );
    if (!prevStep) return;
    const latestData = onboardingDataRef.current;

    stepTransitionLockRef.current = true;
    try {
      setCurrentStep(prevStep);
      if (user?.id) {
        void modalOnboardingService
          .saveProgress(user.id, {
            currentStep: prevStep,
            onboardingData: latestData,
          })
          .then((saveResult) => {
            if (!saveResult.success) {
              console.error('Error saving progress on back:', saveResult.error);
            }
          })
          .catch((e) => console.error('Error saving progress on back:', e));
      }
    } finally {
      stepTransitionLockRef.current = false;
    }
  };

  const persistLifeDomainAnswerForStep = async (step: OnboardingStep, uid: string) => {
    if (!isLifeDomainRequiredQuestionStep(step)) return;
    const row = findLifeDomainQuestionStepRow(step);
    if (!row) return;
    const answer = onboardingDataRef.current.lifeDomainAnswers?.[row.domainId]?.[row.questionId];
    if (!answer?.trim()) return;
    await upsertLifeDomainAnswer(uid, row.domainId, row.questionId, {
      answer: answer.trim(),
      show_on_match: false,
    });
  };

  const goToNextStep = async () => {
    if (stepTransitionLockRef.current) return;
    const stepWeLeave = currentStep;
    const uid = user?.id;
    if (uid) {
      void persistLifeDomainAnswerForStep(stepWeLeave, uid).catch((e) => {
        if (__DEV__) console.warn('[ModalOnboarding] life domain answer save', e);
      });
    }

    const nextStep = getNextOnboardingStep(
      currentStep,
      getOnboardingNavigationContext(onboardingDataRef.current),
    );
    if (!nextStep) return;
    const latestData = onboardingDataRef.current;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (profileSaveTimeoutRef.current) {
      clearTimeout(profileSaveTimeoutRef.current);
      profileSaveTimeoutRef.current = null;
    }

    stepTransitionLockRef.current = true;
    try {
      setCurrentStep(nextStep);

      if (!uid) return;

      void (async () => {
        try {
          const saveResult = await modalOnboardingService.saveProgress(uid, {
            currentStep: nextStep,
            onboardingData: latestData,
          });
          if (!saveResult.success) {
            console.error('Failed to save progress after step change:', saveResult.error);
          } else {
            console.log('Progress saved successfully after step change:', {
              from: stepWeLeave,
              to: nextStep,
              name: latestData.name,
              dateOfBirth: latestData.dateOfBirth,
              gender: latestData.gender,
            });
          }

          const { profilesRepo } = await import('@/data/repos/profilesRepo');
          const { calculateAgeFromBirthdate } = await import('@/shared/utils/ageCalculator');
          const profileUpdates: any = {};

          if (latestData.name && latestData.name.trim() !== '') {
            profileUpdates.displayName = latestData.name;
          }
          if (latestData.dateOfBirth && latestData.dateOfBirth.trim() !== '') {
            profileUpdates.birthDate = latestData.dateOfBirth;
            const calculatedAge = calculateAgeFromBirthdate(latestData.dateOfBirth);
            if (calculatedAge !== null) {
              profileUpdates.age = calculatedAge;
            }
          }
          if (latestData.birthTime !== undefined && String(latestData.birthTime).trim() !== '') {
            (profileUpdates as any).birthTime = String(latestData.birthTime).trim();
          }
          if (latestData.birthLocation !== undefined && String(latestData.birthLocation).trim() !== '') {
            (profileUpdates as any).birthLocation = String(latestData.birthLocation).trim();
          }
          if (latestData.gender && latestData.gender.trim() !== '') {
            const mappedGender = mapGenderToDb(latestData.gender);
            if (mappedGender) {
              profileUpdates.gender = mappedGender;
            }
          }
          if (latestData.ethnicity && latestData.ethnicity.trim() !== '') {
            (profileUpdates as any).ethnicity = latestData.ethnicity.trim();
          }
          if (latestData.attractedTo && Array.isArray(latestData.attractedTo) && latestData.attractedTo.length > 0) {
            profileUpdates.attractedTo = latestData.attractedTo;
            if (stepWeLeave === 'attraction') {
              profileUpdates.lookingFor = latestData.attractedTo;
            }
          }
          if (latestData.userLocation) {
            const loc = latestData.userLocation;
            profileUpdates.lat = loc.latitude;
            profileUpdates.lon = loc.longitude;
            if (loc.city != null || loc.region != null) {
              profileUpdates.location = [loc.city, loc.region].filter(Boolean).join(', ') || latestData.location;
            }
          } else if (latestData.location && latestData.location.trim() !== '') {
            profileUpdates.location = latestData.location;
          }
          const hwPatch = buildHeightWeightProfileFields({
            height: latestData.height,
            height_cm: latestData.height_cm,
            weight: latestData.weight,
            weight_kg: latestData.weight_kg,
          });
          if (hwPatch.height) profileUpdates.height = hwPatch.height;
          if (hwPatch.heightLabel) (profileUpdates as any).heightLabel = hwPatch.heightLabel;
          if (hwPatch.weight) profileUpdates.weight = hwPatch.weight;
          if (hwPatch.weightLabel) (profileUpdates as any).weightLabel = hwPatch.weightLabel;
          if (latestData.relationshipStyle && latestData.relationshipStyle.trim() !== '') {
            profileUpdates.relationshipStyle = mapRelationshipStyleUiToDb(latestData.relationshipStyle) as any;
            (profileUpdates as any).relationshipType = mapRelationshipStyleUiToRelationshipType(
              latestData.relationshipStyle
            );
          }
          if (
            latestData.longestRomanticRelationship !== undefined &&
            String(latestData.longestRomanticRelationship).trim() !== ''
          ) {
            (profileUpdates as any).longestRomanticRelationship = String(
              latestData.longestRomanticRelationship
            ).trim();
          }
          if (latestData.location && latestData.location.trim() !== '') {
            profileUpdates.location = latestData.location;
          }
          if (latestData.occupation && latestData.occupation.trim() !== '') {
            profileUpdates.occupation = latestData.occupation;
          }
          if (latestData.educationLevel && latestData.educationLevel.trim() !== '') {
            profileUpdates.educationLevel = latestData.educationLevel;
          }
          if (latestData.workout && latestData.workout.trim() !== '') {
            profileUpdates.workout = latestData.workout as any;
          }
          if (latestData.smoking && latestData.smoking.trim() !== '') {
            profileUpdates.smoking = latestData.smoking as any;
          }
          if (latestData.drinking && latestData.drinking.trim() !== '') {
            profileUpdates.drinking = latestData.drinking as any;
          }
          if (
            latestData.relationshipWithPsychedelics !== undefined &&
            String(latestData.relationshipWithPsychedelics).trim() !== ''
          ) {
            (profileUpdates as any).relationshipWithPsychedelics = String(
              latestData.relationshipWithPsychedelics
            ).trim();
          }
          if (
            latestData.relationshipWithCannabis !== undefined &&
            String(latestData.relationshipWithCannabis).trim() !== ''
          ) {
            (profileUpdates as any).relationshipWithCannabis = String(
              latestData.relationshipWithCannabis
            ).trim();
          }
          if (latestData.haveKids !== undefined) (profileUpdates as any).haveKids = latestData.haveKids;
          if (latestData.wantKids !== undefined) (profileUpdates as any).wantKids = latestData.wantKids;
          if (latestData.politics !== undefined) (profileUpdates as any).politics = latestData.politics;
          if (latestData.religion !== undefined) (profileUpdates as any).religion = latestData.religion;
          if (latestData.prefPhysicalCompatImportance !== undefined)
            (profileUpdates as any).prefPhysicalCompatImportance = latestData.prefPhysicalCompatImportance;
          if (latestData.prefPartnerSharesSexualInterests !== undefined)
            (profileUpdates as any).prefPartnerSharesSexualInterests =
              latestData.prefPartnerSharesSexualInterests;
          if (latestData.prefPartnerHasChildren !== undefined)
            (profileUpdates as any).prefPartnerHasChildren = latestData.prefPartnerHasChildren;
          if (latestData.prefPartnerPoliticalAlignmentImportance !== undefined)
            (profileUpdates as any).prefPartnerPoliticalAlignmentImportance =
              latestData.prefPartnerPoliticalAlignmentImportance;
          if (latestData.sexDrive !== undefined) (profileUpdates as any).sexDrive = latestData.sexDrive;
          if (latestData.sexInterestCategories !== undefined)
            (profileUpdates as any).sexInterestCategories = latestData.sexInterestCategories;
          if (latestData.datingPaceAfterExcitement !== undefined)
            (profileUpdates as any).datingPaceAfterExcitement = latestData.datingPaceAfterExcitement;
          if (latestData.recentDatingEarlyWeeks !== undefined)
            (profileUpdates as any).recentDatingEarlyWeeks = latestData.recentDatingEarlyWeeks;
          if (latestData.spaceForNewRelationship !== undefined)
            (profileUpdates as any).spaceForNewRelationship = latestData.spaceForNewRelationship;
          if (latestData.partnerMoodMismatchResponse !== undefined)
            (profileUpdates as any).partnerMoodMismatchResponse =
              latestData.partnerMoodMismatchResponse;
          if (latestData.sexualFocusPreference !== undefined)
            (profileUpdates as any).sexualFocusPreference = latestData.sexualFocusPreference;
          if (latestData.hobbies !== undefined) profileUpdates.hobbies = latestData.hobbies;
          if (latestData.professionalHobbyId !== undefined) (profileUpdates as any).professionalHobbyId = latestData.professionalHobbyId;
          if (latestData.availability && Array.isArray(latestData.availability) && latestData.availability.length > 0) {
            profileUpdates.availability = latestData.availability;
          }
          if (latestData.contactPreference && latestData.contactPreference.trim() !== '') {
            profileUpdates.contactPreference = latestData.contactPreference;
          }
          if (latestData.phoneNumber && latestData.phoneNumber.trim() !== '') {
            profileUpdates.phoneNumber = latestData.phoneNumber;
          }
          if (latestData.photos && Array.isArray(latestData.photos) && latestData.photos.length > 0) {
            profileUpdates.photos = latestData.photos;
          }
          if (latestData.bio !== undefined && latestData.bio !== null) {
            // Bio can be empty string, so check for undefined/null only
            profileUpdates.bio = latestData.bio;
          }
          if (latestData.lifeDomains) {
            profileUpdates.lifeDomains = latestData.lifeDomains;
          }
          if (latestData.matchPreferences) {
            profileUpdates.matchPreferences = latestData.matchPreferences;
          }
          if (latestData.typology) {
            const t = latestData.typology;
            const existingAnswers =
              (onboardingDataRef.current as any)?.questionAnswers &&
              typeof (onboardingDataRef.current as any).questionAnswers === 'object'
                ? { ...(onboardingDataRef.current as any).questionAnswers }
                : {};
            profileUpdates.questionAnswers = {
              ...existingAnswers,
              loveLanguage: t.loveLanguage || undefined,
              myersBriggs: t.myersBriggs || undefined,
              enneagramType: t.enneagramType || undefined,
              enneagramWing: t.enneagramWing || undefined,
              enneagramInstinct: t.enneagramInstinct || undefined,
              sunSign: t.sunSign || undefined,
              risingSign: t.risingSign || undefined,
              moonSign: t.moonSign || undefined,
              venusSign: t.venusSign || undefined,
              marsSign: t.marsSign || undefined,
              saturnSign: t.saturnSign || undefined,
              humanDesignType: t.humanDesignType || undefined,
              humanDesignProfile: t.humanDesignProfile || undefined,
              humanDesignAuthority: t.humanDesignAuthority || undefined,
              eroticBlueprintType: t.eroticBlueprintType || undefined,
              spiralDynamics: t.spiralDynamics || undefined,
            };
            if (t.myersBriggs) {
              profileUpdates.myersBriggs = t.myersBriggs;
            }
          }
          const archetypesStep = normalizeArchetypesFromProfile(latestData.archetypes);
          if (archetypesStep.length === 2) {
            profileUpdates.archetypes = archetypesStep;
          }

          // Save all updates at once
          if (Object.keys(profileUpdates).length > 0) {
            console.log('Saving profile updates on step change:', {
              step: stepWeLeave,
              fields: Object.keys(profileUpdates),
              hasLocation: !!profileUpdates.location,
              hasContactPreference: !!profileUpdates.contactPreference,
              hasPhoneNumber: !!profileUpdates.phoneNumber,
              hasBio: profileUpdates.bio !== undefined,
            });
            const profileResult = await profilesRepo.updateProfile(uid, profileUpdates);
            if (profileResult.success) {
              console.log('Profile successfully updated with:', Object.keys(profileUpdates));
            } else {
              console.error('Failed to save profile updates:', profileResult.error);
            }
          }
        } catch (error) {
          console.error('Error saving after step change:', error);
        }
      })();
    } finally {
      stepTransitionLockRef.current = false;
    }
  };

  const handleComplete = () => {
    const uid = user?.id;
    if (!uid) return;

    const latestData = onboardingDataRef.current;
    console.log('Completing onboarding (persist in background), current data:', {
      hasName: !!latestData.name,
      nameValue: latestData.name,
      hasGender: !!latestData.gender,
      hasRelationshipStyle: !!latestData.relationshipStyle,
      hasLocation: !!latestData.location,
      allDataKeys: Object.keys(latestData),
    });

    void (async () => {
      try {
        const result = await modalOnboardingService.completeOnboarding(uid, latestData);
        if (!result.success) {
          console.error('Failed to complete onboarding:', result.error);
          try {
            const { profilesRepo } = await import('@/data/repos/profilesRepo');
            await profilesRepo.updateProfile(uid, { hasSeenOnboardingIntro: true });
            console.log('Set hasSeenOnboardingIntro to true as fallback');
          } catch (fallbackError) {
            console.error('Failed to set hasSeenOnboardingIntro as fallback:', fallbackError);
          }
        } else {
          console.log('Onboarding completed successfully, hasSeenOnboardingIntro set to true');
        }
      } catch (error) {
        console.error('Error completing onboarding:', error);
        try {
          const { profilesRepo } = await import('@/data/repos/profilesRepo');
          await profilesRepo.updateProfile(uid, { hasSeenOnboardingIntro: true });
          console.log('Set hasSeenOnboardingIntro to true on error');
        } catch (fallbackError) {
          console.error('Failed to set hasSeenOnboardingIntro on error:', fallbackError);
        }
      }
    })();

    onComplete();
  };

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading your profile progress...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {currentStep !== 'profileComplete' && currentStep !== 'personalityDocuments' ? (
        <OnboardingProgressBar
          currentStep={currentStep}
          navigationCtx={getOnboardingNavigationContext(onboardingData)}
        />
      ) : null}
      {currentStep === 'name' && (
        <NameModal
          name={onboardingData.name || ''}
          onNameChange={(name) => updateData({ name })}
          onNext={goToNextStep}
          onBack={onExitToPostInterview}
        />
      )}

      {currentStep === 'ethnicity' && (
        <EthnicityOnboardingModal
          ethnicity={onboardingData.ethnicity || ''}
          onEthnicityChange={(ethnicity) => updateData({ ethnicity })}
          heritageOptions={ETHNICITY_CHOICES}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'ethnicityAttraction' && (
        <EthnicityAttractionOnboardingModal
          ethnicityAttraction={onboardingData.matchPreferences?.ethnicityAttraction as string[] | undefined}
          onEthnicityAttractionChange={(ethnicityAttraction) =>
            updateData({
              matchPreferences: {
                ...(onboardingData.matchPreferences ?? {}),
                ethnicityAttraction,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'attraction' && (
        <AttractionModal
          attractedTo={onboardingData.attractedTo || []}
          onAttractedToChange={(attractedTo) => updateData({ attractedTo })}
          onNext={(picked?: string[]) => {
            if (picked?.length) {
              onboardingDataRef.current = { ...onboardingDataRef.current, attractedTo: picked };
            }
            const attractedTo = picked ?? onboardingDataRef.current.attractedTo;
            if (attractedTo && attractedTo.length > 0 && user?.id) {
              const attractionUid = user.id;
              void (async () => {
                try {
                  const { profilesRepo } = await import('@/data/repos/profilesRepo');
                  const mappedAttraction = mapAttractionToDb(attractedTo);
                  if (mappedAttraction) {
                    await profilesRepo.updateProfile(attractionUid, { attractedTo: mappedAttraction });
                  }
                } catch (error) {
                  console.error('Error saving attracted_to:', error);
                }
              })();
            }
            void goToNextStep();
          }}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'dateOfBirth' && (
        <DateOfBirthModal
          dateOfBirth={onboardingData.dateOfBirth || ''}
          onDateOfBirthChange={(dateOfBirth) => updateData({ dateOfBirth })}
          birthTime={onboardingData.birthTime || ''}
          onBirthTimeChange={(birthTime) => updateData({ birthTime })}
          birthLocation={onboardingData.birthLocation || ''}
          onBirthLocationChange={(birthLocation) => updateData({ birthLocation })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'relationshipStyle' && (
        <RelationshipStyleModal
          relationshipStyle={onboardingData.relationshipStyle || ''}
          onRelationshipStyleChange={(style) => updateData({ relationshipStyle: style })}
          onNext={() => {
            const latestData = onboardingDataRef.current;
            if (latestData.relationshipStyle && latestData.relationshipStyle.trim() !== '' && user?.id) {
              const rsUid = user.id;
              void (async () => {
                try {
                  const dbValue = mapRelationshipStyleUiToDb(latestData.relationshipStyle!);
                  const { profilesRepo } = await import('@/data/repos/profilesRepo');
                  await profilesRepo.updateProfile(rsUid, {
                    relationshipStyle: dbValue as any,
                    relationshipType: mapRelationshipStyleUiToRelationshipType(latestData.relationshipStyle!),
                  } as any);
                  console.log('Saved relationship_style to Supabase:', dbValue);
                } catch (error) {
                  console.error('Error saving relationship_style:', error);
                }
              })();
            }
            void goToNextStep();
          }}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'longestRelationship' && (
        <LongestRelationshipModal
          value={onboardingData.longestRomanticRelationship || ''}
          onValueChange={(v) => updateData({ longestRomanticRelationship: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'location' && (
        <LocationModal
          location={onboardingData.location || ''}
          onLocationChange={(location) => updateData({ location })}
          onNext={() => {
            void goToNextStep();
            const latestData = onboardingDataRef.current;
            if (latestData.location?.trim() && user?.id) {
              const locUid = user.id;
              void (async () => {
                try {
                  const { profilesRepo } = await import('@/data/repos/profilesRepo');
                  const { geocodeLocation } = await import('@/shared/utils/geocoding');
                  const coordinates = await geocodeLocation(latestData.location!);
                  const profileUpdates: any = { location: latestData.location!.trim() };
                  if (coordinates) {
                    profileUpdates.lat = coordinates.latitude;
                    profileUpdates.lon = coordinates.longitude;
                  }
                  await profilesRepo.updateProfile(locUid, profileUpdates);
                } catch (error) {
                  console.error('Error saving location:', error);
                }
              })();
            }
          }}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'educationLevel' && (
        <SingleChoiceModal
          title="Education level"
          options={EDUCATION_LEVEL_CHOICES}
          value={onboardingData.educationLevel || ''}
          onValueChange={(v) => updateData({ educationLevel: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'heightWeight' && (
        <HeightWeightModal
          height={onboardingData.height ?? ''}
          weight={onboardingData.weight ?? ''}
          onHeightChange={(height) => updateData({ height })}
          onWeightChange={(weight) => updateData({ weight })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'workout' && (
        <SingleChoiceModal
          title="Workout frequency"
          options={workoutOptions}
          value={onboardingData.workout || ''}
          onValueChange={(v) => updateData({ workout: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'smoking' && (
        <SingleChoiceModal
          title="Smoking & vaping"
          options={smokingOptions}
          value={onboardingData.smoking || ''}
          onValueChange={(v) => updateData({ smoking: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerAlignmentTobacco' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares your relationship with cigarettes or vaping?"
          options={PARTNER_SUBSTANCE_ALIGNMENT_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerAlignmentTobacco ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingDataRef.current.matchPreferences || {}),
                partnerAlignmentTobacco: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'drinking' && (
        <SingleChoiceModal
          title="What is your relationship with alcohol"
          options={drinkingOptions}
          value={onboardingData.drinking || ''}
          onValueChange={(v) => updateData({ drinking: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerAlignmentAlcohol' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares your relationship with alcohol?"
          options={PARTNER_SUBSTANCE_ALIGNMENT_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerAlignmentAlcohol ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingDataRef.current.matchPreferences || {}),
                partnerAlignmentAlcohol: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'recreationalDrugsSocial' && (
        <SingleChoiceModal
          title="Do you use recreational drugs socially (MDMA, cocaine, etc)"
          description="Examples include MDMA, cocaine, or similar in social settings. Cannabis and psychedelics/plant medicines are asked separately."
          options={recreationalDrugsSocialOptions}
          value={onboardingData.recreationalDrugsSocial || ''}
          onValueChange={(v) => updateData({ recreationalDrugsSocial: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerAlignmentRecreationalDrugs' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares your relationship with recreational drugs?"
          options={PARTNER_SUBSTANCE_ALIGNMENT_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerAlignmentRecreationalDrugs ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingDataRef.current.matchPreferences || {}),
                partnerAlignmentRecreationalDrugs: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'relationshipPsychedelics' && (
        <SingleChoiceModal
          title="What's your relationship with psychedelics or plant medicines?"
          description="Psychedelics and traditional plant medicines (e.g. ayahuasca, peyote in lawful ceremonial contexts). This is separate from alcohol and cannabis."
          options={psychedelicsRelationshipOptions}
          value={onboardingData.relationshipWithPsychedelics || ''}
          onValueChange={(v) => updateData({ relationshipWithPsychedelics: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerAlignmentPsychedelics' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares your relationship with psychedelics or plant medicines?"
          options={PARTNER_SUBSTANCE_ALIGNMENT_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerAlignmentPsychedelics ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingDataRef.current.matchPreferences || {}),
                partnerAlignmentPsychedelics: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'relationshipCannabis' && (
        <SingleChoiceModal
          title="What is your relationship with cannabis or tobacco?"
          options={cannabisRelationshipOptions}
          value={onboardingData.relationshipWithCannabis || ''}
          onValueChange={(v) => updateData({ relationshipWithCannabis: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerAlignmentCannabis' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares your relationship with cannabis or tobacco?"
          options={PARTNER_SUBSTANCE_ALIGNMENT_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerAlignmentCannabis ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingDataRef.current.matchPreferences || {}),
                partnerAlignmentCannabis: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'haveKids' && (
        <SingleChoiceModal
          title="Do you have kids?"
          options={haveKidsOptions}
          value={onboardingData.haveKids || ''}
          onValueChange={(v) => updateData({ haveKids: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'wantKids' && (
        <SingleChoiceModal
          title="Do you want children?"
          options={wantChildrenYesNoOptions}
          value={onboardingData.wantKids || ''}
          onValueChange={(v) => updateData({ wantKids: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'prefPartnerHasChildren' && (
        <SingleChoiceModal
          title="Is it OK if your match already has children?"
          options={PARTNER_HAS_CHILDREN_CHOICES}
          value={onboardingData.prefPartnerHasChildren || ''}
          onValueChange={(v) => updateData({ prefPartnerHasChildren: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'politics' && (
        <SingleChoiceModal
          title="Politics"
          options={politicsOptions}
          value={onboardingData.politics || ''}
          onValueChange={(v) => updateData({ politics: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'prefPartnerPoliticalAlignment' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares the same political views as you?"
          options={PARTNER_POLITICAL_SHARING_CHOICES}
          value={onboardingData.prefPartnerPoliticalAlignmentImportance || ''}
          onValueChange={(v) => updateData({ prefPartnerPoliticalAlignmentImportance: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'religion' && (
        <SingleChoiceModal
          title="Religion"
          options={religionOptions}
          value={onboardingData.religion || ''}
          onValueChange={(v) => updateData({ religion: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerSameReligionRequired' && (
        <SingleChoiceModal
          title="Is it a must have that your partner shares the same religious faith as you?"
          options={PARTNER_SAME_RELIGION_CHOICES}
          value={String(onboardingData.matchPreferences?.partnerSameReligionRequired ?? '')}
          onValueChange={(v) =>
            updateData({
              matchPreferences: {
                ...(onboardingData.matchPreferences ?? {}),
                partnerSameReligionRequired: v,
              },
            })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'sexDrive' && (
        <SingleChoiceModal
          title="In a relationship, what feels like your natural rhythm for sex?"
          options={SEX_DRIVE_OPTIONS}
          value={onboardingData.sexDrive || ''}
          onValueChange={(v) => updateData({ sexDrive: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'sexInterests' && (
        <SexInterestsOnboardingModal
          categories={onboardingData.sexInterestCategories || []}
          onCategoriesChange={(sexInterestCategories) => updateData({ sexInterestCategories })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerSharesSexualInterests' && (
        <SingleChoiceModal
          title={PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION}
          options={PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS}
          value={prefPartnerSharesSexualInterestsYesNoSelected(
            onboardingData.prefPartnerSharesSexualInterests || '',
          )}
          onValueChange={(v) =>
            updateData({ prefPartnerSharesSexualInterests: prefPartnerSharesSexualInterestsFromYesNo(v) })
          }
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'partnerMoodMismatch' && (
        <SingleChoiceModal
          title="When my partner is in the mood and I'm not, I generally..."
          options={PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS}
          value={onboardingData.partnerMoodMismatchResponse || ''}
          onValueChange={(v) => updateData({ partnerMoodMismatchResponse: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'sexualFocus' && (
        <SingleChoiceModal
          title="During sex, I'm more focused on..."
          options={SEXUAL_FOCUS_OPTIONS}
          value={onboardingData.sexualFocusPreference || ''}
          onValueChange={(v) => updateData({ sexualFocusPreference: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'datingPaceAfterExcitement' && (
        <SingleChoiceModal
          title="After the initial excitement of meeting someone, what pace feels most natural for you?"
          options={DATING_PACE_AFTER_EXCITEMENT_OPTIONS}
          value={onboardingData.datingPaceAfterExcitement || ''}
          onValueChange={(v) => updateData({ datingPaceAfterExcitement: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'recentDatingEarlyWeeks' && (
        <SingleChoiceModal
          title="Think about your most recent dating experience. In the first 2-3 weeks, what actually happened?"
          options={RECENT_DATING_EARLY_WEEKS_OPTIONS}
          value={onboardingData.recentDatingEarlyWeeks || ''}
          onValueChange={(v) => updateData({ recentDatingEarlyWeeks: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'spaceForNewRelationship' && (
        <SingleChoiceModal
          title="How much space do you realistically have for a new relationship right now?"
          options={SPACE_FOR_NEW_RELATIONSHIP_OPTIONS}
          value={onboardingData.spaceForNewRelationship || ''}
          onValueChange={(v) => updateData({ spaceForNewRelationship: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {getActiveLifeDomainRequiredQuestionSteps(onboardingData.wantKids).map(
        ({ step, domainId, questionId }) =>
          currentStep === step && user?.id ? (
            <LifeDomainSingleQuestionOnboardingModal
              key={step}
              domainId={domainId}
              questionId={questionId}
              value={onboardingData.lifeDomainAnswers?.[domainId]?.[questionId] ?? ''}
              onValueChange={(answer) => {
                const prevAnswers = onboardingDataRef.current.lifeDomainAnswers ?? {};
                const domainAnswers = { ...(prevAnswers[domainId] ?? {}), [questionId]: answer };
                updateData({
                  lifeDomainAnswers: { ...prevAnswers, [domainId]: domainAnswers },
                });
              }}
              onNext={goToNextStep}
              onBack={goToPrevStep}
            />
          ) : null,
      )}

      {currentStep === 'lifeDomains' && (
        <LifeDomainsModal
          lifeDomains={Array.isArray(onboardingData.lifeDomains) ? undefined : onboardingData.lifeDomains}
          onLifeDomainsChange={(lifeDomains) => updateData({ lifeDomains })}
          onNext={async () => {
            const latest = onboardingDataRef.current;
            const ld = Array.isArray(latest.lifeDomains) ? undefined : latest.lifeDomains;
            if (user?.id && ld) {
              try {
                await syncLifeDomainImportanceFromOnboarding(user.id, ld);
              } catch (e) {
                if (__DEV__) console.warn('[ModalOnboarding] life domain importance', e);
              }
            }
            goToNextStep();
          }}
          onBack={goToPrevStep}
        />
      )}

      {getActiveLifeDomainOptionalOpenEndedSteps(
        onboardingData.wantKids,
        onboardingData.lifeDomainAnswers,
      ).map(({ step, domainId }) =>
        currentStep === step && user?.id ? (
          <LifeDomainQuestionsModal
            key={step}
            userId={user.id}
            domainId={domainId}
            wantKids={onboardingData.wantKids}
            enforceRequired={false}
            optionalOpenEndedLeftover
            initialAnswers={onboardingData.lifeDomainAnswers}
            onAnswersChange={(lifeDomainAnswers) => updateData({ lifeDomainAnswers })}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        ) : null,
      )}

      {currentStep === 'typology' && (
        <TypologyModal
          typology={onboardingData.typology}
          onTypologyChange={(typology) => updateData({ typology })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'matchPreferences' && (
        <MatchPreferencesModal
          matchPreferences={onboardingData.matchPreferences}
          onMatchPreferencesChange={(matchPreferences) => updateData({ matchPreferences })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'archetypes' && (
        <ArchetypesOnboardingModal
          archetypes={normalizeArchetypesFromProfile(onboardingData.archetypes)}
          onArchetypesChange={(archetypes: ArchetypeId[]) => updateData({ archetypes })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'photos' && (
        <PhotosVideoModal
          photos={onboardingData.photos || []}
          onPhotosChange={(photos) => updateData({ photos })}
          onNext={() => {
            const latestData = onboardingDataRef.current;
            if (user?.id) {
              const photosUid = user.id;
              void (async () => {
                try {
                  const { profilesRepo } = await import('@/data/repos/profilesRepo');
                  const profileUpdates: any = {};
                  if (latestData.photos !== undefined) {
                    const validPhotos = Array.isArray(latestData.photos)
                      ? latestData.photos.filter((p) => p && p.trim() !== '')
                      : [];
                    profileUpdates.photos = validPhotos;
                  }
                  if (Object.keys(profileUpdates).length > 0) {
                    await profilesRepo.updateProfile(photosUid, profileUpdates);
                  }
                } catch (error) {
                  console.error('Error saving photos:', error);
                }
              })();
            }
            void goToNextStep();
          }}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'attractionPreferences' && (
        <AttractionPreferencesModal
          matchPreferences={onboardingData.matchPreferences}
          userAge={typeof profile?.age === 'number' ? profile.age : undefined}
          onMatchPreferencesChange={(matchPreferences) => updateData({ matchPreferences })}
          onNext={async () => {
            const latest = onboardingDataRef.current;
            const mp = latest.matchPreferences;
            if (user?.id && mp && typeof mp === 'object' && !Array.isArray(mp)) {
              try {
                await mergeAndPersistMatchPreferences(user.id, mp as Record<string, unknown>);
              } catch (e) {
                if (__DEV__) console.warn('[ModalOnboarding] match preferences', e);
              }
            }
            goToNextStep();
          }}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'personalityDocuments' && user?.id ? (
        <PersonalityDocumentsOnboardingStep
          userId={user.id}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      ) : null}

      {currentStep === 'profileComplete' && (
        <ProfileOnboardingCompleteModal onContinue={handleComplete} />
      )}
    </View>
  );
};

