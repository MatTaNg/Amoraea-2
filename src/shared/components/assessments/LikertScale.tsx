import React from 'react';
import { View } from 'react-native';
import { QuestionnaireOption } from './QuestionnaireStepLayout';

export const LikertScale: React.FC<{
  min: number;
  max: number;
  value: number | null;
  onChange: (n: number) => void;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
}> = ({ min, max, value, onChange, minLabel, maxLabel, disabled }) => {
  const items: number[] = [];
  for (let i = min; i <= max; i++) items.push(i);
  return (
    <View>
      {items.map((n) => {
        const endpoint = n === min ? minLabel : n === max ? maxLabel : undefined;
        const label = endpoint ? `${n}   ${endpoint}` : String(n);
        return (
          <QuestionnaireOption
            key={n}
            label={label}
            selected={value === n}
            onPress={() => onChange(n)}
            disabled={disabled}
          />
        );
      })}
    </View>
  );
};
