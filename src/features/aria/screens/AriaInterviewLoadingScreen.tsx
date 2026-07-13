import React from 'react';
import { Text, View } from 'react-native';

import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';

export function AriaInterviewLoadingScreen(): React.ReactElement {
  return (
    <SafeAreaContainer>
      <View
        style={[
          styles.container,
          { minHeight: '100%', justifyContent: 'center', alignItems: 'center', padding: 24 },
        ]}
      >
        <Text style={[styles.introNote, { letterSpacing: 2, textTransform: 'uppercase' }]}>Loading...</Text>
        <Text style={[styles.introHint, { marginTop: 16, textAlign: 'center' }]}>
          If this doesn't change, try refreshing the page.
        </Text>
      </View>
    </SafeAreaContainer>
  );
}
