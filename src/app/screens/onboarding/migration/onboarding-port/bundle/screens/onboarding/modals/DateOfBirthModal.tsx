import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/components/DatePicker';
import { Input } from '@/shared/ui/Input';
import { theme } from '@/shared/theme/theme';
import { OnboardingHeader } from './components/OnboardingHeader';
import { calculateAgeFromBirthdate } from '@/shared/utils/ageCalculator';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { styles } from './DateOfBirthModal.styled';

const MIN_AGE = 18;

function isValidOptionalTime24h(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

const QUARTER_HOUR_TIME_OPTIONS: { label: string; value: string }[] = (() => {
  const out: { label: string; value: string }[] = [{ label: 'Not specified', value: '' }];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 15, 30, 45]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      out.push({ label: value, value });
    }
  }
  return out;
})();

interface DateOfBirthModalProps {
  dateOfBirth: string;
  onDateOfBirthChange: (date: string) => void;
  birthTime: string;
  onBirthTimeChange: (value: string) => void;
  birthLocation: string;
  onBirthLocationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const DateOfBirthModal: React.FC<DateOfBirthModalProps> = ({
  dateOfBirth,
  onDateOfBirthChange,
  birthTime,
  onBirthTimeChange,
  birthLocation,
  onBirthLocationChange,
  onNext,
  onBack,
}) => {
  const maxSelectableYear = useMemo(() => new Date().getFullYear() - MIN_AGE, []);
  const age = useMemo(
    () => (dateOfBirth ? calculateAgeFromBirthdate(dateOfBirth) : null),
    [dateOfBirth]
  );
  const isUnderage = age !== null && age < MIN_AGE;
  const timeOk = isValidOptionalTime24h(birthTime);

  const timePickerOptions = useMemo(() => {
    const t = birthTime.trim();
    if (!t || QUARTER_HOUR_TIME_OPTIONS.some((o) => o.value === t)) {
      return QUARTER_HOUR_TIME_OPTIONS;
    }
    if (isValidOptionalTime24h(t)) {
      return [
        QUARTER_HOUR_TIME_OPTIONS[0],
        { label: `${t} (saved)`, value: t },
        ...QUARTER_HOUR_TIME_OPTIONS.slice(1),
      ];
    }
    return QUARTER_HOUR_TIME_OPTIONS;
  }, [birthTime]);

  const canContinue =
    !!dateOfBirth && !!dateOfBirth.trim() && !isUnderage && timeOk;

  const [birthLocationSuggestions, setBirthLocationSuggestions] = useState<
    Array<{ label: string }>
  >([]);
  const [validatedBirthLocation, setValidatedBirthLocation] = useState<string | undefined>(
    undefined
  );

  const onBirthSuggestionsChange = useCallback((suggestions: Array<{ label: string }>) => {
    setBirthLocationSuggestions(suggestions);
  }, []);

  useLocationAutocomplete({
    value: birthLocation,
    validatedValue: validatedBirthLocation,
    onSuggestionsChange: onBirthSuggestionsChange,
    minLength: 3,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Date of Birth" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <DatePicker
            label="Date of birth"
            value={dateOfBirth || ''}
            onValueChange={onDateOfBirthChange}
            minYear={1900}
            maxYear={maxSelectableYear}
          />
          {isUnderage && (
            <Text style={styles.errorText}>
              You must be 18 or older to use this app.
            </Text>
          )}

          <View style={styles.optionalSection}>
            <Text style={styles.optionalHint}>
              The following fields are optional. They can improve astrology and
              compatibility insights if you choose to add them.
            </Text>
            <View style={styles.fieldGap}>
              <Text style={styles.timeLabel}>Time of birth (optional)</Text>
              <View style={styles.timePickerWrapper}>
                <Picker
                  selectedValue={birthTime.trim() === '' ? '' : birthTime.trim()}
                  onValueChange={(v) => onBirthTimeChange(String(v))}
                  style={[
                    styles.timePicker,
                    Platform.OS === 'web'
                      ? [
                          styles.timePickerWeb,
                          {
                            WebkitAppearance: 'none',
                            appearance: 'none',
                          } as const,
                        ]
                      : null,
                  ]}
                  dropdownIconColor={theme.colors.textSecondary}
                  mode={Platform.OS === 'android' ? 'dropdown' : undefined}
                  itemStyle={
                    Platform.OS === 'ios'
                      ? { color: theme.colors.text, fontSize: 17 }
                      : undefined
                  }
                >
                  {timePickerOptions.map((o) => (
                    <Picker.Item
                      key={o.value === '' ? '__none__' : o.value}
                      label={o.label}
                      value={o.value}
                      color={theme.colors.text}
                    />
                  ))}
                </Picker>
              </View>
              {birthTime.trim() !== '' && !timeOk && (
                <Text style={styles.errorText}>
                  Use 24-hour format HH:MM (e.g. 09:05 or 14:30).
                </Text>
              )}
            </View>
            <View style={styles.optionalLocationNarrow}>
              <Input
                label="Location of birth (optional)"
                value={birthLocation}
                onChangeText={(v) => {
                  onBirthLocationChange(v);
                  if (v.trim() === '') {
                    setValidatedBirthLocation(undefined);
                  } else if (
                    validatedBirthLocation !== undefined &&
                    v.trim() !== validatedBirthLocation
                  ) {
                    setValidatedBirthLocation(undefined);
                  }
                }}
                placeholder="e.g. city, region, or hospital"
                autoCapitalize="words"
              />
              {birthLocationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {birthLocationSuggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={`${idx}-${s.label.slice(0, 40)}`}
                      style={styles.suggestionButton}
                      onPress={() => {
                        onBirthLocationChange(s.label);
                        setValidatedBirthLocation(s.label);
                        setBirthLocationSuggestions([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
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
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
