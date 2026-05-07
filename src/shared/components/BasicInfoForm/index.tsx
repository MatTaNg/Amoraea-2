import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { LocationInput } from '@/shared/components/BasicInfoForm/LocationInput';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';

export type BasicInfoProfileFields = {
  displayName?: string;
  gender?: 'man' | 'woman' | 'non-binary';
  relationshipStyle?:
    | 'monogamous'
    | 'polyamorous'
    | 'monogamous-ish'
    | 'open'
    | 'other';
  location?: string;
  occupation?: string;
  bio?: string;
};

const GENDER_OPTIONS = [
  { label: 'Man', value: 'man' },
  { label: 'Woman', value: 'woman' },
  { label: 'Non-binary', value: 'non-binary' },
] as const;

const RELATIONSHIP_OPTIONS = [
  { label: 'Monogamous', value: 'monogamous' },
  { label: 'Polyamorous', value: 'polyamorous' },
  { label: 'Monogamous-ish', value: 'monogamous-ish' },
  { label: 'Open', value: 'open' },
  { label: 'Other', value: 'other' },
] as const;

export type BasicInfoFormProps = {
  profile: BasicInfoProfileFields;
  mode: 'create' | 'edit';
  showErrors: boolean;
  showSaveButton?: boolean;
  showCancelButton?: boolean;
  onSave?: () => Promise<boolean>;
  onCancel?: () => void;
  onFieldChange: (field: keyof BasicInfoProfileFields | string, value: unknown) => void;
  onLocationChange: (query: string) => void | Promise<void>;
  locationSuggestions: Array<{ label: string }>;
  onLocationSuggestionSelect: (selected: string) => void;
  onUseMyLocation: () => void | Promise<void>;
  validatedLocation: string;
};

function err(show: boolean, message: string) {
  return show ? message : undefined;
}

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
  profile,
  mode: _mode,
  showErrors,
  showSaveButton = true,
  showCancelButton = true,
  onSave,
  onCancel,
  onFieldChange,
  onLocationChange,
  locationSuggestions,
  onLocationSuggestionSelect,
  onUseMyLocation,
  validatedLocation,
}) => {
  const { displayName, gender, relationshipStyle, location, occupation, bio } = profile;

  return (
    <View style={styles.wrap}>
      <Input
        label="Display name"
        value={displayName ?? ''}
        onChangeText={(t) => onFieldChange('displayName', t)}
        placeholder="How you want to be shown"
        error={err(showErrors && !(displayName ?? '').trim(), 'Display name is required')}
      />

      <Text style={styles.sectionLabel}>Gender</Text>
      <SingleChoiceOptionList
        options={[...GENDER_OPTIONS]}
        value={gender ?? ''}
        onSelect={(v) => onFieldChange('gender', v)}
      />
      {showErrors && !gender ? <Text style={styles.fieldErr}>Please select a gender</Text> : null}

      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Relationship style</Text>
      <SingleChoiceOptionList
        options={[...RELATIONSHIP_OPTIONS]}
        value={relationshipStyle ?? ''}
        onSelect={(v) => onFieldChange('relationshipStyle', v)}
      />
      {showErrors && !relationshipStyle ? (
        <Text style={styles.fieldErr}>Please select a relationship style</Text>
      ) : null}

      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Location</Text>
      <LocationInput
        value={location ?? ''}
        onChangeText={(t) => {
          onFieldChange('location', t);
          void onLocationChange(t);
        }}
        placeholder="City, region, or neighborhood"
      />
      {validatedLocation ? (
        <Text style={styles.validated}>Using: {validatedLocation}</Text>
      ) : null}

      {locationSuggestions.length > 0 ? (
        <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
          {locationSuggestions.map((s, i) => (
            <Pressable
              key={`${s.label}-${i}`}
              style={styles.suggestionRow}
              onPress={() => onLocationSuggestionSelect(s.label)}
            >
              <Text style={styles.suggestionText}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.locActions}>
        <Button title="Use my location" variant="outline" onPress={() => void onUseMyLocation()} />
      </View>

      <Input
        label="Occupation"
        value={occupation ?? ''}
        onChangeText={(t) => onFieldChange('occupation', t)}
        placeholder="What you do"
      />

      <Input
        label="Bio"
        value={bio ?? ''}
        onChangeText={(t) => onFieldChange('bio', t)}
        placeholder="A short introduction"
        multiline
        numberOfLines={4}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
        error={err(showErrors && !(bio ?? '').trim(), 'Bio is required')}
      />

      {showSaveButton || showCancelButton ? (
        <View style={styles.row}>
          {showCancelButton && onCancel ? (
            <Button title="Cancel" variant="outline" onPress={onCancel} />
          ) : null}
          {showSaveButton && onSave ? (
            <Button title="Save" onPress={() => void onSave()} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  sectionLabel: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  fieldErr: { color: '#f87171', fontSize: 12, marginTop: -4, marginBottom: 8 },
  validated: { color: '#86efac', fontSize: 12, marginBottom: 8 },
  suggestions: { maxHeight: 160, marginBottom: 8 },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(82,142,220,0.2)',
  },
  suggestionText: { color: '#EEF6FF', fontSize: 15 },
  locActions: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
