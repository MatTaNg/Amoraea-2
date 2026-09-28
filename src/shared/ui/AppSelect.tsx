import React, { useLayoutEffect, useMemo, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { FormField } from '@/shared/ui/FormField';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';
import { appSelectStyles } from '@/shared/ui/appSelectStyles';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';

export type AppSelectOption = { label: string; value: string };

export type AppSelectProps = {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  fieldStyle?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  /** When true, render only the trigger + sheet (no FormField wrapper). */
  bare?: boolean;
  value: string;
  options: AppSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowUnset?: boolean;
  unsetLabel?: string;
  sheetTitle?: string;
  formatSelectedLabel?: (label: string, value: string) => string;
};

export function AppSelect({
  label,
  helperText,
  error,
  fieldStyle,
  triggerStyle,
  bare = false,
  value,
  options,
  onValueChange,
  placeholder = 'Choose…',
  allowUnset = false,
  unsetLabel,
  sheetTitle,
  formatSelectedLabel,
}: AppSelectProps) {
  const [sheetAnchor, setSheetAnchor] = useState<OptionAnchor | null>(null);
  const unsetOk = Boolean(allowUnset) && value === '';
  const validSelection = unsetOk || options.some((o) => o.value === value);
  const selectedValue = validSelection ? value : allowUnset ? '' : (options[0]?.value ?? '');
  const sheetOptions = useMemo(
    () =>
      allowUnset
        ? [{ label: unsetLabel ?? placeholder, value: '' }, ...options]
        : options,
    [allowUnset, options, placeholder, unsetLabel],
  );

  const selectedLabel = useMemo(() => {
    if (unsetOk) return placeholder;
    const match = options.find((o) => o.value === selectedValue);
    const raw = match?.label ?? placeholder;
    return formatSelectedLabel ? formatSelectedLabel(raw, selectedValue) : raw;
  }, [
    formatSelectedLabel,
    options,
    placeholder,
    selectedValue,
    unsetOk,
  ]);

  useLayoutEffect(() => {
    if (!options.length) return;
    if (allowUnset) return;
    if (!validSelection && options[0]) {
      onValueChange(options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coerce empty/unknown values once options exist
  }, [value, options, validSelection, allowUnset]);

  if (!options.length) return null;

  const trigger = (
    <>
      <OptionPickerTrigger
        style={[appSelectStyles.trigger, triggerStyle]}
        onOpen={(anchor) => setSheetAnchor(anchor)}
      >
        <SelectTriggerRow
          label={selectedLabel}
          isPlaceholder={unsetOk || selectedLabel === placeholder}
          labelStyle={appSelectStyles.triggerText}
          placeholderStyle={appSelectStyles.triggerPlaceholder}
          chevronStyle={appSelectStyles.chevron}
        />
      </OptionPickerTrigger>
      <BottomSheet
        visible={!!sheetAnchor}
        title={sheetTitle ?? (typeof label === 'string' ? label : undefined)}
        anchor={sheetAnchor}
        onClose={() => setSheetAnchor(null)}
      >
        <SingleChoiceOptionList
          options={sheetOptions}
          value={selectedValue}
          onSelect={(next) => {
            onValueChange(String(next));
            setSheetAnchor(null);
          }}
        />
      </BottomSheet>
    </>
  );

  if (bare) return trigger;

  return (
    <FormField label={label} helperText={helperText} error={error} style={fieldStyle}>
      {trigger}
    </FormField>
  );
};
