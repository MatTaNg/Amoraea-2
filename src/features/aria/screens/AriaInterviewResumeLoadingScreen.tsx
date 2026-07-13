import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';

export function AriaInterviewResumeLoadingScreen(): React.ReactElement {
  return (
    <SafeAreaContainer style={{ flex: 1, backgroundColor: '#05060D' }}>
      <View
        style={[
          styles.container,
          {
            flex: 1,
            backgroundColor: '#05060D',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          },
        ]}
      >
        <ActivityIndicator size="small" color="#7A9ABE" />
        <Text
          style={{
            fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
            fontSize: 12,
            letterSpacing: 1.5,
            color: '#C8E4FF',
            marginTop: 14,
          }}
        >
          Resuming your interview...
        </Text>
      </View>
    </SafeAreaContainer>
  );
}
