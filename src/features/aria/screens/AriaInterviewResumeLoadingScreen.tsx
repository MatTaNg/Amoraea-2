import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React from 'react';
import { Platform, Text, View } from 'react-native';

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
        <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
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
