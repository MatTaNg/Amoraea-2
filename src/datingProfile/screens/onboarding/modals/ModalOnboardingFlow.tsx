import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { useProfile } from '@/shared/hooks/useProfile';
import { NameModal } from './NameModal';
import { GenderModal } from './GenderModal';
import { AttractionModal } from './AttractionModal';
import { DateOfBirthModal } from './DateOfBirthModal';
import { RelationshipStyleModal } from './RelationshipStyleModal';
import { LongestRelationshipModal } from './LongestRelationshipModal';
import { LocationModal } from './LocationModal';
import { HeightWeightModal } from './HeightWeightModal';
import { SingleChoiceModal } from './SingleChoiceModal';
import { OccupationModal } from './OccupationModal';
import { TypologyModal } from './TypologyModal';
import { PhotosVideoModal } from './PhotosVideoModal';
import { LifeDomainsModal } from './LifeDomainsModal';
import { MatchPreferencesModal } from './MatchPreferencesModal';
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
} from '@/shared/constants/filterOptions';
import { modalOnboardingService } from './services/modalOnboardingService';
import { OnboardingData } from './types';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import { mapAttractionToDb, normalizeAttractedToUiLabels } from '@/shared/utils/attractionMapper';
import {
  EDUCATION_LEVEL_CHOICES,
  ETHNICITY_CHOICES,
} from '@/screens/profile/editProfile/aboutYouOptions';
import {
  SEX_DRIVE_OPTIONS,
  DATING_PACE_AFTER_EXCITEMENT_OPTIONS,
  RECENT_DATING_EARLY_WEEKS_OPTIONS,
} from '@/shared/constants/sexualCompatibilityOptions';
import {
  buildHeightWeightProfileFields,
  mapRelationshipStyleUiToDb,
  mapRelationshipStyleUiToRelationshipType,
} from '@/screens/profile/editProfile/editProfileService';

/** Screen order per spec: Name -> Dealbreakers flow. No welcome screen. */
export type OnboardingStep =
  | 'name'
  | 'gender'
  | 'ethnicity'
  | 'attraction'
  | 'dateOfBirth'
  | 'relationshipStyle'
  | 'longestRelationship'
  | 'location'
  | 'occupation'
  | 'educationLevel'
  | 'heightWeight'
  | 'workout'
  | 'smoking'
  | 'drinking'
  | 'recreationalDrugsSocial'
  | 'relationshipPsychedelics'
  | 'relationshipCannabis'
  | 'haveKids'
  | 'wantKids'
  | 'politics'
  | 'religion'
  | 'sexDrive'
  | 'sexInterests'
  | 'datingPaceAfterExcitement'
  | 'recentDatingEarlyWeeks'
  | 'lifeDomains'
  | 'typology'
  | 'photos'
  | 'matchPreferences'
  | 'complete';

const ONBOARDING_STEPS_ORDER: OnboardingStep[] = [
  'name',
  'gender',
  'ethnicity',
  'attraction',
  'dateOfBirth',
  'relationshipStyle',
  'longestRelationship',
  'location',
  'occupation',
  'educationLevel',
  'heightWeight',
  'workout',
  'smoking',
  'drinking',
  'recreationalDrugsSocial',
  'relationshipPsychedelics',
  'relationshipCannabis',
  'haveKids',
  'wantKids',
  'politics',
  'religion',
  'sexDrive',
  'sexInterests',
  'datingPaceAfterExcitement',
  'recentDatingEarlyWeeks',
  'lifeDomains',
  'typology',
  'photos',
  'matchPreferences',
  'complete',
];

const TOTAL_STEPS = ONBOARDING_STEPS_ORDER.filter((s) => s !== 'complete').length;

function OnboardingProgressBar({ currentStep }: { currentStep: OnboardingStep }) {
  const index = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
  const progress = index < 0 || currentStep === 'complete' ? 1 : (index + 1) / TOTAL_STEPS;
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
  const didAutoExitCompleteRef = React.useRef(false);
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
            setCurrentStep(progress.data.currentStep as OnboardingStep);
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
          // #region agent log
          if (progress.success && progress.data) {
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
              body: JSON.stringify({
                sessionId: 'c61a43',
                runId: 'investigate-1',
                hypothesisId: 'H_A,H_E',
                location: 'ModalOnboardingFlow.tsx:afterGetProgress',
                message: 'progress applied to state',
                data: {
                  appliedStep: progress.data?.currentStep ?? null,
                  onboardingKeyCount: progress.data?.onboardingData
                    ? Object.keys(progress.data.onboardingData).length
                    : 0,
                  success: progress.success,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          // #endregion
        }
        
        // Check if profile has displayName and populate onboardingData if it doesn't already have a name
        if (isMounted && profile?.displayName && profile.displayName.trim() !== '') {
          setOnboardingData(prev => {
            // Only set name if it's not already set
            if (!prev.name || prev.name.trim() === '') {
              const updated = { ...prev, name: profile.displayName };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has gender and populate onboardingData if it doesn't already exist
        if (isMounted && profile?.gender) {
          setOnboardingData(prev => {
            // Only set gender if it's not already set
            if (!prev.gender || prev.gender.trim() === '') {
              // Convert DB gender format to UI format
              const uiGender = mapGenderToUi(profile.gender);
              if (uiGender) {
                const updated = { ...prev, gender: uiGender };
                onboardingDataRef.current = updated;
                return updated;
              }
            }
            return prev;
          });
        }

        if (
          isMounted &&
          (profile as any)?.ethnicity &&
          String((profile as any).ethnicity).trim() !== ''
        ) {
          setOnboardingData((prev) => {
            if (!prev.ethnicity || prev.ethnicity.trim() === '') {
              const updated = { ...prev, ethnicity: String((profile as any).ethnicity) };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has looking_for and populate onboardingData if it doesn't already exist
        const lookingFor = (profile as any)?.looking_for;
        if (isMounted && lookingFor && Array.isArray(lookingFor) && lookingFor.length > 0) {
          setOnboardingData(prev => {
            // Only set attractedTo if it's not already set
            if (!prev.attractedTo || prev.attractedTo.length === 0) {
              const updated = { ...prev, attractedTo: normalizeAttractedToUiLabels(lookingFor) };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has location and populate onboardingData if it doesn't already exist
        if (isMounted && profile?.location && profile.location.trim() !== '') {
          setOnboardingData(prev => {
            // Only set location if it's not already set
            if (!prev.location || prev.location.trim() === '') {
              const updated = { ...prev, location: profile.location };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }

        if (isMounted && (profile as any)?.occupation && String((profile as any).occupation).trim() !== '') {
          setOnboardingData(prev => {
            if (!prev.occupation || prev.occupation.trim() === '') {
              const updated = { ...prev, occupation: String((profile as any).occupation) };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }

        if (
          isMounted &&
          ((profile as any)?.educationLevel || (profile as any)?.education_level) &&
          String((profile as any).educationLevel ?? (profile as any).education_level).trim() !== ''
        ) {
          setOnboardingData(prev => {
            if (!prev.educationLevel || prev.educationLevel.trim() === '') {
              const updated = {
                ...prev,
                educationLevel: String((profile as any).educationLevel ?? (profile as any).education_level),
              };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Helper function to map database relationship style to UI format
        const mapRelationshipStyleToUi = (dbStyle: string): string | undefined => {
          const normalized = dbStyle?.trim().toLowerCase();
          const mapping: Record<string, string> = {
            'monogamous': 'Monogamous',
            'polyamorous': 'Polyamorous',
            'monogamous-ish': 'Monogam-ish',
            'open': 'Open',
            'other': 'Other',
          };
          return mapping[normalized] || undefined;
        };
        
        // Check if profile has relationshipStyle and populate onboardingData if it doesn't already exist
        if (isMounted && profile?.relationshipStyle) {
          const uiStyle = mapRelationshipStyleToUi(profile.relationshipStyle);
          if (uiStyle) {
            setOnboardingData(prev => {
              // Only set relationshipStyle if it's not already set
              if (!prev.relationshipStyle || prev.relationshipStyle.trim() === '') {
                const updated = { ...prev, relationshipStyle: uiStyle };
                onboardingDataRef.current = updated;
                return updated;
              }
              return prev;
            });
          }
        }

        if (
          isMounted &&
          profile?.longestRomanticRelationship &&
          String(profile.longestRomanticRelationship).trim() !== ''
        ) {
          setOnboardingData((prev) => {
            if (!prev.longestRomanticRelationship || prev.longestRomanticRelationship.trim() === '') {
              const updated = {
                ...prev,
                longestRomanticRelationship: String(profile.longestRomanticRelationship),
              };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has availability and phoneNumber and populate onboardingData if they don't already exist
        if (isMounted && profile?.availability && Array.isArray(profile.availability) && profile.availability.length > 0 && 
            profile?.phoneNumber && profile.phoneNumber.trim() !== '') {
          setOnboardingData(prev => {
            // Only set availability and phoneNumber if they're not already set
            if ((!prev.availability || !Array.isArray(prev.availability) || prev.availability.length === 0) ||
                (!prev.phoneNumber || prev.phoneNumber.trim() === '')) {
              const updated = { 
                ...prev, 
                availability: profile.availability,
                phoneNumber: profile.phoneNumber,
              };
              if (profile.contactPreference) {
                updated.contactPreference = profile.contactPreference;
              }
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has matchPreferences and populate onboardingData if it doesn't already exist
        // Check if matchPreferences exists and is not empty (has at least distanceRange or ageRange)
        if (isMounted && profile?.matchPreferences && 
            typeof profile.matchPreferences === 'object' && 
            (profile.matchPreferences.distanceRange || profile.matchPreferences.ageRange)) {
          setOnboardingData(prev => {
            // Only set matchPreferences if it's not already set
            if (!prev.matchPreferences || 
                !prev.matchPreferences.distanceRange && !prev.matchPreferences.ageRange) {
              const updated = { 
                ...prev, 
                matchPreferences: profile.matchPreferences as any,
              };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
        
        // Check if profile has photos and populate onboardingData if it doesn't already exist
        if (isMounted && profile?.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
          setOnboardingData(prev => {
            // Only set photos if they're not already set
            if (!prev.photos || !Array.isArray(prev.photos) || prev.photos.length === 0) {
              // Filter out any invalid/empty photo URLs
              const validPhotos = profile.photos!.filter(p => p && p.trim() !== '');
              if (validPhotos.length > 0) {
                const updated = { 
                  ...prev, 
                  photos: validPhotos,
                };
                onboardingDataRef.current = updated;
                return updated;
              }
            }
            return prev;
          });
        }
        
        // Helper function to check if lifeDomains is the default value (all 50s)
        const isDefaultLifeDomains = (lifeDomains: any): boolean => {
          if (!lifeDomains || typeof lifeDomains !== 'object') return false;
          return lifeDomains.intimacy === 50 &&
                 lifeDomains.finance === 50 &&
                 lifeDomains.spirituality === 50 &&
                 lifeDomains.family === 50 &&
                 lifeDomains.physicalHealth === 50;
        };
        
        // Check if profile has lifeDomains (and it's not the default value) and populate onboardingData if it doesn't already exist
        if (isMounted && profile?.lifeDomains && typeof profile.lifeDomains === 'object' && !isDefaultLifeDomains(profile.lifeDomains)) {
          setOnboardingData(prev => {
            // Only set lifeDomains if it's not already set
            if (!prev.lifeDomains || typeof prev.lifeDomains !== 'object' || isDefaultLifeDomains(prev.lifeDomains)) {
              const updated = { 
                ...prev, 
                lifeDomains: profile.lifeDomains as any,
              };
              onboardingDataRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error loading onboarding progress:', error);
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'investigate-1',
            hypothesisId: 'H_A',
            location: 'ModalOnboardingFlow.tsx:loadProgressCatch',
            message: 'getProgress load failed',
            data: {
              errName: error instanceof Error ? error.name : typeof error,
              errMsg:
                error instanceof Error ? String(error.message).slice(0, 200) : String(error).slice(0, 200),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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
  }, [user?.id, profile?.displayName, profile?.gender, (profile as any)?.ethnicity, (profile as any)?.looking_for, profile?.location, profile?.relationshipStyle, profile?.longestRomanticRelationship, (profile as any)?.occupation, (profile as any)?.educationLevel, profile?.availability, profile?.phoneNumber, profile?.matchPreferences, profile?.photos, profile?.lifeDomains]);

  React.useEffect(() => {
    if (loading || profileLoading || !user?.id) return;
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        runId: 'investigate-1',
        hypothesisId: 'H_C,H_E',
        location: 'ModalOnboardingFlow.tsx:hydratedUi',
        message: 'loading gates cleared — visible step',
        data: {
          currentStep,
          onboardingKeyCount: Object.keys(onboardingData).length,
          refKeyCount: Object.keys(onboardingDataRef.current).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    const currentIndex = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
    if (currentIndex <= 0) return;
    const prevStep = ONBOARDING_STEPS_ORDER[currentIndex - 1];
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

  const goToNextStep = async () => {
    if (stepTransitionLockRef.current) return;
    const steps = ONBOARDING_STEPS_ORDER;
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex >= steps.length - 1) return;

    const nextStep = steps[currentIndex + 1];
    const latestData = onboardingDataRef.current;
    const stepWeLeave = currentStep;

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

      const uid = user?.id;
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

  useEffect(() => {
    if (loading || profileLoading) return;
    if (currentStep !== 'complete') {
      didAutoExitCompleteRef.current = false;
      return;
    }
    if (didAutoExitCompleteRef.current) return;
    didAutoExitCompleteRef.current = true;
    onComplete();
  }, [loading, profileLoading, currentStep, onComplete]);

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
      <OnboardingProgressBar currentStep={currentStep} />
      {currentStep === 'name' && (
        <NameModal
          name={onboardingData.name || ''}
          onNameChange={(name) => updateData({ name })}
          onNext={goToNextStep}
          onBack={onExitToPostInterview}
        />
      )}

      {currentStep === 'gender' && (
        <GenderModal
          gender={onboardingData.gender || ''}
          onGenderChange={(gender) => updateData({ gender })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'ethnicity' && (
        <SingleChoiceModal
          title="Ethnicity"
          description="How do you identify? Choose the option that fits you best."
          options={ETHNICITY_CHOICES}
          value={onboardingData.ethnicity || ''}
          onValueChange={(v) => updateData({ ethnicity: v })}
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

      {currentStep === 'occupation' && (
        <OccupationModal
          occupation={onboardingData.occupation || ''}
          onOccupationChange={(occupation) => updateData({ occupation })}
          onNext={goToNextStep}
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
          title="Think about your most recent dating experience. In the first 2–3 weeks, what actually happened?"
          options={RECENT_DATING_EARLY_WEEKS_OPTIONS}
          value={onboardingData.recentDatingEarlyWeeks || ''}
          onValueChange={(v) => updateData({ recentDatingEarlyWeeks: v })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'lifeDomains' && (
        <LifeDomainsModal
          lifeDomains={Array.isArray(onboardingData.lifeDomains) ? undefined : onboardingData.lifeDomains}
          onLifeDomainsChange={(lifeDomains) => updateData({ lifeDomains })}
          onNext={goToNextStep}
          onBack={goToPrevStep}
        />
      )}

      {currentStep === 'typology' && (
        <TypologyModal
          typology={onboardingData.typology}
          onTypologyChange={(typology) => updateData({ typology })}
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

      {currentStep === 'matchPreferences' && (
        <MatchPreferencesModal
          matchPreferences={onboardingData.matchPreferences}
          location={onboardingData.location}
          userAge={profile?.age}
          prefPhysicalCompatImportance={onboardingData.prefPhysicalCompatImportance}
          prefPartnerSharesSexualInterests={onboardingData.prefPartnerSharesSexualInterests}
          onPrefPhysicalCompatImportanceChange={(v: string) => updateData({ prefPhysicalCompatImportance: v })}
          onPrefPartnerSharesSexualInterestsChange={(v: string) =>
            updateData({ prefPartnerSharesSexualInterests: v })
          }
          prefPartnerHasChildren={onboardingData.prefPartnerHasChildren}
          onPrefPartnerHasChildrenChange={(v: string) => updateData({ prefPartnerHasChildren: v })}
          prefPartnerPoliticalAlignmentImportance={onboardingData.prefPartnerPoliticalAlignmentImportance}
          onPrefPartnerPoliticalAlignmentImportanceChange={(v: string) =>
            updateData({ prefPartnerPoliticalAlignmentImportance: v })
          }
          onMatchPreferencesChange={(matchPreferences) => updateData({ matchPreferences })}
          onNext={handleComplete}
          onBack={goToPrevStep}
        />
      )}
    </View>
  );
};

