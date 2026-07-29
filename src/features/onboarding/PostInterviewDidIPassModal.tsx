import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LAUNCH_WAITLIST_USER_GOAL } from '@features/onboarding/postInterviewLaunchMode';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostInterviewDidIPassModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PostInterviewDidIPassModal({ visible, onClose }: PostInterviewDidIPassModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.72)" />
          </Pressable>
          <Text style={styles.title}>We&apos;re Blazing New Trails Here!</Text>
          <Text style={styles.body}>
            What we&apos;re doing has never been done before — nobody has written a test which confidently
            concludes if someone is relationship-ready. We want to make our pass threshold based on real data,
            so we can&apos;t conclusively give people a solid pass or fail yet.
          </Text>
          <Text style={styles.body}>
            What we can say is if your score is far below or far greater than the average score then you likely
              failed or passed. If you are around the average, it&apos;s a toss up. 
          </Text>
          <Text style={styles.body}>
          Keep in mind too, that algorithm changes may also change your score. When we reach{' '}
          {LAUNCH_WAITLIST_USER_GOAL} users, you will know for sure whether you passed or failed.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Got it!"
            onPress={onClose}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>Got it!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    fontWeight: '600',
    color: '#F4F4F5',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 30,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 14,
  },
  primaryButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,168,232,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.45)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F4FF',
  },
});
