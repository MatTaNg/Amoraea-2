import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Button } from "@/shared/ui/Button";
import { useProfile } from "@/shared/hooks/useProfile";
import { styles } from "../ProfileBuilderScreen.styled";

interface OnboardingIntroModalProps {
  visible: boolean;
  userId: string | undefined;
  onClose: () => void;
}

export const OnboardingIntroModal: React.FC<OnboardingIntroModalProps> = ({
  visible,
  userId,
  onClose,
}) => {
  const { updateProfile } = useProfile();
  
  const handleStart = async () => {
    onClose();
    // Mark onboarding intro as seen
    if (userId) {
      await updateProfile({
        hasSeenOnboardingIntro: true,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalContainer}
        activeOpacity={1}
        onPress={onClose}
      >
        <ScrollView>
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Welcome to Onboarding!</Text>

            <Text style={styles.modalText}>
              The onboarding process can take up to an hour to complete. It is
              not meant to be completed in one sitting.
            </Text>

            <Text style={styles.modalText}>
              If you close the app and reopen it again, you can continue where
              you left off from. Your progress is automatically saved as you go
              through each step.
            </Text>

            <Text style={styles.modalText}>
              Take your time, and feel free to take breaks whenever you need
              them!
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title="Let's get started!"
                onPress={handleStart}
              />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
};


