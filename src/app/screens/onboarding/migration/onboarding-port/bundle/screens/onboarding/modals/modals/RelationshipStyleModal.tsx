import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../RelationshipStyleModal.styled';

interface RelationshipStyleModalProps {
  relationshipStyle: string;
  onRelationshipStyleChange: (style: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const RELATIONSHIP_OPTIONS = [
  'Monogamous',
  'Polyamorous',
  'Monogam-ish',
  'Open',
  'Other',
];

export const RelationshipStyleModal: React.FC<RelationshipStyleModalProps> = ({
  relationshipStyle,
  onRelationshipStyleChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingHeader title="My relationship style is" onBack={onBack} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                relationshipStyle === option && styles.optionSelected,
              ]}
              onPress={() => onRelationshipStyleChange(option)}
            >
              <Text style={[
                styles.optionText,
                relationshipStyle === option && styles.optionTextSelected,
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}

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
              disabled={!relationshipStyle}
              style={styles.nextButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

