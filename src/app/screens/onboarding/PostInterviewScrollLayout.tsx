import React from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';

export const POST_INTERVIEW_BG = '#05060D';

type PostInterviewScrollLayoutProps = {
  children: React.ReactNode;
  scrollViewRef?: React.RefObject<ScrollView | null>;
};

/** Scrollable body for post-interview stack screens (header is stack-owned). */
export function PostInterviewScrollLayout({ children, scrollViewRef }: PostInterviewScrollLayoutProps) {
  return (
    <SafeAreaContainer style={styles.container}>
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
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
});
