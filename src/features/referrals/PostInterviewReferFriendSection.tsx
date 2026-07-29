import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const POST_INTERVIEW_REFER_FRIEND_TITLE = 'Know someone who can pass?';

export const POST_INTERVIEW_REFER_FRIEND_BODY =
  'Share your personal code with someone you think is ready. If they complete the AI interview and psychometric assessments, you will both receive an additional 20% discount on all future subscriptions for life!';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostInterviewReferFriendSectionProps = {
  referralCode: string;
  copyFeedback: boolean;
  onCopyPress: () => void;
  showTopDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PostInterviewReferFriendSection({
  referralCode,
  copyFeedback,
  onCopyPress,
  showTopDivider = true,
  style,
}: PostInterviewReferFriendSectionProps) {
  return (
    <View style={[styles.section, style]}>
      {showTopDivider ? <View style={styles.divider} /> : null}
      <Text style={styles.title}>{POST_INTERVIEW_REFER_FRIEND_TITLE}</Text>
      <Text style={styles.body}>{POST_INTERVIEW_REFER_FRIEND_BODY}</Text>
      <View style={styles.codeBlockRow}>
        <Text style={styles.codeBlockText} selectable>
          {referralCode}
        </Text>
        <Pressable
          onPress={onCopyPress}
          style={({ pressed }) => [styles.copyCodeBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={copyFeedback ? 'Referral code copied' : 'Copy referral code'}
        >
          <Text style={styles.copyCodeBtnLabel}>{copyFeedback ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 19,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 10,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 14,
  },
  codeBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  codeBlockText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#f8fafc',
  },
  copyCodeBtn: {
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyCodeBtnLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: '#93c5fd',
  },
});
