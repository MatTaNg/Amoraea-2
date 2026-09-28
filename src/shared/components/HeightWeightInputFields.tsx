import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { formControlStyles } from '@/shared/ui/FormField';
import { UnitSegmentedControl } from '@/shared/ui/UnitSegmentedControl';
import { prefersImperialUnits } from '@/shared/utils/deviceLocaleUnits';
import {
  cmToFtIn,
  formatWeightKgDisplay,
  formatWeightLbDisplay,
  ftInToCm,
  lbToKg,
  normalizeFtInParts,
  validateHeightCm,
  validateWeightKg,
} from '@/shared/utils/unitConversions';

export type HeightUnit = 'ft_in' | 'cm';
export type WeightUnit = 'lb' | 'kg';

export type HeightWeightInputFieldsProps = {
  heightCm?: number;
  weightKg?: number;
  onHeightCmChange: (cm: number | undefined) => void;
  onWeightKgChange: (kg: number | undefined) => void;
};

const HEIGHT_UNIT_OPTIONS = [
  { label: 'ft/in', value: 'ft_in' as const },
  { label: 'cm', value: 'cm' as const },
];

const WEIGHT_UNIT_OPTIONS = [
  { label: 'lb', value: 'lb' as const },
  { label: 'kg', value: 'kg' as const },
];

export function HeightWeightInputFields({
  heightCm,
  weightKg,
  onHeightCmChange,
  onWeightKgChange,
}: HeightWeightInputFieldsProps) {
  const defaultImperial = useMemo(() => prefersImperialUnits(), []);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(() =>
    defaultImperial ? 'ft_in' : 'cm',
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() =>
    defaultImperial ? 'lb' : 'kg',
  );

  const [cmText, setCmText] = useState('');
  const [feetText, setFeetText] = useState('');
  const [inchesText, setInchesText] = useState('');
  const [weightText, setWeightText] = useState('');

  const cmFocusedRef = useRef(false);
  const feetFocusedRef = useRef(false);
  const inchesFocusedRef = useRef(false);
  const weightFocusedRef = useRef(false);

  const syncHeightDisplayFromCanonical = useCallback(
    (cm: number | undefined, unit: HeightUnit) => {
      if (unit === 'cm') {
        setCmText(cm != null && Number.isFinite(cm) ? String(Math.round(cm)) : '');
        return;
      }
      if (cm == null || !Number.isFinite(cm)) {
        setFeetText('');
        setInchesText('');
        return;
      }
      const { feet, inches } = cmToFtIn(cm);
      setFeetText(String(feet));
      setInchesText(String(inches));
    },
    [],
  );

  const syncWeightDisplayFromCanonical = useCallback(
    (kg: number | undefined, unit: WeightUnit) => {
      if (kg == null || !Number.isFinite(kg)) {
        setWeightText('');
        return;
      }
      setWeightText(unit === 'lb' ? formatWeightLbDisplay(kg) : formatWeightKgDisplay(kg));
    },
    [],
  );

  useEffect(() => {
    if (cmFocusedRef.current || feetFocusedRef.current || inchesFocusedRef.current) return;
    syncHeightDisplayFromCanonical(heightCm, heightUnit);
  }, [heightCm, heightUnit, syncHeightDisplayFromCanonical]);

  useEffect(() => {
    if (weightFocusedRef.current) return;
    syncWeightDisplayFromCanonical(weightKg, weightUnit);
  }, [weightKg, weightUnit, syncWeightDisplayFromCanonical]);

  const commitFtInText = (nextFeet: string, nextInches: string) => {
    const normalized = normalizeFtInParts(nextFeet, nextInches);
    setFeetText(normalized.feetText);
    setInchesText(normalized.inchesText);
    if (!normalized.feetText && !normalized.inchesText) {
      onHeightCmChange(undefined);
      return;
    }
    if (!normalized.feetText || !normalized.inchesText) {
      onHeightCmChange(undefined);
      return;
    }
    onHeightCmChange(ftInToCm(normalized.feet, normalized.inches));
  };

  const onHeightUnitChange = (next: HeightUnit) => {
    if (next === heightUnit) return;
    setHeightUnit(next);
    syncHeightDisplayFromCanonical(heightCm, next);
  };

  const onWeightUnitChange = (next: WeightUnit) => {
    if (next === weightUnit) return;
    setWeightUnit(next);
    syncWeightDisplayFromCanonical(weightKg, next);
  };

  const heightIncomplete =
    heightUnit === 'ft_in' &&
    ((feetText.trim() !== '' && inchesText.trim() === '') ||
      (feetText.trim() === '' && inchesText.trim() !== ''));

  const heightError =
    validateHeightCm(heightCm) ??
    (heightIncomplete ? 'Enter both feet and inches.' : undefined);

  const weightError = validateWeightKg(weightKg);

  return (
    <View style={styles.root}>
      <View style={styles.fieldBlock}>
        <View style={styles.labelRow}>
          <Text style={formControlStyles.label}>Height</Text>
          <UnitSegmentedControl
            options={HEIGHT_UNIT_OPTIONS}
            value={heightUnit}
            onChange={onHeightUnitChange}
            accessibilityLabel="Height unit"
          />
        </View>

        {heightUnit === 'cm' ? (
          <TextInput
            value={cmText}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 3);
              setCmText(digits);
              if (!digits) {
                onHeightCmChange(undefined);
                return;
              }
              const cm = parseInt(digits, 10);
              onHeightCmChange(Number.isFinite(cm) ? cm : undefined);
            }}
            onFocus={() => {
              cmFocusedRef.current = true;
            }}
            onBlur={() => {
              cmFocusedRef.current = false;
            }}
            placeholder="e.g. 172"
            placeholderTextColor="rgba(200,217,238,0.55)"
            keyboardType="number-pad"
            style={[
              formControlStyles.control,
              formControlStyles.inputText,
              heightError ? formControlStyles.controlError : null,
            ]}
            accessibilityLabel="Height in centimeters"
          />
        ) : (
          <View style={styles.ftInRow}>
            <View style={styles.ftInCol}>
              <Text style={styles.subLabel}>Feet</Text>
              <TextInput
                value={feetText}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 1);
                  const normalized = normalizeFtInParts(digits, inchesText);
                  setFeetText(normalized.feetText);
                  setInchesText(normalized.inchesText);
                  commitFtInText(normalized.feetText, normalized.inchesText);
                }}
                onFocus={() => {
                  feetFocusedRef.current = true;
                }}
                onBlur={() => {
                  feetFocusedRef.current = false;
                }}
                placeholder="5"
                placeholderTextColor="rgba(200,217,238,0.55)"
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  formControlStyles.control,
                  formControlStyles.inputText,
                  styles.ftInInput,
                  heightError ? formControlStyles.controlError : null,
                ]}
                accessibilityLabel="Height feet"
              />
            </View>
            <View style={styles.ftInCol}>
              <Text style={styles.subLabel}>Inches</Text>
              <TextInput
                value={inchesText}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 2);
                  const normalized = normalizeFtInParts(feetText, digits);
                  setFeetText(
                    normalized.feetText ||
                      (normalized.feet > 0 ? String(normalized.feet) : feetText),
                  );
                  setInchesText(normalized.inchesText);
                  commitFtInText(
                    normalized.feetText ||
                      (normalized.feet > 0 ? String(normalized.feet) : feetText),
                    normalized.inchesText,
                  );
                }}
                onFocus={() => {
                  inchesFocusedRef.current = true;
                }}
                onBlur={() => {
                  inchesFocusedRef.current = false;
                }}
                placeholder="10"
                placeholderTextColor="rgba(200,217,238,0.55)"
                keyboardType="number-pad"
                maxLength={2}
                style={[
                  formControlStyles.control,
                  formControlStyles.inputText,
                  styles.ftInInput,
                  heightError ? formControlStyles.controlError : null,
                ]}
                accessibilityLabel="Height inches"
              />
            </View>
          </View>
        )}
        {heightError ? <Text style={formControlStyles.errorText}>{heightError}</Text> : null}
      </View>

      <View style={styles.fieldBlock}>
        <View style={styles.labelRow}>
          <Text style={formControlStyles.label}>Weight</Text>
          <UnitSegmentedControl
            options={WEIGHT_UNIT_OPTIONS}
            value={weightUnit}
            onChange={onWeightUnitChange}
            accessibilityLabel="Weight unit"
          />
        </View>
        <TextInput
          value={weightText}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^\d.]/g, '').slice(0, weightUnit === 'lb' ? 3 : 5);
            setWeightText(cleaned);
            if (!cleaned) {
              onWeightKgChange(undefined);
              return;
            }
            const n = parseFloat(cleaned);
            if (!Number.isFinite(n)) {
              onWeightKgChange(undefined);
              return;
            }
            onWeightKgChange(weightUnit === 'lb' ? lbToKg(n) : Math.round(n * 10) / 10);
          }}
          onFocus={() => {
            weightFocusedRef.current = true;
          }}
          onBlur={() => {
            weightFocusedRef.current = false;
          }}
          placeholder={weightUnit === 'lb' ? 'e.g. 165' : 'e.g. 75'}
          placeholderTextColor="rgba(200,217,238,0.55)"
          keyboardType="decimal-pad"
          style={[
            formControlStyles.control,
            formControlStyles.inputText,
            weightError ? formControlStyles.controlError : null,
          ]}
          accessibilityLabel={weightUnit === 'lb' ? 'Weight in pounds' : 'Weight in kilograms'}
        />
        {weightError ? <Text style={formControlStyles.errorText}>{weightError}</Text> : null}
      </View>
    </View>
  );
}

export function isHeightWeightInputComplete(
  heightCm: number | undefined,
  weightKg: number | undefined,
): boolean {
  return (
    heightCm != null &&
    weightKg != null &&
    !validateHeightCm(heightCm) &&
    !validateWeightKg(weightKg)
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  fieldBlock: {
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  ftInRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  ftInCol: {
    flex: 1,
    maxWidth: 120,
  },
  subLabel: {
    color: 'rgba(200,217,238,0.72)',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  ftInInput: {
    textAlign: 'center',
    minHeight: 56,
  },
});
