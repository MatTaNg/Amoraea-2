import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/shared/theme/theme';

const TIME_PICKER_WIDTH = 200;

export function isValidOptionalBirthTime24h(s: string): boolean {
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

export type BirthTimeQuarterHourPickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
};

/** Quarter-hour birth time dropdown (matches onboarding `DateOfBirthModal`). */
export const BirthTimeQuarterHourPicker: React.FC<BirthTimeQuarterHourPickerProps> = ({
  value,
  onValueChange,
  label = 'Birth time',
}) => {
  const timePickerOptions = useMemo(() => {
    const t = value.trim();
    if (!t || QUARTER_HOUR_TIME_OPTIONS.some((o) => o.value === t)) {
      return QUARTER_HOUR_TIME_OPTIONS;
    }
    if (isValidOptionalBirthTime24h(t)) {
      return [
        QUARTER_HOUR_TIME_OPTIONS[0],
        { label: `${t} (saved)`, value: t },
        ...QUARTER_HOUR_TIME_OPTIONS.slice(1),
      ];
    }
    return QUARTER_HOUR_TIME_OPTIONS;
  }, [value]);

  const timeOk = isValidOptionalBirthTime24h(value);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.timePickerWrapper}>
        <Picker
          selectedValue={value.trim() === '' ? '' : value.trim()}
          onValueChange={(v) => onValueChange(String(v))}
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
          itemStyle={Platform.OS === 'ios' ? { color: theme.colors.text, fontSize: 17 } : undefined}
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
      {value.trim() !== '' && !timeOk ? (
        <Text style={styles.errorText}>Use 24-hour format HH:MM (e.g. 09:05 or 14:30).</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    marginTop: 8,
    lineHeight: 18,
  },
  timePickerWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    width: TIME_PICKER_WIDTH,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  timePicker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    ...(Platform.OS === 'ios' ? { height: 148 } : Platform.OS === 'android' ? { height: 56 } : {}),
  },
  timePickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
});
