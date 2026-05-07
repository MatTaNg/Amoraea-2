import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { RELATIONSHIP_STYLE_CHOICES } from '@/screens/profile/editProfile/aboutYouOptions';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './RelationshipStyleModal.styled';

interface RelationshipStyleModalProps {
  relationshipStyle: string;
  onRelationshipStyleChange: (style: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const RelationshipStyleModal: React.FC<RelationshipStyleModalProps> = ({
  relationshipStyle,
  onRelationshipStyleChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Relationship type" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <SingleChoiceOptionList
            options={RELATIONSHIP_STYLE_CHOICES}
            value={relationshipStyle}
            onSelect={(v) => {
              onRelationshipStyleChange(v);
              onNext();
            }}
            variant="onboarding"
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="outline"
            onPress={onBack}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

