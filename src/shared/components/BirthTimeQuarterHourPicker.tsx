import React from 'react';
import {
  BirthTimeHourMinuteInput,
  type BirthTimeHourMinuteInputProps,
} from '@/shared/components/BirthTimeHourMinuteInput';

export { isValidOptionalBirthTime24h } from '@/shared/components/BirthTimeHourMinuteInput';

export type BirthTimeQuarterHourPickerProps = Omit<
  BirthTimeHourMinuteInputProps,
  'optional'
> & {
  label?: string;
};

/** Birth time entry as separate hour and minute fields (stored as `HH:MM` 24h). */
export const BirthTimeQuarterHourPicker: React.FC<BirthTimeQuarterHourPickerProps> = ({
  value,
  onValueChange,
  label = 'Birth time',
}) => (
  <BirthTimeHourMinuteInput
    value={value}
    onValueChange={onValueChange}
    label={label}
    optional
    hourLabel="Hour"
    minuteLabel="Minute"
  />
);
