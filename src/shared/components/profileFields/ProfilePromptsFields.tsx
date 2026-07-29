import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import {
  PROFILE_PROMPT_CATEGORIES,
  MAX_PROFILE_PROMPTS,
  PROFILE_PROMPT_ANSWER_MAX_LENGTH,
  getPromptById,
  isRequiredEligibleCategory,
} from '@/features/profile/profilePromptsLibrary';
import {
  wouldRemovalBreakRequiredCategoryFloor,
  validateProfilePromptsForSetup,
} from '@/features/profile/profilePromptValidation';
import { theme } from '@/shared/theme/theme';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

export type ProfilePromptsFieldsProps = {
  prompts: ProfilePromptAnswer[];
  onChange: (next: ProfilePromptAnswer[]) => void;
  /** When true, show setup validation hint (onboarding). */
  showSetupHints?: boolean;
};

type FlowStep = 'list' | 'category' | 'prompt' | 'answer';

export const ProfilePromptsFields: React.FC<ProfilePromptsFieldsProps> = ({
  prompts,
  onChange,
  showSetupHints = false,
}) => {
  const insets = useSafeAreaInsets();
  const answerScrollRef = useRef<ScrollView>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [flowStep, setFlowStep] = useState<FlowStep>('list');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const selectedIds = useMemo(() => new Set(prompts.map((p) => p.promptId)), [prompts]);
  const canAdd = prompts.length < MAX_PROFILE_PROMPTS;

  const setupValidation = useMemo(
    () => (showSetupHints ? validateProfilePromptsForSetup(prompts) : null),
    [prompts, showSetupHints],
  );

  useEffect(() => {
    if (!pickerOpen) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [pickerOpen]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setFlowStep('list');
    setActiveCategoryId(null);
    setActivePromptId(null);
    setDraftAnswer('');
    setEditingIndex(null);
  }, []);

  const openAddFlow = useCallback(() => {
    setEditingIndex(null);
    setFlowStep('category');
    setActiveCategoryId(null);
    setActivePromptId(null);
    setDraftAnswer('');
    setPickerOpen(true);
  }, []);

  const openEditFlow = useCallback((index: number) => {
    const row = prompts[index];
    if (!row) return;
    setEditingIndex(index);
    setActivePromptId(row.promptId);
    setActiveCategoryId(row.categoryId);
    setDraftAnswer(row.answer);
    setFlowStep('answer');
    setPickerOpen(true);
  }, [prompts]);

  const commitAnswer = useCallback(() => {
    const promptId = activePromptId;
    const categoryId = activeCategoryId;
    const answer = draftAnswer.trim();
    if (!promptId || !categoryId || !answer) return;

    if (editingIndex != null) {
      const next = [...prompts];
      next[editingIndex] = { promptId, categoryId, answer };
      onChange(next);
    } else {
      onChange([...prompts, { promptId, categoryId, answer }]);
    }
    closePicker();
  }, [activeCategoryId, activePromptId, closePicker, draftAnswer, editingIndex, onChange, prompts]);

  const removeAt = useCallback(
    (index: number) => {
      if (wouldRemovalBreakRequiredCategoryFloor(prompts, index)) return;
      onChange(prompts.filter((_, i) => i !== index));
    },
    [onChange, prompts],
  );

  const activeCategory = PROFILE_PROMPT_CATEGORIES.find((c) => c.id === activeCategoryId);
  const activePrompt = activePromptId ? getPromptById(activePromptId) : undefined;
  const charCount = draftAnswer.length;
  const answerTooLong = charCount > PROFILE_PROMPT_ANSWER_MAX_LENGTH;
  const canSaveAnswer =
    draftAnswer.trim().length > 0 && !answerTooLong && Boolean(activePromptId && activeCategoryId);

  return (
    <View style={styles.root}>
      {showSetupHints ? (
        <Text style={styles.lead}>
          Pick at least one prompt from <Text style={styles.em}>What Matters To Me</Text> or{' '}
          <Text style={styles.em}>How I Show Up</Text>. You can add up to {MAX_PROFILE_PROMPTS}{' '}
          total — the rest are optional.
        </Text>
      ) : (
        <Text style={styles.lead}>
          Answer up to {MAX_PROFILE_PROMPTS} prompts. Keep at least one from{' '}
          <Text style={styles.em}>What Matters To Me</Text> or{' '}
          <Text style={styles.em}>How I Show Up</Text>.
        </Text>
      )}

      {prompts.map((row, index) => {
        const prompt = getPromptById(row.promptId);
        const removalBlocked = wouldRemovalBreakRequiredCategoryFloor(prompts, index);
        return (
          <View key={`${row.promptId}-${index}`} style={styles.card}>
            <Text style={styles.promptQuestion}>{prompt?.text ?? row.promptId}</Text>
            <Text style={styles.promptAnswer}>{row.answer}</Text>
            <View style={styles.cardActions}>
              <Pressable onPress={() => openEditFlow(index)} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => removeAt(index)}
                disabled={removalBlocked}
                style={[styles.linkBtn, removalBlocked && styles.linkBtnDisabled]}
              >
                <Text style={[styles.linkBtnText, removalBlocked && styles.linkBtnTextDisabled]}>
                  Remove
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {canAdd ? (
        <Pressable onPress={openAddFlow} style={styles.addBtn}>
          <Text style={styles.addBtnText}>
            {prompts.length === 0 ? 'Choose a prompt' : 'Add another prompt'}
          </Text>
        </Pressable>
      ) : null}

      {showSetupHints && setupValidation && !setupValidation.ok ? (
        <Text style={styles.validationHint}>{setupValidation.message}</Text>
      ) : null}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={insets.top}
          >
            <View
              style={[
                styles.modalCard,
                Platform.OS === 'android' &&
                  keyboardInset > 0 && {
                    marginBottom: Math.max(0, keyboardInset - insets.bottom),
                  },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {flowStep === 'category'
                    ? 'Choose a category'
                    : flowStep === 'prompt'
                      ? activeCategory?.title ?? 'Choose a prompt'
                      : 'Your answer'}
                </Text>
                <Pressable onPress={closePicker}>
                  <Text style={styles.modalClose}>Close</Text>
                </Pressable>
              </View>

              {flowStep === 'category' ? (
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                  {PROFILE_PROMPT_CATEGORIES.map((category) => (
                    <Pressable
                      key={category.id}
                      style={styles.categoryRow}
                      onPress={() => {
                        setActiveCategoryId(category.id);
                        setFlowStep('prompt');
                      }}
                    >
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      {isRequiredEligibleCategory(category.id) ? (
                        <Text style={styles.categoryBadge}>Counts toward required prompt</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {flowStep === 'prompt' && activeCategory ? (
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                  {activeCategory.prompts
                    .filter((p) => editingIndex != null || !selectedIds.has(p.id))
                    .map((prompt) => (
                      <Pressable
                        key={prompt.id}
                        style={styles.promptRow}
                        onPress={() => {
                          setActivePromptId(prompt.id);
                          setActiveCategoryId(activeCategory.id);
                          setFlowStep('answer');
                        }}
                      >
                        <Text style={styles.promptRowText}>{prompt.text}</Text>
                      </Pressable>
                    ))}
                </ScrollView>
              ) : null}

              {flowStep === 'answer' ? (
                <ScrollView
                  ref={answerScrollRef}
                  style={styles.answerScroll}
                  contentContainerStyle={styles.answerPane}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.answerPrompt}>{activePrompt?.text}</Text>
                  <TextInput
                    style={styles.answerInput}
                    value={draftAnswer}
                    onChangeText={(t) =>
                      setDraftAnswer(t.slice(0, PROFILE_PROMPT_ANSWER_MAX_LENGTH))
                    }
                    placeholder="Type your answer…"
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    maxLength={PROFILE_PROMPT_ANSWER_MAX_LENGTH}
                    textAlignVertical="top"
                    onFocus={() => {
                      requestAnimationFrame(() => {
                        answerScrollRef.current?.scrollToEnd({ animated: true });
                      });
                    }}
                  />
                  <Text style={[styles.counter, answerTooLong && styles.counterError]}>
                    {charCount}/{PROFILE_PROMPT_ANSWER_MAX_LENGTH}
                  </Text>
                  <Pressable
                    onPress={commitAnswer}
                    disabled={!canSaveAnswer}
                    style={[styles.saveBtn, !canSaveAnswer && styles.saveBtnDisabled]}
                  >
                    <Text style={styles.saveBtnText}>Save answer</Text>
                  </Pressable>
                </ScrollView>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 12 },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    fontFamily: FONT_BODY,
  },
  em: { color: theme.colors.text, fontWeight: '600' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 8,
  },
  promptQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 24,
    fontFamily: FONT_BODY,
  },
  promptAnswer: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    fontFamily: FONT_BODY,
  },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  linkBtn: { paddingVertical: 4 },
  linkBtnDisabled: { opacity: 0.4 },
  linkBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
  linkBtnTextDisabled: { color: theme.colors.textSecondary },
  addBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: 15 },
  validationHint: { color: '#f87171', fontSize: 13, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, flex: 1 },
  modalClose: { color: theme.colors.textSecondary, fontSize: 15 },
  modalScroll: { maxHeight: 420, paddingHorizontal: 12, paddingTop: 8 },
  categoryRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  categoryTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  categoryBadge: { fontSize: 12, color: theme.colors.primary, marginTop: 4 },
  promptRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  promptRowText: { fontSize: 15, lineHeight: 21, color: theme.colors.text },
  answerScroll: { flexGrow: 0, maxHeight: 360 },
  answerPane: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 },
  answerPrompt: { fontSize: 17, fontWeight: '700', color: theme.colors.text, lineHeight: 23 },
  answerInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  counter: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'right' },
  counterError: { color: '#f87171' },
  saveBtn: {
    marginTop: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
