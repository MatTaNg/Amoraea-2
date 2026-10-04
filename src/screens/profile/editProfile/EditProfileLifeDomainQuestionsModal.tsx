import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
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
import { submitLifeDomainQuestionSuggestion } from '@/datingProfile/screens/onboarding/modals/lifeDomainQuestionSuggestion';

type Props = {
  visible: boolean;
  userId: string;
  domainId: LifeDomainId;
  wantKids?: string | null;
  answers: LifeDomainAnswersMap;
  onAnswerChange: LifeDomainAnswerChangeHandler;
  onClose: () => void;
};

export function EditProfileLifeDomainQuestionsModal({
  visible,
  userId,
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
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [suggestionSending, setSuggestionSending] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
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
    setSuggestionOpen(false);
    setSuggestion('');
    setSuggestionSending(false);
    setSuggestionSent(false);
    setSuggestionError(null);
  }, [domainId, visible]);

  const openSuggestion = useCallback(() => {
    setSuggestionOpen(true);
    setSuggestionSent(false);
    setSuggestionError(null);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const sendSuggestion = useCallback(async () => {
    const trimmed = suggestion.trim();
    if (!trimmed || suggestionSending) return;
    if (!userId) {
      setSuggestionError('Sign in to send a question suggestion.');
      return;
    }
    setSuggestionSending(true);
    setSuggestionError(null);
    const { error } = await submitLifeDomainQuestionSuggestion(userId, domainId, trimmed);
    setSuggestionSending(false);
    if (error) {
      setSuggestionError(error);
      return;
    }
    setSuggestion('');
    setSuggestionSent(true);
  }, [domainId, suggestion, suggestionSending, userId]);

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
        <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} accessibilityLabel="Dismiss keyboard" />
        <View style={styles.keyboardAvoid} pointerEvents="box-none">
          <SafeAreaView
            style={[
              styles.sheet,
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
              { flexGrow: 1, paddingBottom: 28 + keyboardInset },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <Pressable
              accessible={false}
              onPress={Keyboard.dismiss}
              style={styles.scrollTapArea}
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
            </Pressable>
          </ScrollView>
          <View
            style={[
              styles.suggestionFooter,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {suggestionOpen ? (
              <>
                <Text style={styles.suggestionLabel}>Suggest a question</Text>
                <TextInput
                  style={styles.suggestionInput}
                  value={suggestion}
                  onChangeText={(text) => {
                    setSuggestion(text);
                    setSuggestionSent(false);
                    setSuggestionError(null);
                  }}
                  placeholder="What question should we ask in this life area?"
                  placeholderTextColor={ep.colors.textDim}
                  multiline
                  textAlignVertical="top"
                  editable={!suggestionSending}
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                {suggestionError ? (
                  <Text style={styles.suggestionError}>{suggestionError}</Text>
                ) : null}
                {suggestionSent ? (
                  <Text style={styles.suggestionSent}>
                    Thanks — your question was sent.
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => void sendSuggestion()}
                  disabled={suggestionSending || suggestion.trim().length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Send question suggestion"
                  style={({ pressed }) => [
                    styles.suggestionSend,
                    (suggestionSending || suggestion.trim().length === 0) &&
                      styles.suggestionSendDisabled,
                    pressed && styles.doneBtnPressed,
                  ]}
                >
                  {suggestionSending ? (
                    <ActivityIndicator color={ep.colors.textBright} />
                  ) : (
                    <Text style={styles.suggestionSendText}>Send</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={openSuggestion}
                accessibilityRole="button"
                accessibilityLabel="Suggest a question"
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed && styles.doneBtnPressed,
                ]}
              >
                <Text style={styles.suggestionButtonText}>Suggest a question</Text>
              </Pressable>
            )}
          </View>
          </SafeAreaView>
        </View>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  scrollTapArea: {
    flexGrow: 1,
  },
  suggestionFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ep.colors.borderDefault,
    gap: 10,
    backgroundColor: ep.colors.void,
  },
  suggestionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ep.colors.borderStrong,
    borderRadius: ep.spacing.inputRadius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: ep.colors.buttonTintBg,
  },
  suggestionButtonText: {
    fontFamily: ep.fonts.ui,
    fontSize: 15,
    fontWeight: '600',
    color: ep.colors.flameMid,
  },
  suggestionLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 15,
    fontWeight: '600',
    color: ep.colors.textBright,
  },
  suggestionInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: ep.colors.borderStrong,
    borderRadius: ep.spacing.inputRadius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: ep.colors.textPrimary,
    fontSize: 15,
    backgroundColor: ep.colors.glassBg,
  },
  suggestionSend: {
    alignSelf: 'flex-start',
    backgroundColor: ep.colors.flameDeep,
    borderRadius: ep.spacing.inputRadius,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 88,
    alignItems: 'center',
  },
  suggestionSendDisabled: {
    opacity: 0.45,
  },
  suggestionSendText: {
    fontFamily: ep.fonts.ui,
    fontSize: 15,
    fontWeight: '600',
    color: ep.colors.textBright,
  },
  suggestionError: {
    color: ep.colors.errorSoft,
    fontSize: 13,
  },
  suggestionSent: {
    color: ep.colors.success,
    fontSize: 13,
  },
});
