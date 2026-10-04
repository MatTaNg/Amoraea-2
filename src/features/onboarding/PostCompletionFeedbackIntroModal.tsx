import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  POST_COMPLETION_FEEDBACK_DECLINE_LABEL,
  POST_COMPLETION_FEEDBACK_GIVE_LABEL,
  POST_COMPLETION_FEEDBACK_INTRO_BODY,
  POST_COMPLETION_FEEDBACK_INTRO_TITLE,
} from '@features/onboarding/postCompletionFeedback';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostCompletionFeedbackIntroModalProps = {
  visible: boolean;
  onGiveFeedback: () => void;
  onDecline: () => void;
};

export function PostCompletionFeedbackIntroModal({
  visible,
  onGiveFeedback,
  onDecline,
}: PostCompletionFeedbackIntroModalProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close feedback invitation"
            onPress={onDecline}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.72)" />
          </Pressable>
          <Text style={styles.title}>{POST_COMPLETION_FEEDBACK_INTRO_TITLE}</Text>
          <Text style={styles.body}>{POST_COMPLETION_FEEDBACK_INTRO_BODY}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={POST_COMPLETION_FEEDBACK_GIVE_LABEL}
            onPress={onGiveFeedback}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>{POST_COMPLETION_FEEDBACK_GIVE_LABEL}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={POST_COMPLETION_FEEDBACK_DECLINE_LABEL}
            onPress={onDecline}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>{POST_COMPLETION_FEEDBACK_DECLINE_LABEL}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.72)',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0B1324',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.26)',
    borderRadius: 18,
    paddingTop: 36,
    paddingBottom: 18,
    paddingHorizontal: 22,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    color: '#F8FBFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryButton: {
    backgroundColor: '#9CCBFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: FONT_BODY,
    fontSize: 17,
    fontWeight: '700',
    color: '#041018',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  secondaryText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.62)',
  },
});
