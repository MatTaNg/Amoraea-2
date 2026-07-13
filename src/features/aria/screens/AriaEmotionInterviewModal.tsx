import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { EMOTION_INTERVIEW_MODAL_ITEMS } from '@features/aria/emotionRecognitionInterview';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';

export function AriaEmotionInterviewModal({
  visible,
  itemIndex,
  onAnswer,
}: {
  visible: boolean;
  itemIndex: number;
  onAnswer: (letter: string) => void;
}): React.ReactElement {
  return (
    <Modal
      visible={visible && itemIndex < EMOTION_INTERVIEW_MODAL_ITEMS.length}
      transparent
      animationType="fade"
      {...(Platform.OS === 'ios' ? ({ presentationStyle: 'overFullScreen' as const } as const) : {})}
      {...(Platform.OS === 'web' ? ({ style: { zIndex: 99999 } as const } as const) : {})}
      {...(Platform.OS === 'android'
        ? ({ statusBarTranslucent: true, navigationBarTranslucent: true, style: { elevation: 9999 } } as const)
        : {})}
      onShow={() => {
        console.log('[EmotionModal] modal onShow, itemIndex', itemIndex);
      }}
    >
      <View
        style={[
          styles.feedbackModalBackdrop,
          Platform.OS === 'web' ? ({ zIndex: 99999, pointerEvents: 'auto' } as const) : null,
          Platform.OS === 'android' ? ({ zIndex: 9999, elevation: 9999 } as const) : null,
        ]}
      >
        <View style={[styles.feedbackModalCard, { maxHeight: '90%' }]}>
          <Text style={styles.feedbackModalTitle}>Quick question about what you just heard</Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={[styles.feedbackModalHint, { marginBottom: 16 }]}>
              {EMOTION_INTERVIEW_MODAL_ITEMS[itemIndex]?.question ?? ''}
            </Text>
            {(EMOTION_INTERVIEW_MODAL_ITEMS[itemIndex]?.choices ?? []).map((ch) => (
              <Pressable
                key={ch.letter}
                onPress={() => onAnswer(ch.letter)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  marginBottom: 10,
                  backgroundColor: pressed ? 'rgba(91,168,232,0.22)' : 'rgba(91,168,232,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(107,185,255,0.35)',
                })}
              >
                <Text style={{ color: '#E7F1FB', fontSize: 15, lineHeight: 22 }}>
                  <Text style={{ fontWeight: '700', color: '#9EC9FF' }}>{ch.letter}) </Text>
                  {ch.text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
