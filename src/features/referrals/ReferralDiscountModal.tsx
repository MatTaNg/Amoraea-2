import { Ionicons } from '@expo/vector-icons';
import React, { useContext } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type ReferralDiscountModalProps = {
  visible: boolean;
  onDismiss: () => void;
  closeAccessibilityLabel: string;
  children: React.ReactNode;
};

/** Shared referral discount popup. Content scrolls when the phone is shorter than the card. */
export function ReferralDiscountModal({
  visible,
  onDismiss,
  closeAccessibilityLabel,
  children,
}: ReferralDiscountModalProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const { height: windowHeight } = useWindowDimensions();
  const paddingTop = Math.max(insets.top, 12);
  const paddingBottom = Math.max(insets.bottom, 12);
  const modalMaxHeight = windowHeight - paddingTop - paddingBottom - 16;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.modalBackdrop, { paddingTop, paddingBottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss referral popup"
          onPress={onDismiss}
          style={styles.backdropTouch}
        />
        <View style={[styles.modalCard, { maxHeight: modalMaxHeight }]}>
          <ScrollView
            style={{ maxHeight: modalMaxHeight }}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces={false}
          >
            {children}
            <Pressable onPress={onDismiss} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryText}>Got it</Text>
            </Pressable>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
            onPress={onDismiss}
            style={styles.modalClose}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.72)" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.72)',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0B1324',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.26)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalScrollContent: {
    paddingTop: 36,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  modalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 2,
  },
  modalSecondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalSecondaryText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: '#9CCBFF',
  },
});
