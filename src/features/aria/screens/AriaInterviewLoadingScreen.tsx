import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React from 'react';
import { View } from 'react-native';

import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';

export function AriaInterviewLoadingScreen(): React.ReactElement {
  return (
    <SafeAreaContainer style={{ flex: 1, backgroundColor: '#05060D' }}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#05060D',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
      </View>
    </SafeAreaContainer>
  );
}
