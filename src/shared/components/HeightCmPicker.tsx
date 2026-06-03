import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/shared/theme/theme';
import { FormField, formControlStyles } from '@/shared/ui/FormField';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;

export type HeightCmPickerProps = {
  label?: string;
  valueCm?: number | null;
  onChangeCm: (cm: number | undefined) => void;
  errorText?: string;
  placeholderLabel?: string;
  /**
   * When true (default), the first row clears height (`undefined`).
   * Set false to only list numeric heights (e.g. edit profile).
   */
  includeUnsetOption?: boolean;
};

export const HeightCmPicker: React.FC<HeightCmPickerProps> = ({
  label,
  valueCm,
  onChangeCm,
  errorText,
  placeholderLabel = 'Select height',
  includeUnsetOption = true,
}) => {
  const [sheetAnchor, setSheetAnchor] = useState<OptionAnchor | null>(null);
  const options = useMemo(() => {
    const heights: { label: string; value: string }[] = [];
    for (let cm = HEIGHT_CM_MIN; cm <= HEIGHT_CM_MAX; cm += 1) {
      heights.push({ label: `${cm} cm`, value: String(cm) });
    }
    if (includeUnsetOption) {
      return [{ label: placeholderLabel, value: '' }, ...heights];
    }
    return heights;
  }, [placeholderLabel, includeUnsetOption]);

  const hasValid =
    valueCm != null &&
    valueCm >= HEIGHT_CM_MIN &&
    valueCm <= HEIGHT_CM_MAX;
  /** Web sheet: no row selected when height unset and unset-row hidden. */
  const webSheetSelectedValue = hasValid ? String(valueCm) : '';
  /** Native Picker requires a valid item; when unset-row is hidden, bind to min until user picks. */
  const nativePickerSelectedValue = hasValid
    ? String(valueCm)
    : includeUnsetOption
      ? ''
      : String(HEIGHT_CM_MIN);
  const triggerLabel = hasValid
    ? `${valueCm} cm`
    : includeUnsetOption
      ? placeholderLabel
      : '—';

  const commitValue = (value: string) => {
    if (!value) {
      onChangeCm(undefined);
      return;
    }
    const n = parseInt(value, 10);
    onChangeCm(Number.isFinite(n) ? n : undefined);
  };

  if (Platform.OS === 'web') {
    return (
      <FormField label={label} error={errorText} style={styles.webField}>
        <OptionPickerTrigger
          style={[styles.webTrigger, formControlStyles.control]}
          onOpen={(anchor) => setSheetAnchor(anchor)}
        >
          <SelectTriggerRow
            label={triggerLabel}
            isPlaceholder={!hasValid}
            labelStyle={[formControlStyles.valueText, styles.webTriggerText]}
            chevronStyle={styles.webChevron}
          />
        </OptionPickerTrigger>
        <BottomSheet
          visible={!!sheetAnchor}
          title={label}
          anchor={sheetAnchor}
          onClose={() => setSheetAnchor(null)}
        >
          <SingleChoiceOptionList
            options={options}
            value={webSheetSelectedValue}
            onSelect={(next) => {
              commitValue(next);
              setSheetAnchor(null);
            }}
          />
        </BottomSheet>
      </FormField>
    );
  }

  return (
    <View style={styles.box}>
      {label ? <Text style={styles.lbl}>{label}</Text> : null}
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={nativePickerSelectedValue}
          onValueChange={(v) => commitValue(String(v))}
          style={[
            styles.picker,
            Platform.OS === 'web'
              ? [
                  styles.pickerWeb,
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
          {options.map((o) => (
            <Picker.Item
              key={o.value === '' ? '__none__' : o.value}
              label={o.label}
              value={o.value}
              color={theme.colors.text}
            />
          ))}
        </Picker>
      </View>
      {!!errorText && <Text style={styles.err}>{errorText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { marginBottom: 16 },
  lbl: { color: '#9CB4D8', marginBottom: 6, fontSize: 13 },
  webField: {
    maxWidth: 360,
  },
  webTrigger: {
    maxWidth: 360,
    width: '100%',
    alignSelf: 'stretch',
  },
  webTriggerText: {},
  webChevron: {
    color: 'rgba(156,180,216,0.9)',
    fontSize: 14,
    paddingLeft: 10,
  },
  pickerWrapper: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  picker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'ios'
      ? { height: 148 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  pickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: theme.colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  err: { marginTop: 6, fontSize: 13, color: theme.colors.error },
});
