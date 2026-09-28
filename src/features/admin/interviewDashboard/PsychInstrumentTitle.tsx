import React from 'react';
import { View, Text } from 'react-native';
import { AdminInlineGlossaryIcon } from '@features/admin/interviewDashboard/AdminInlineGlossaryIcon';
import {
  PSYCHOMETRIC_GLOSSARY,
  type PsychometricGlossaryKey,
} from '@features/admin/interviewDashboard/adminScoringGlossary';

export function PsychInstrumentTitle({
  name,
  abbr,
  nameStyle,
  abbrStyle,
}: {
  name: string;
  abbr: PsychometricGlossaryKey;
  nameStyle?: object;
  abbrStyle?: object;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
      <Text style={nameStyle}>{name}</Text>
      <Text style={abbrStyle}>{abbr}</Text>
      <AdminInlineGlossaryIcon text={PSYCHOMETRIC_GLOSSARY[abbr]} accessibilityLabel={`Explain ${abbr}`} />
    </View>
  );
}
