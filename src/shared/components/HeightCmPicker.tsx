import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/shared/theme/theme';

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;

export type HeightCmPickerProps = {
  label?: string;
  valueCm?: number | null;
  onChangeCm: (cm: number | undefined) => void;
  errorText?: string;
  placeholderLabel?: string;
};

export const HeightCmPicker: React.FC<HeightCmPickerProps> = ({
  label,
  valueCm,
  onChangeCm,
  errorText,
  placeholderLabel = 'Select height',
}) => {
  const options = useMemo(() => {
    const out: { label: string; value: string }[] = [{ label: placeholderLabel, value: '' }];
    for (let cm = HEIGHT_CM_MIN; cm <= HEIGHT_CM_MAX; cm += 1) {
      out.push({ label: `${cm} cm`, value: String(cm) });
    }
    return out;
  }, [placeholderLabel]);

  const selected =
    valueCm != null && valueCm >= HEIGHT_CM_MIN && valueCm <= HEIGHT_CM_MAX ? String(valueCm) : '';

  return (
    <View style={styles.box}>
      {label ? <Text style={styles.lbl}>{label}</Text> : null}
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selected}
          onValueChange={(v) => {
            const s = String(v);
            if (!s) onChangeCm(undefined);
            else {
              const n = parseInt(s, 10);
              onChangeCm(Number.isFinite(n) ? n : undefined);
            }
          }}
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
          itemStyle={Platform.OS === 'ios' ? { color: theme.colors.text, fontSize: 17 } : undefined}
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
  pickerWrapper: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  picker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    ...(Platform.OS === 'ios' ? { height: 148 } : Platform.OS === 'android' ? { height: 56 } : {}),
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
    backgroundColor: theme.colors.card,
  },
  err: { marginTop: 6, fontSize: 13, color: theme.colors.error },
});
