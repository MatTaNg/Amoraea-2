import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/shared/theme/theme';

export type DatePickerProps = {
  value: string;
  onValueChange: (isoDate: string) => void;
  label?: string;
  minYear?: number;
  maxYear?: number;
  error?: string;
};

type Draft = { y: number | null; m: number | null; d: number | null };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const d = Number(t.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1) return null;
  const maxD = daysInMonth(y, m);
  if (d > maxD) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { y, m, d };
}

function formatIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function draftToIso(d: Draft): string | null {
  if (d.y == null || d.m == null || d.d == null) return null;
  const dd = Math.min(d.d, daysInMonth(d.y, d.m));
  return formatIso(d.y, d.m, dd);
}

function normalizeDraft(d: Draft): Draft {
  const { y, m } = d;
  let { d: day } = d;
  if (y != null && m != null && day != null) {
    day = Math.min(day, daysInMonth(y, m));
  }
  return { y, m, d: day };
}

function applyPatch(prev: Draft, patch: Partial<Draft>): Draft {
  return normalizeDraft({
    y: patch.y !== undefined ? patch.y : prev.y,
    m: patch.m !== undefined ? patch.m : prev.m,
    d: patch.d !== undefined ? patch.d : prev.d,
  });
}

const MONTH_OPTIONS: { label: string; value: number }[] = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
];

/** Date of birth as three dropdowns (year, month, day). Emits `YYYY-MM-DD` when complete. */
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onValueChange,
  label,
  minYear,
  maxYear,
  error,
}) => {
  const yMin = minYear ?? 1900;
  const yMax = maxYear ?? new Date().getFullYear();

  const [draft, setDraft] = useState<Draft>({ y: null, m: null, d: null });

  useEffect(() => {
    const trimmed = value.trim();
    const p = parseIsoDate(trimmed);
    if (p && p.y >= yMin && p.y <= yMax) {
      setDraft(normalizeDraft({ y: p.y, m: p.m, d: p.d }));
      return;
    }
    if (!trimmed) {
      setDraft({ y: null, m: null, d: null });
    }
  }, [value, yMin, yMax]);

  const yearItems = useMemo(() => {
    const out: number[] = [];
    for (let y = yMax; y >= yMin; y -= 1) out.push(y);
    return out;
  }, [yMin, yMax]);

  const dayCount =
    draft.y != null && draft.m != null ? daysInMonth(draft.y, draft.m) : 0;

  const emit = (next: Draft) => {
    const iso = draftToIso(next);
    const cur = value.trim();
    if (iso) {
      if (iso !== cur) onValueChange(iso);
    } else if (cur) {
      onValueChange('');
    }
  };

  const pickerCommon = {
    style: [styles.picker, Platform.OS === 'web' ? styles.pickerWeb : null],
    dropdownIconColor: theme.colors.textSecondary,
    mode: (Platform.OS === 'android' ? 'dropdown' : undefined) as 'dropdown' | undefined,
    itemStyle:
      Platform.OS === 'ios'
        ? ({ color: theme.colors.text, fontSize: 17 } as const)
        : undefined,
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.l}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.pickerColYear}>
          <Text style={styles.subLabel}>Year</Text>
          <View style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}>
            <Picker
              selectedValue={draft.y != null ? String(draft.y) : ''}
              onValueChange={(v) => {
                if (v === '') {
                  const next = { y: null, m: null, d: null };
                  setDraft(next);
                  emit(next);
                  return;
                }
                const next = applyPatch(draft, { y: Number(v) });
                setDraft(next);
                emit(next);
              }}
              {...pickerCommon}
            >
              <Picker.Item label="Year" value="" color={theme.colors.textSecondary} />
              {yearItems.map((y) => (
                <Picker.Item key={y} label={String(y)} value={String(y)} color={theme.colors.text} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.pickerColMonth}>
          <Text style={styles.subLabel}>Month</Text>
          <View style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}>
            <Picker
              selectedValue={draft.m != null ? String(draft.m) : ''}
              onValueChange={(v) => {
                if (v === '') {
                  const next = applyPatch(draft, { m: null, d: null });
                  setDraft(next);
                  emit(next);
                  return;
                }
                const next = applyPatch(draft, { m: Number(v) });
                setDraft(next);
                emit(next);
              }}
              {...pickerCommon}
            >
              <Picker.Item label="Month" value="" color={theme.colors.textSecondary} />
              {MONTH_OPTIONS.map((mo) => (
                <Picker.Item
                  key={mo.value}
                  label={mo.label}
                  value={String(mo.value)}
                  color={theme.colors.text}
                />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.pickerColDay}>
          <Text style={styles.subLabel}>Day</Text>
          <View style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}>
            <Picker
              selectedValue={draft.d != null && dayCount > 0 ? String(draft.d) : ''}
              onValueChange={(v) => {
                if (v === '' || dayCount === 0) {
                  const next = applyPatch(draft, { d: null });
                  setDraft(next);
                  emit(next);
                  return;
                }
                const next = applyPatch(draft, { d: Number(v) });
                setDraft(next);
                emit(next);
              }}
              {...pickerCommon}
            >
              <Picker.Item label="Day" value="" color={theme.colors.textSecondary} />
              {dayCount > 0
                ? Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                    <Picker.Item
                      key={day}
                      label={String(day)}
                      value={String(day)}
                      color={theme.colors.text}
                    />
                  ))
                : null}
            </Picker>
          </View>
        </View>
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
};

export type TimePickerProps = {
  value: string;
  onValueChange: (time: string) => void;
  label?: string;
  error?: string;
};

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onValueChange,
  label,
  error,
}) => (
  <View style={styles.wrap}>
    {label ? <Text style={styles.l}>{label}</Text> : null}
    <TextInput
      value={value}
      onChangeText={onValueChange}
      placeholder="HH:MM (24h)"
      placeholderTextColor="rgba(122,154,190,0.55)"
      style={[styles.input, error ? styles.inputErr : null]}
      autoCorrect={false}
      autoCapitalize="none"
      keyboardType="numbers-and-punctuation"
      editable
    />
    {error ? <Text style={styles.err}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  l: { color: '#9CB4D8', marginBottom: 6, fontSize: 13 },
  subLabel: { color: 'rgba(122,154,190,0.85)', marginBottom: 4, fontSize: 12 },
  /** Compact row: do not stretch to full screen width. */
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  pickerColYear: { width: 96, flexShrink: 0 },
  pickerColMonth: { width: 144, flexShrink: 0 },
  pickerColDay: { width: 72, flexShrink: 0 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  pickerWrapErr: { borderColor: '#f87171' },
  picker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    ...(Platform.OS === 'ios'
      ? { height: 152 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  /** Web <select>: dark surface + readable text; avoids default white native styling. */
  pickerWeb: {
    cursor: 'pointer' as const,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    borderWidth: 0,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    padding: 12,
    color: '#EEF6FF',
    backgroundColor: 'rgba(15,20,25,0.6)',
  },
  inputErr: { borderColor: '#f87171' },
  err: { color: '#f87171', fontSize: 12, marginTop: 4 },
});
