import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { Picker } from '@react-native-picker/picker';
import { Input } from '@/shared/ui/Input';
import { AvailabilityModal } from '@/screens/profile/components/AvailabilityModal';
import { UserProfile, AvailabilitySlot } from '@/src/types';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../AvailabilityContactModal.styled';

interface AvailabilityContactModalProps {
  availability: AvailabilitySlot[];
  contactPreference: string;
  phoneNumber: string;
  onAvailabilityChange: (availability: AvailabilitySlot[]) => void;
  onContactPreferenceChange: (pref: string) => void;
  onPhoneNumberChange: (phone: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const AvailabilityContactModal: React.FC<AvailabilityContactModalProps> = ({
  availability,
  contactPreference,
  phoneNumber,
  onAvailabilityChange,
  onContactPreferenceChange,
  onPhoneNumberChange,
  onNext,
  onBack,
}) => {
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  
  // Create a temporary profile for the AvailabilityModal
  const tempProfile: UserProfile = {
    id: '',
    email: '',
    displayName: '',
    tier: 'FREE',
    createdAt: new Date().toISOString(),
    availability: availability,
    contactPreference: contactPreference as any,
    phoneNumber: phoneNumber,
  } as UserProfile;

  const handleAvailabilitySave = (updatedProfile: UserProfile) => {
    onAvailabilityChange(updatedProfile.availability || []);
    onContactPreferenceChange(updatedProfile.contactPreference || 'sms');
    onPhoneNumberChange(updatedProfile.phoneNumber || '');
    setShowAvailabilityModal(false);
  };

  const canContinue = availability.length > 0 && contactPreference && phoneNumber.trim();

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <OnboardingHeader title="Set my availability and contact info" onBack={onBack} />
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Text style={styles.description}>
              Availability is needed to schedule your video dates. Your contact information
              is only given when you choose to connect with your video date further.
            </Text>

            <Button
              title={availability.length > 0 
                ? `Availability: ${availability.length} slot${availability.length !== 1 ? 's' : ''} set`
                : "Set Availability & Contact Info"}
              variant={availability.length > 0 ? "primary" : "outline"}
              onPress={() => setShowAvailabilityModal(true)}
              style={styles.availabilityButton}
            />

            {availability.length > 0 && (
              <View style={styles.contactSection}>
                <Text style={styles.contactLabel}>Best way to contact me:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={contactPreference}
                    onValueChange={onContactPreferenceChange}
                  >
                    <Picker.Item label="SMS" value="sms" />
                    <Picker.Item label="WhatsApp" value="whatsapp" />
                    <Picker.Item label="Telegram" value="telegram" />
                    <Picker.Item label="Signal" value="signal" />
                  </Picker>
                </View>

                <Input
                  label="Phone Number"
                  value={phoneNumber}
                  onChangeText={onPhoneNumberChange}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                />
              </View>
            )}

            <View style={styles.buttonRow}>
              <Button
                title="Back"
                variant="outline"
                onPress={onBack}
                style={styles.backButton}
              />
              <Button
                title="Next"
                onPress={onNext}
                disabled={!canContinue}
                style={styles.nextButton}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <AvailabilityModal
        visible={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        profile={tempProfile}
        loading={false}
        onProfileUpdate={handleAvailabilitySave}
        onSave={handleAvailabilitySave}
      />
    </>
  );
};

