import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  countAnsweredInDomain,
  getLifeDomainOnboardingMeta,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';
import {
  getLifeDomainAnswersForDomain,
  renderEditProfileLifeDomainQuestion,
  type LifeDomainAnswerChangeHandler,
} from '@/screens/profile/editProfile/editProfileLifeDomainQuestionFields';
import { ep } from '@/screens/profile/editProfile/editProfileTheme';

type Props = {
  visible: boolean;
  domainId: LifeDomainId;
  wantKids?: string | null;
  answers: LifeDomainAnswersMap;
  onAnswerChange: LifeDomainAnswerChangeHandler;
  onClose: () => void;
};

export function EditProfileLifeDomainQuestionsModal({
  visible,
  domainId,
  wantKids,
  answers,
  onAnswerChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsetsRef = useRef<Map<string, number>>(new Map());
  const focusedQuestionRef = useRef<string | null>(null);
  const keyboardInsetRef = useRef(0);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const meta = getLifeDomainOnboardingMeta(domainId);
  const domainAnswers = getLifeDomainAnswersForDomain(answers, domainId);
  const questions = LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId] ?? [];

  const { answered, total } = useMemo(
    () => countAnsweredInDomain(domainId, domainAnswers, { wantKids }),
    [domainAnswers, domainId, wantKids],
  );

  const scrollToQuestion = useCallback((questionId: string) => {
    const y = fieldOffsetsRef.current.get(questionId);
    if (y == null) return;
    const topInset = keyboardInsetRef.current > 0 ? 100 : 24;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - topInset),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      keyboardInsetRef.current = 0;
      focusedQuestionRef.current = null;
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      keyboardInsetRef.current = event.endCoordinates.height;
      setKeyboardInset(event.endCoordinates.height);
      const focusedQuestionId = focusedQuestionRef.current;
      if (focusedQuestionId) {
        setTimeout(() => scrollToQuestion(focusedQuestionId), Platform.OS === 'ios' ? 0 : 50);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardInsetRef.current = 0;
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToQuestion, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <SafeAreaView
            style={[
              styles.sheet,
              Platform.OS === 'android' &&
                keyboardInset > 0 && {
                  marginBottom: Math.max(0, keyboardInset - insets.bottom),
                },
            ]}
            edges={['top', 'left', 'right']}
          >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                {meta.icon} {meta.name}
              </Text>
              {total > 0 ? (
                <Text style={styles.headerMeta}>
                  {answered} of {total} answered
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 28 + keyboardInset },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {questions.map((q) => (
              <View
                key={q.id}
                onLayout={(event) => {
                  fieldOffsetsRef.current.set(q.id, event.nativeEvent.layout.y);
                }}
              >
                {renderEditProfileLifeDomainQuestion(
                  domainId,
                  q,
                  domainAnswers[q.id] ?? '',
                  onAnswerChange,
                  {
                    onTextFocus: () => {
                      focusedQuestionRef.current = q.id;
                      scrollToQuestion(q.id);
                    },
                  },
                )}
              </View>
            ))}
          </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    maxHeight: '92%',
    backgroundColor: ep.colors.void,
    borderTopLeftRadius: ep.spacing.cardRadius,
    borderTopRightRadius: ep.spacing.cardRadius,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ep.colors.borderDefault,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontFamily: ep.fonts.display,
    fontSize: 20,
    fontWeight: '500',
    color: ep.colors.textBright,
  },
  headerMeta: {
    fontFamily: ep.fonts.body,
    fontSize: 13,
    color: ep.colors.textSecondary,
  },
  doneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  doneBtnPressed: {
    opacity: 0.7,
  },
  doneBtnText: {
    fontFamily: ep.fonts.ui,
    fontSize: 15,
    fontWeight: '600',
    color: ep.colors.flameMid,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
