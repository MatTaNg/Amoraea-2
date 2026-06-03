import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { formControlStyles } from '@/shared/ui/FormField';

export function isValidOptionalBirthTime24h(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function parseBirthTime24h(value: string): { hour: string; minute: string } {
  const t = value.trim();
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) {
    return { hour: '', minute: '' };
  }
  const [h, m] = t.split(':');
  return { hour: h, minute: m };
}

export function formatBirthTime24h(hour: string, minute: string): string {
  const hRaw = hour.replace(/\D/g, '');
  const mRaw = minute.replace(/\D/g, '');
  if (!hRaw && !mRaw) return '';
  if (!hRaw || !mRaw) return '';
  const h = Math.min(23, Math.max(0, Number.parseInt(hRaw, 10) || 0));
  const m = Math.min(59, Math.max(0, Number.parseInt(mRaw, 10) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type BirthTimeHourMinuteInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  error?: string;
  /** When true, both fields may be left empty. */
  optional?: boolean;
  hourLabel?: string;
  minuteLabel?: string;
};

export const BirthTimeHourMinuteInput: React.FC<BirthTimeHourMinuteInputProps> = ({
  value,
  onValueChange,
  label,
  error,
  optional = false,
  hourLabel = 'Hour',
  minuteLabel = 'Minute',
}) => {
  const parsed = parseBirthTime24h(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const hourFocusedRef = useRef(false);
  const minuteFocusedRef = useRef(false);

  useEffect(() => {
    if (hourFocusedRef.current || minuteFocusedRef.current) return;
    const next = parseBirthTime24h(value);
    setHour(next.hour);
    setMinute(next.minute);
  }, [value]);

  const commitFormattedValue = useCallback(
    (h: string, m: string) => {
      if (!h.trim() && !m.trim()) {
        onValueChange('');
        return;
      }
      if (h.trim() && m.trim()) {
        const formatted = formatBirthTime24h(h, m);
        setHour(formatted.slice(0, 2));
        setMinute(formatted.slice(3, 5));
        onValueChange(formatted);
      }
    },
    [onValueChange],
  );

  const prepareFieldForEditing = (current: string) => {
    if (/^0+$/.test(current)) return '';
    if (/^0\d$/.test(current)) return current.slice(1);
    return current;
  };

  const onHourChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setHour(digits);
  };

  const onMinuteChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setMinute(digits);
  };

  const onHourFocus = () => {
    hourFocusedRef.current = true;
    setHour((current) => prepareFieldForEditing(current));
  };

  const onMinuteFocus = () => {
    minuteFocusedRef.current = true;
    setMinute((current) => prepareFieldForEditing(current));
  };

  const onHourBlur = () => {
    hourFocusedRef.current = false;
    commitFormattedValue(hour, minute);
  };

  const onMinuteBlur = () => {
    minuteFocusedRef.current = false;
    commitFormattedValue(hour, minute);
  };

  const showFormatError = value.trim() !== '' && !isValidOptionalBirthTime24h(value);
  const showIncompleteError =
    !optional &&
    !showFormatError &&
    ((hour.trim() !== '' && minute.trim() === '') || (hour.trim() === '' && minute.trim() !== ''));

  return (
    <View style={styles.fieldBlock}>
      {label ? <Text style={formControlStyles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.subLabel}>{hourLabel}</Text>
          <TextInput
            value={hour}
            onChangeText={onHourChange}
            onFocus={onHourFocus}
            onBlur={onHourBlur}
            placeholder="00"
            placeholderTextColor="rgba(200,217,238,0.55)"
            style={[
              formControlStyles.control,
              formControlStyles.inputText,
              styles.input,
              error || showFormatError || showIncompleteError
                ? formControlStyles.controlError
                : null,
            ]}
            keyboardType="number-pad"
            maxLength={2}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={hourLabel}
          />
        </View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.col}>
          <Text style={styles.subLabel}>{minuteLabel}</Text>
          <TextInput
            value={minute}
            onChangeText={onMinuteChange}
            onFocus={onMinuteFocus}
            onBlur={onMinuteBlur}
            placeholder="00"
            placeholderTextColor="rgba(200,217,238,0.55)"
            style={[
              formControlStyles.control,
              formControlStyles.inputText,
              styles.input,
              error || showFormatError || showIncompleteError
                ? formControlStyles.controlError
                : null,
            ]}
            keyboardType="number-pad"
            maxLength={2}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={minuteLabel}
          />
        </View>
      </View>
      <Text style={styles.hint}>24-hour time (e.g. 14 and 30 for 2:30 PM)</Text>
      {error ? <Text style={formControlStyles.errorText}>{error}</Text> : null}
      {!error && showIncompleteError ? (
        <Text style={formControlStyles.errorText}>Enter both hour and minute.</Text>
      ) : null}
      {!error && !showIncompleteError && showFormatError ? (
        <Text style={formControlStyles.errorText}>
          Hour must be 0–23 and minute 0–59.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    alignSelf: 'flex-start',
  },
  col: { width: 72, flexShrink: 0 },
  subLabel: {
    color: 'rgba(200,217,238,0.72)',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  separator: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '600',
    paddingBottom: Platform.OS === 'ios' ? 14 : 16,
    marginHorizontal: 2,
  },
  input: {
    textAlign: 'center',
    minHeight: 48,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(200,217,238,0.55)',
  },
});
