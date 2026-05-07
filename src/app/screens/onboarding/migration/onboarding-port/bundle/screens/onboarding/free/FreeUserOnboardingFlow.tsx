import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { useProfile } from '@/shared/hooks/useProfile';
import { WelcomeModal } from '../modals/WelcomeModal';
import { NameModal } from '../modals/NameModal';
import { BirthDetailsModal } from '../modals/BirthDetailsModal';
import { GenderModal } from '../modals/GenderModal';
import { AttractionModal } from '../modals/AttractionModal';
import { RelationshipStyleModal } from '../modals/RelationshipStyleModal';
import { LocationModal } from '../modals/LocationModal';
import { AvailabilityContactModal } from '../modals/AvailabilityContactModal';
import { PhotosVideoModal } from '../modals/PhotosVideoModal';
import { BioModal } from '../modals/BioModal';
import { modalOnboardingService } from './services/modalOnboardingService';
import { OnboardingData } from './types';
import { mapAttractionToDb } from '@/shared/utils/attractionMapper';

export type OnboardingStep = 
  | 'welcome'
  | 'name'
  | 'birthDetails'
  | 'gender'
  | 'attraction'
  | 'relationshipStyle'
  | 'location'
  | 'availability'
  | 'photos'
  | 'bio'
  | 'complete';

interface ModalOnboardingFlowProps {
  onComplete: () => void;
}

export const ModalOnboardingFlow: React.FC<ModalOnboardingFlowProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);

  // Load saved progress on mount
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const progress = await modalOnboardingService.getProgress(user.id);
        if (progress.success && progress.data) {
          setCurrentStep(progress.data.currentStep as OnboardingStep);
          setOnboardingData(progress.data.onboardingData || {});
        }
      } catch (error) {
        console.error('Error loading onboarding progress:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Save progress whenever step or data changes
  useEffect(() => {
    if (!user?.id || loading || currentStep === 'welcome') return;

    (async () => {
      try {
        await modalOnboardingService.saveProgress(user.id, {
          currentStep,
          onboardingData,
        });
      } catch (error) {
        console.error('Error saving onboarding progress:', error);
      }
    })();
  }, [user?.id, currentStep, onboardingData, loading]);

  const updateData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }));
  };

  const goToNextStep = () => {
    const steps: OnboardingStep[] = [
      'welcome',
      'name',
      'birthDetails',
      'gender',
      'attraction',
      'relationshipStyle',
      'location',
      'availability',
      'photos',
      'bio',
      'complete',
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) return;
    
    try {
      // Save all data to profile
      await modalOnboardingService.completeOnboarding(user.id, onboardingData);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {currentStep === 'welcome' && (
        <WelcomeModal
          visible={true}
          onNext={goToNextStep}
        />
      )}

      {currentStep === 'name' && (
        <NameModal
          visible={true}
          name={onboardingData.name || ''}
          onNameChange={(name) => updateData({ name })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('welcome')}
        />
      )}

      {currentStep === 'birthDetails' && (
        <BirthDetailsModal
          visible={true}
          birthPlace={onboardingData.birthPlace || ''}
          birthDate={onboardingData.birthDate || ''}
          birthTime={onboardingData.birthTime || ''}
          onBirthPlaceChange={(place) => updateData({ birthPlace: place })}
          onBirthDateChange={(date) => updateData({ birthDate: date })}
          onBirthTimeChange={(time) => updateData({ birthTime: time })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('name')}
        />
      )}

      {currentStep === 'gender' && (
        <GenderModal
          visible={true}
          gender={onboardingData.gender || ''}
          onGenderChange={(gender) => updateData({ gender })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('birthDetails')}
        />
      )}

      {currentStep === 'attraction' && (
        <AttractionModal
          visible={true}
          attractedTo={onboardingData.attractedTo || []}
          onAttractedToChange={(attractedTo) => updateData({ attractedTo })}
          onNext={async (picked?: string[]) => {
            const at =
              picked && picked.length > 0
                ? picked
                : onboardingData.attractedTo && onboardingData.attractedTo.length > 0
                  ? onboardingData.attractedTo
                  : undefined;
            if (at && at.length > 0 && user?.id) {
              try {
                const { profilesRepo } = await import('@/data/repos/profilesRepo');
                const mappedAttraction = mapAttractionToDb(at);
                if (mappedAttraction) {
                  await profilesRepo.updateProfile(user.id, {
                    attractedTo: mappedAttraction,
                  });
                  console.log('Saved attracted_to to Supabase:', mappedAttraction, 'from:', at);
                }
              } catch (error) {
                console.error('Error saving attracted_to:', error);
              }
            }
            goToNextStep();
          }}
          onBack={() => setCurrentStep('gender')}
        />
      )}

      {currentStep === 'relationshipStyle' && (
        <RelationshipStyleModal
          visible={true}
          relationshipStyle={onboardingData.relationshipStyle || ''}
          onRelationshipStyleChange={(style) => updateData({ relationshipStyle: style })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('attraction')}
        />
      )}

      {currentStep === 'location' && (
        <LocationModal
          visible={true}
          location={onboardingData.location || ''}
          onLocationChange={(location) => updateData({ location })}
          onNext={async () => {
            // Geocode location and save coordinates immediately when Next is clicked
            if (onboardingData.location && onboardingData.location.trim() !== '' && user?.id) {
              try {
                const { profilesRepo } = await import('@/data/repos/profilesRepo');
                const { geocodeLocation } = await import('@/shared/utils/geocoding');
                const coordinates = await geocodeLocation(onboardingData.location);
                
                const profileUpdates: any = {
                  location: onboardingData.location.trim(),
                };
                
                // Include coordinates if geocoding succeeded
                if (coordinates) {
                  profileUpdates.lat = coordinates.latitude;
                  profileUpdates.lon = coordinates.longitude;
                  console.log('Geocoded location and saved coordinates to Supabase:', {
                    location: onboardingData.location,
                    lat: coordinates.latitude,
                    lon: coordinates.longitude,
                  });
                } else {
                  console.warn('Geocoding failed for location:', onboardingData.location);
                }
                
                await profilesRepo.updateProfile(user.id, profileUpdates);
              } catch (error) {
                console.error('Error geocoding and saving location:', error);
              }
            }
            // Then proceed to next step
            goToNextStep();
          }}
          onBack={() => setCurrentStep('relationshipStyle')}
        />
      )}

      {currentStep === 'availability' && (
        <AvailabilityContactModal
          visible={true}
          availability={onboardingData.availability || []}
          contactPreference={onboardingData.contactPreference || 'sms'}
          phoneNumber={onboardingData.phoneNumber || ''}
          onAvailabilityChange={(availability) => updateData({ availability })}
          onContactPreferenceChange={(pref) => updateData({ contactPreference: pref })}
          onPhoneNumberChange={(phone) => updateData({ phoneNumber: phone })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('location')}
        />
      )}

      {currentStep === 'photos' && (
        <PhotosVideoModal
          photos={onboardingData.photos || []}
          onPhotosChange={(photos) => updateData({ photos })}
          onNext={goToNextStep}
          onBack={() => setCurrentStep('availability')}
        />
      )}

      {currentStep === 'bio' && (
        <BioModal
          visible={true}
          bio={onboardingData.bio || ''}
          onBioChange={(bio) => updateData({ bio })}
          onNext={handleComplete}
          onBack={() => setCurrentStep('photos')}
        />
      )}
    </View>
  );
};

