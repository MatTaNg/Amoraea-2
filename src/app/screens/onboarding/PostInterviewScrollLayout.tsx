import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { PAGE_CONTENT_MAX_WIDTH } from '@utilities/pageContentWidth';

export const POST_INTERVIEW_BG = '#05060D';

type PostInterviewScrollLayoutProps = {
  children: React.ReactNode;
  scrollViewRef?: React.RefObject<ScrollView | null>;
};

/** Full-screen wait while Complete/Edit profile resolves the next screen. */
export function PostInterviewProfileCtaLoadingPage() {
  return (
    <View style={styles.pageLoading} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
    </View>
  );
}

/** Scrollable body for post-interview stack screens (header is stack-owned). */
export function PostInterviewScrollLayout({ children, scrollViewRef }: PostInterviewScrollLayoutProps) {
  return (
    <SafeAreaContainer edges={['bottom', 'left', 'right']} style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  pageLoading: {
    flex: 1,
    backgroundColor: POST_INTERVIEW_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: POST_INTERVIEW_BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: POST_INTERVIEW_BG,
    ...Platform.select({
      web: { overflow: 'auto' as const },
    }),
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: 'center',
    maxWidth: PAGE_CONTENT_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
});
