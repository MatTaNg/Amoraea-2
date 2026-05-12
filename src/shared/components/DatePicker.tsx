import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  /** Avoid stale `draft` in pickers when year/month change back-to-back (web / fast taps). */
  const draftRef = useRef<Draft>(draft);
  draftRef.current = draft;
  /** Tracks last controlled `value` so we only reset draft when parent clears a saved ISO, not while value stays "" during partial picks. */
  const prevControlledValueRef = useRef<string>(value);

  useEffect(() => {
    const trimmed = value.trim();
    const p = parseIsoDate(trimmed);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '4b3376',
      },
      body: JSON.stringify({
        sessionId: '4b3376',
        hypothesisId: 'F',
        location: 'DatePicker.tsx:value_effect_entry',
        message: 'value_effect_run',
        data: {
          trimmedLen: trimmed.length,
          branchGuess: p && p.y >= yMin && p.y <= yMax ? 'iso' : !trimmed ? 'empty' : 'nonIso',
          yMin,
          yMax,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (p && p.y >= yMin && p.y <= yMax) {
      const normalized = normalizeDraft({ y: p.y, m: p.m, d: p.d });
      setDraft(normalized);
      draftRef.current = normalized;
      prevControlledValueRef.current = value;
      return;
    }
    if (!trimmed) {
      const prevTrimmed = prevControlledValueRef.current.trim();
      const hadPriorIso = parseIsoDate(prevTrimmed) != null;
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4b3376',
        },
        body: JSON.stringify({
          sessionId: '4b3376',
          hypothesisId: 'C',
          location: 'DatePicker.tsx:value_effect_empty',
          message: hadPriorIso ? 'draft_cleared_iso_removed' : 'skip_clear_keep_partial',
          data: { hadPriorIso, valueLen: trimmed.length },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      if (hadPriorIso) {
        const empty = { y: null, m: null, d: null };
        setDraft(empty);
        draftRef.current = empty;
      }
      prevControlledValueRef.current = value;
      return;
    }
    prevControlledValueRef.current = value;
  }, [value, yMin, yMax]);

  const yearItems = useMemo(() => {
    const out: number[] = [];
    for (let y = yMax; y >= yMin; y -= 1) out.push(y);
    return out;
  }, [yMin, yMax]);

  const dayCount = maxSelectableDays(draft.y, draft.m);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '4b3376',
      },
      body: JSON.stringify({
        sessionId: '4b3376',
        hypothesisId: 'B',
        location: 'DatePicker.tsx:draft_dayCount',
        message: 'react_state',
        data: {
          valuePropLen: value.trim().length,
          draft,
          dayCount,
          expectedDayItems: dayCount,
          expectedSelectOptions: dayCount > 0 ? dayCount + 1 : 1,
          platform: Platform.OS,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const wrap = document.getElementById('date-picker-day-wrap');
        const sel = wrap?.querySelector?.('select');
        const optLen = sel?.querySelectorAll?.('option')?.length ?? -1;
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '4b3376',
          },
          body: JSON.stringify({
            sessionId: '4b3376',
            hypothesisId: 'A',
            location: 'DatePicker.tsx:web_dom_day_select',
            message: 'dom_option_count',
            data: {
              hasWrap: !!wrap,
              hasSelect: !!sel,
              domOptionCount: optLen,
              reactDayCount: dayCount,
              mismatch:
                dayCount > 0 ? optLen !== dayCount + 1 : optLen < 1,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      });
    }
  }, [draft.y, draft.m, draft.d, dayCount, value]);
  // #endregion

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
      {label ? <Text style={styles.l}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.pickerColYear}>
          <Text style={styles.subLabel}>Year</Text>
          <View
            style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}
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
                const next = applyPatch(draftRef.current, { y: Number(v) });
                draftRef.current = next;
                setDraft(next);
                // #region agent log
                fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '4b3376',
                  },
                  body: JSON.stringify({
                    sessionId: '4b3376',
                    hypothesisId: 'D',
                    location: 'DatePicker.tsx:year_onValueChange',
                    message: 'year_picked',
                    data: {
                      rawV: typeof v,
                      nextY: next.y,
                      nextM: next.m,
                      nextD: next.d,
                    },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
                emit(next);
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
            style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}
          >
            <Picker
              selectedValue={draft.m != null ? String(draft.m) : ''}
              onValueChange={(v) => {
                if (v === '') {
                  const next = applyPatch(draftRef.current, { m: null, d: null });
                  draftRef.current = next;
                  setDraft(next);
                  emit(next);
                  return;
                }
                const next = applyPatch(draftRef.current, { m: Number(v) });
                draftRef.current = next;
                setDraft(next);
                // #region agent log
                fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '4b3376',
                  },
                  body: JSON.stringify({
                    sessionId: '4b3376',
                    hypothesisId: 'E',
                    location: 'DatePicker.tsx:month_onValueChange',
                    message: 'month_picked',
                    data: {
                      rawV: typeof v,
                      nextY: next.y,
                      nextM: next.m,
                      nextD: next.d,
                    },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
                emit(next);
              }}
              {...pickerCommon}
            >
              <Picker.Item
                label="Month"
                value=""
                color={theme.colors.textSecondary}
                style={styles.pickerItemPlaceholder}
              />
              {MONTH_OPTIONS.map((mo) => (
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
            style={[styles.pickerWrap, error ? styles.pickerWrapErr : null]}
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
                const dc = maxSelectableDays(
                  draftRef.current.y,
                  draftRef.current.m,
                );
                if (v === '') {
                  const next = applyPatch(draftRef.current, { d: null });
                  draftRef.current = next;
                  setDraft(next);
                  emit(next);
                  return;
                }
                const num = Number(v);
                if (!Number.isFinite(num) || num < 1 || num > dc) {
                  const next = applyPatch(draftRef.current, { d: null });
                  draftRef.current = next;
                  setDraft(next);
                  emit(next);
                  return;
                }
                const next = applyPatch(draftRef.current, { d: num });
                draftRef.current = next;
                setDraft(next);
                emit(next);
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
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  pickerWrapErr: { borderColor: '#f87171' },
  picker: {
    width: '100%',
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pickerItem: {
    color: '#E8F0F8',
    backgroundColor: '#0f1419',
  },
  pickerItemPlaceholder: {
    color: 'rgba(200,217,238,0.72)',
    backgroundColor: '#0f1419',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: 12,
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inputErr: { borderColor: '#f87171' },
  err: { color: '#f87171', fontSize: 12, marginTop: 4 },
});
