import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  LifeDomainDistribution,
  DEFAULT_ONBOARDING_LIFE_DOMAINS,
  type OnboardingLifeDomainValues,
} from '@/shared/components/LifeDomainDistribution';
import { styles } from './LifeDomainsModal.styled';

interface LifeDomainsModalProps {
  lifeDomains?: {
    intimacy?: number;
    finance?: number;
    spirituality?: number;
    family?: number;
    physicalHealth?: number;
  };
  onLifeDomainsChange: (lifeDomains: {
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

const DEFAULT_SLIDER_VALUES: OnboardingLifeDomainValues = { ...DEFAULT_ONBOARDING_LIFE_DOMAINS };

export const LifeDomainsModal: React.FC<LifeDomainsModalProps> = ({
  lifeDomains,
  onLifeDomainsChange,
  onNext,
  onBack,
}) => {
  const currentValues = useMemo(() => {
    if (lifeDomains != null && typeof lifeDomains === "object") {
      return {
        intimacy: lifeDomains.intimacy ?? 0,
        finance: lifeDomains.finance ?? 0,
        spirituality: lifeDomains.spirituality ?? 0,
        family: lifeDomains.family ?? 0,
        physicalHealth: lifeDomains.physicalHealth ?? 0,
      } as OnboardingLifeDomainValues;
    }
    return { ...DEFAULT_SLIDER_VALUES };
  }, [lifeDomains]);

  const total = Object.values(currentValues).reduce((sum, val) => sum + (val || 0), 0);
  const isValid = total === 100;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Life Domain Priorities" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Distribute 100 points across the 5 life domains to indicate how important each is to you. All domains must add up to exactly 100.
          </Text>

          <View style={styles.rankingWrapper}>
            <LifeDomainDistribution 
              values={currentValues}
              onValuesChange={(values) => onLifeDomainsChange(values)}
            />
          </View>
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
          <Button
            title="Next"
            onPress={onNext}
            disabled={!isValid}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};


