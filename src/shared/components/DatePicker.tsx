import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/shared/theme/theme';
import { formControlStyles } from '@/shared/ui/FormField';
import { BirthTimeHourMinuteInput } from '@/shared/components/BirthTimeHourMinuteInput';
import {
  maxBirthYearForMinimumAge,
  maxSelectableDayForBirthYearMonth,
  maxSelectableMonthForBirthYear,
  MIN_USER_AGE,
  isBirthDateAllowedForMinimumAge,
  parseBirthDateParts,
} from '@/shared/utils/ageCalculator';

export type DatePickerProps = {
  value: string;
  onValueChange: (isoDate: string) => void;
  label?: string;
  minYear?: number;
  maxYear?: number;
  /** When set (default 18), year/month/day options cannot produce an age below this. */
  minimumAge?: number;
  error?: string;
};

type Draft = { y: number | null; m: number | null; d: number | null };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Longest month; used so the day column lists 1–31 before year/month are chosen. */
const MAX_DAYS_ANY_MONTH = 31;

function maxSelectableDays(y: number | null, m: number | null): number {
  if (y != null && m != null) return daysInMonth(y, m);
  return MAX_DAYS_ANY_MONTH;
}

function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const d = Number(t.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return null;
  if (m < 1 || m > 12 || d < 1) return null;
  const maxD = daysInMonth(y, m);
  if (d > maxD) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
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

function clampDraftToMinimumAge(draft: Draft, minimumAge: number): Draft {
  if (draft.y == null) return draft;
  const maxMonth = maxSelectableMonthForBirthYear(draft.y, minimumAge);
  let m = draft.m;
  if (m != null && m > maxMonth) m = null;
  let d = draft.d;
  if (m == null) {
    d = null;
  } else {
    const maxDay = maxSelectableDayForBirthYearMonth(draft.y, m, minimumAge);
    if (d != null && d > maxDay) d = null;
  }
  return { y: draft.y, m, d };
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
  minimumAge = MIN_USER_AGE,
  error,
}) => {
  const yMin = minYear ?? 1900;
  const yMax = maxYear ?? maxBirthYearForMinimumAge(minimumAge);

  const [draft, setDraft] = useState<Draft>({ y: null, m: null, d: null });
  /** Avoid stale `draft` in pickers when year/month change back-to-back (web / fast taps). */
  const draftRef = useRef<Draft>(draft);
  draftRef.current = draft;
  /** Tracks last controlled `value` so we only reset draft when parent clears a saved ISO, not while value stays "" during partial picks. */
  const prevControlledValueRef = useRef<string>(value);

  useEffect(() => {
    const trimmed = value.trim();
    const p = parseBirthDateParts(trimmed);
    if (p && p.y >= yMin && p.y <= yMax && isBirthDateAllowedForMinimumAge(trimmed, minimumAge)) {
      const normalized = clampDraftToMinimumAge(
        normalizeDraft({ y: p.y, m: p.m, d: p.d }),
        minimumAge,
      );
      setDraft(normalized);
      draftRef.current = normalized;
      prevControlledValueRef.current = value;
      return;
    }
    if (p && trimmed && !isBirthDateAllowedForMinimumAge(trimmed, minimumAge)) {
      const empty = { y: null, m: null, d: null };
      setDraft(empty);
      draftRef.current = empty;
      prevControlledValueRef.current = '';
      if (trimmed) onValueChange('');
      return;
    }
    if (!trimmed) {
      const prevTrimmed = prevControlledValueRef.current.trim();
      const hadPriorIso = parseIsoDate(prevTrimmed) != null;
      if (hadPriorIso) {
        const empty = { y: null, m: null, d: null };
        setDraft(empty);
        draftRef.current = empty;
      }
      prevControlledValueRef.current = value;
      return;
    }
    prevControlledValueRef.current = value;
  }, [value, yMin, yMax, minimumAge]);

  const yearItems = useMemo(() => {
    const out: number[] = [];
    for (let y = yMax; y >= yMin; y -= 1) {
      if (maxSelectableMonthForBirthYear(y, minimumAge) < 1) continue;
      out.push(y);
    }
    return out;
  }, [yMin, yMax, minimumAge]);

  const monthOptions = useMemo(() => {
    if (draft.y == null) return MONTH_OPTIONS;
    const maxMonth = maxSelectableMonthForBirthYear(draft.y, minimumAge);
    return MONTH_OPTIONS.filter((mo) => mo.value <= maxMonth);
  }, [draft.y, minimumAge]);

  const dayCount = useMemo(() => {
    if (draft.y != null && draft.m != null) {
      return maxSelectableDayForBirthYearMonth(draft.y, draft.m, minimumAge);
    }
    return maxSelectableDays(draft.y, draft.m);
  }, [draft.y, draft.m, minimumAge]);

  const patchDraft = (patch: Partial<Draft>): Draft => {
    const next = clampDraftToMinimumAge(applyPatch(draftRef.current, patch), minimumAge);
    draftRef.current = next;
    setDraft(next);
    return next;
  };

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
    mode: (Platform.OS === 'android' ? 'dropdown' : undefined) as
      | 'dropdown'
      | undefined,
    itemStyle:
      Platform.OS === 'ios'
        ? ({ color: theme.colors.text, fontSize: 17 } as const)
        : undefined,
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={formControlStyles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.pickerColYear}>
          <Text style={styles.subLabel}>Year</Text>
          <View
            style={[
              formControlStyles.control,
              formControlStyles.controlSelectLike,
              styles.pickerWrap,
              error ? formControlStyles.controlError : null,
            ]}
          >
            <Picker
              selectedValue={draft.y != null ? String(draft.y) : ''}
              onValueChange={(v) => {
                if (v === '') {
                  const next = { y: null, m: null, d: null };
                  draftRef.current = next;
                  setDraft(next);
                  emit(next);
                  return;
                }
                emit(patchDraft({ y: Number(v) }));
              }}
              {...pickerCommon}
            >
              <Picker.Item
                label="Year"
                value=""
                color={theme.colors.textSecondary}
                style={styles.pickerItemPlaceholder}
              />
              {yearItems.map((y) => (
                <Picker.Item
                  key={y}
                  label={String(y)}
                  value={String(y)}
                  color={theme.colors.text}
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.pickerColMonth}>
          <Text style={styles.subLabel}>Month</Text>
          <View
            style={[
              formControlStyles.control,
              formControlStyles.controlSelectLike,
              styles.pickerWrap,
              error ? formControlStyles.controlError : null,
            ]}
          >
            <Picker
              selectedValue={draft.m != null ? String(draft.m) : ''}
              onValueChange={(v) => {
                if (v === '') {
                  emit(patchDraft({ m: null, d: null }));
                  return;
                }
                emit(patchDraft({ m: Number(v) }));
              }}
              {...pickerCommon}
            >
              <Picker.Item
                label="Month"
                value=""
                color={theme.colors.textSecondary}
                style={styles.pickerItemPlaceholder}
              />
              {monthOptions.map((mo) => (
                <Picker.Item
                  key={mo.value}
                  label={mo.label}
                  value={String(mo.value)}
                  color={theme.colors.text}
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.pickerColDay}>
          <Text style={styles.subLabel}>Day</Text>
          <View
            style={[
              formControlStyles.control,
              formControlStyles.controlSelectLike,
              styles.pickerWrap,
              error ? formControlStyles.controlError : null,
            ]}
            {...(Platform.OS === 'web' ? { nativeID: 'date-picker-day-wrap' } : {})}
          >
            <Picker
              key={
                Platform.OS === 'web'
                  ? `day-${draft.y ?? ''}-${draft.m ?? ''}`
                  : undefined
              }
              selectedValue={
                draft.d != null && draft.d <= dayCount ? String(draft.d) : ''
              }
              onValueChange={(v) => {
                const dc = dayCount;
                if (v === '') {
                  emit(patchDraft({ d: null }));
                  return;
                }
                const num = Number(v);
                if (!Number.isFinite(num) || num < 1 || num > dc) {
                  emit(patchDraft({ d: null }));
                  return;
                }
                emit(patchDraft({ d: num }));
              }}
              {...pickerCommon}
            >
              <Picker.Item
                label="Day"
                value=""
                color={theme.colors.textSecondary}
                style={styles.pickerItemPlaceholder}
              />
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
                <Picker.Item
                  key={day}
                  label={String(day)}
                  value={String(day)}
                  color={theme.colors.text}
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
        </View>
      </View>
      {error ? <Text style={formControlStyles.errorText}>{error}</Text> : null}
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
  <BirthTimeHourMinuteInput
    value={value}
    onValueChange={onValueChange}
    label={label}
    error={error}
    optional={false}
    hourLabel="Hour"
    minuteLabel="Minute"
  />
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  subLabel: {
    color: 'rgba(200,217,238,0.72)',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    gap: 12,
    alignItems: 'flex-start',
    maxWidth: '100%',
    ...Platform.select({
      android: {
        flexDirection: 'column',
        alignSelf: 'stretch',
        width: '100%',
      },
      default: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
      },
    }),
  },
  pickerColYear: Platform.select({
    android: {
      width: '100%',
      minWidth: 128,
      alignSelf: 'stretch',
    },
    default: {
      width: 128,
      minWidth: 128,
      flexShrink: 0,
    },
  }),
  pickerColMonth: Platform.select({
    android: {
      width: '100%',
      minWidth: 180,
      alignSelf: 'stretch',
    },
    default: {
      width: 180,
      minWidth: 180,
      flexShrink: 0,
    },
  }),
  pickerColDay: Platform.select({
    android: {
      width: '100%',
      minWidth: 112,
      alignSelf: 'stretch',
    },
    default: {
      width: 112,
      minWidth: 112,
      flexShrink: 0,
    },
  }),
  /** Inner surface: inherits border/background from `formControlStyles.control`; strip padding so Picker fills. */
  pickerWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  picker: {
    width: '100%',
    color: '#E8F0F8',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios'
      ? { height: 152 }
      : Platform.OS === 'android'
        ? { height: 56, paddingHorizontal: 12 }
        : {}),
  },
  /** Web <select>: dark surface + readable text; avoids default white native styling. */
  pickerWeb: {
    cursor: 'pointer' as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 56,
    minWidth: 112,
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    color: '#E8F0F8',
    backgroundColor: 'transparent',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerItem: {
    color: '#E8F0F8',
    backgroundColor: '#0f1419',
  },
  pickerItemPlaceholder: {
    color: 'rgba(200,217,238,0.72)',
    backgroundColor: '#0f1419',
  },
});
