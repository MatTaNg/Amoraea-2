import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Button } from "@/shared/ui/Button";
import {
  LifeDomainDistribution,
  type OnboardingLifeDomainValues,
} from "@/shared/components/LifeDomainDistribution";
import { styles } from "../ProfileBuilderScreen.styled";
import { useProfile } from "@/shared/hooks/useProfile";

interface LifeDomainsStepProps {
  guidance: string;
  lifeDomainValues: {
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  };
  savingLifeDomains: boolean;
  userId: string;
  onValuesChange: (values: {
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  }) => void;
  onStepChange: (step: "filters" | "photos") => void;
}

export const LifeDomainsStep: React.FC<LifeDomainsStepProps> = ({
  guidance,
  lifeDomainValues,
  savingLifeDomains,
  userId,
  onValuesChange,
  onStepChange,
}) => {
  const { updateProfile } = useProfile();

  const valuesAsRecord = lifeDomainValues as OnboardingLifeDomainValues;
  const total = Object.values(lifeDomainValues).reduce((sum, val) => sum + (val || 0), 0);
  const isValid = total === 100;

  const handleContinue = () => {
    void updateProfile({ lifeDomains: valuesAsRecord }).catch((err) => {
      if (__DEV__) console.warn('[LifeDomainsStep] background save failed', err);
    });
    onStepChange('photos');
  };

  return (
    <View>
      <Text style={styles.title}>Life Domain Priorities</Text>
      <Text style={styles.help}>{guidance}</Text>

      <LifeDomainDistribution 
        values={valuesAsRecord}
        onValuesChange={(values) => onValuesChange(values)}
      />

      <View style={styles.row}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => onStepChange("filters")}
        />
        <Button
          title={savingLifeDomains ? 'Saving…' : 'Continue'}
          onPress={handleContinue}
          disabled={savingLifeDomains || !isValid}
        />
      </View>
    </View>
  );
};

