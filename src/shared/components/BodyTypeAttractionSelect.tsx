import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  BODY_TYPE_ATTRACTION_IDS,
  parseBodyTypeAttraction,
  type BodyTypeAttractionId,
} from '@/shared/constants/bodyTypeAttraction';
/**
 * Single-select picker aligned with edit-profile / embedded dealbreaker dropdown styling.
 * Stores canonical ids array (`[]` = no preference, `[one]` = chosen). If legacy data had multiple
 * values, the first canonical entry drives the picker until the user changes it.
 */
export const BodyTypeAttractionSelect: React.FC<{
  value?: BodyTypeAttractionId[];
  onChange?: (next: BodyTypeAttractionId[]) => void;
}> = ({ value, onChange }) => {
  const ids = useMemo(() => parseBodyTypeAttraction(value), [value]);
  const primary = ids[0];
  const selectedValue =
    primary && BODY_TYPE_ATTRACTION_IDS.includes(primary) ? primary : '';

  const options = useMemo(
    () => [
      { label: 'No preference', value: '' as const },
      ...BODY_TYPE_ATTRACTION_IDS.map((id) => ({ label: id, value: id })),
    ],
    [],
  );

  const emit = (raw: string) => {
    if (!onChange) return;
    if (raw === '') {
      onChange([]);
      return;
    }
    if (BODY_TYPE_ATTRACTION_IDS.includes(raw as BodyTypeAttractionId)) {
      onChange([raw as BodyTypeAttractionId]);
    }
  };

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>Body type attraction</Text>
      <View style={styles.pickerShell}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={(v) => emit(String(v))}
          mode={Platform.OS === 'android' ? 'dropdown' : undefined}
          style={[
            styles.pickerNative,
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
          dropdownIconColor="rgba(156,180,216,0.85)"
          itemStyle={Platform.OS === 'ios' ? { color: '#E8F0F8', fontSize: 17 } : undefined}
        >
          {options.map((o) => (
            <Picker.Item
              key={o.value === '' ? '__none__' : o.value}
              label={o.label}
              value={o.value}
              color="#E8F0F8"
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 14, marginTop: 6 },
  label: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  pickerShell: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  pickerNative: {
    width: '100%',
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'ios' ? { height: 160 } : Platform.OS === 'android' ? { height: 56 } : {}),
  },
  pickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
