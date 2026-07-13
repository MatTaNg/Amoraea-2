import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { styles } from './WelcomeModal.styled';

interface WelcomeModalProps {
  onNext: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onNext }) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Logo placeholder - replace with actual logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Amoraea</Text>
          </View>

          <Text style={styles.welcomeText}>Welcome to Amoraea</Text>
          
          <Text style={styles.description}>
            We're excited to have you join our community! Amoraea is a dating app that uses
            ancient wisdom like Vedic astrology and Human Design to help you find deeper,
            more meaningful connections. Let's get started building your profile.
          </Text>
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <Button
          title="Get Started"
          onPress={onNext}
          style={styles.button}
        />
      </SafeAreaView>
    </SafeAreaView>
  );
};

