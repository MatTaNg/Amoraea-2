import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  POST_INTERVIEW_FEEDBACK_QUESTIONS,
  type PostInterviewFeedbackKey,
} from '@features/aria/interviewPostInterviewFeedbackConfig';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { AdminAttemptTabsView } from '@app/screens/AdminInterviewDashboard';
import { UserCommunicationStyleSection } from '@ui/components/UserCommunicationStyleSection';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';

export function AriaInterviewUnderReviewScreen({
  isAdminAccount,
  userId,
  analysisAttemptId,
  hasSubmittedPostInterviewFeedback,
  showPostInterviewFeedback,
  postInterviewFeedbackError,
  postInterviewRatings,
  postInterviewComments,
  postInterviewGeneralFeedback,
  onSignOut,
  onOpenAdminPanel,
  onRetake,
  onOpenFeedback,
  onCloseFeedback,
  onClearFeedbackError,
  onSetRating,
  onSetComment,
  onSetGeneralFeedback,
  onSubmitFeedback,
}: {
  isAdminAccount: boolean;
  userId: string;
  analysisAttemptId: string | null;
  hasSubmittedPostInterviewFeedback: boolean;
  showPostInterviewFeedback: boolean;
  postInterviewFeedbackError: string | null;
  postInterviewRatings: Record<PostInterviewFeedbackKey, number | null>;
  postInterviewComments: Record<PostInterviewFeedbackKey, string>;
  postInterviewGeneralFeedback: string;
  onSignOut: () => void;
  onOpenAdminPanel: () => void;
  onRetake: () => void;
  onOpenFeedback: () => void;
  onCloseFeedback: () => void;
  onClearFeedbackError: () => void;
  onSetRating: (id: PostInterviewFeedbackKey, value: number) => void;
  onSetComment: (id: PostInterviewFeedbackKey, text: string) => void;
  onSetGeneralFeedback: (text: string) => void;
  onSubmitFeedback: () => void;
}): React.ReactElement {
  return (
    <SafeAreaContainer style={{ backgroundColor: '#05060D' }}>
      <ScrollView style={[styles.container, { backgroundColor: '#05060D' }]} contentContainerStyle={{ minHeight: '100%', padding: 0 }}>
        <View
          style={{
            width: '100%',
            minHeight: '100%',
            backgroundColor: '#05060D',
            borderWidth: 0,
            borderRadius: 0,
            padding: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.introNote, { color: colors.warning, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 0 }]}>
              ◆ Thank you
            </Text>
            <TouchableOpacity
              onPress={onSignOut}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(91,168,232,0.35)',
                backgroundColor: 'rgba(91,168,232,0.08)',
              }}
            >
              <Ionicons name="log-out-outline" size={14} color="#8EC6FF" />
              <Text style={{ color: '#8EC6FF', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>Log out</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.introTitle, { marginBottom: 10, color: '#F4F8FC', textAlign: 'left', fontWeight: '700' }]}>
            You've finished — thank you for going through this with me.
          </Text>
          <Text style={[styles.introHint, { textAlign: 'left' }]}>We'll have your results ready soon.</Text>

          {isAdminAccount ? (
            <Pressable
              onPress={onOpenAdminPanel}
              accessibilityRole="button"
              accessibilityLabel="Open admin panel"
              style={({ pressed }) => [
                styles.retakeButtonUnderReview,
                {
                  marginTop: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(91,168,232,0.12)',
                  borderColor: 'rgba(107,185,255,0.45)',
                  borderWidth: 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: '#8EC6FF',
                  textAlign: 'center',
                }}
              >
                ◆ Admin panel
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.introHint, { textAlign: 'left', marginTop: 16, marginBottom: 8, color: '#D6E6F7' }]}>
            Retaking the interview will not replace these scores.
          </Text>
          <View style={{ width: '100%', flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 10 }}>
            <Pressable
              onPress={onRetake}
              style={({ pressed }) => [
                styles.retakeButtonUnderReview,
                {
                  flex: 1,
                  opacity: pressed ? 0.82 : 1,
                  marginTop: 0,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#1E6FD9',
                  borderColor: 'rgba(107,185,255,0.8)',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.retakeButtonUnderReviewText, { fontSize: 14, fontWeight: '700', letterSpacing: 1.1, color: '#F4F8FC' }]}>
                Retest
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenFeedback}
              style={({ pressed }) => [
                styles.retakeButtonUnderReview,
                {
                  flex: 1,
                  opacity: pressed ? 0.82 : 1,
                  marginTop: 0,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#123459',
                  borderColor: 'rgba(107,185,255,0.55)',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.retakeButtonUnderReviewText, { fontSize: 14, fontWeight: '700', letterSpacing: 1.1, color: '#E7F1FB' }]}>
                {hasSubmittedPostInterviewFeedback ? 'Edit feedback' : 'Feedback'}
              </Text>
            </Pressable>
          </View>

          <View style={{ width: '100%', marginTop: 16 }}>
            <Text style={[styles.introHint, { textAlign: 'left', marginBottom: 12, color: '#D6E6F7' }]}>
              You may review your interview results below. Please use the feedback button to let me know if you feel this
              information is a fair assessment of you.
            </Text>
            <AdminAttemptTabsView attemptId={analysisAttemptId} userId={userId} />
            <UserCommunicationStyleSection userId={userId} />
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={showPostInterviewFeedback}
        transparent
        animationType="fade"
        onRequestClose={onCloseFeedback}
      >
        <View style={styles.feedbackModalBackdrop}>
          <View style={styles.feedbackModalCard}>
            <Text style={styles.feedbackModalTitle}>Interview Feedback</Text>
            <Text style={styles.feedbackModalHint}>
              Rate each question from 1-10. 1 = completely disagree, 10 = completely agree.
            </Text>
            {postInterviewFeedbackError ? (
              <Text style={styles.feedbackModalError}>{postInterviewFeedbackError}</Text>
            ) : null}
            <ScrollView style={styles.feedbackModalScroll} contentContainerStyle={{ paddingBottom: 8 }}>
              {POST_INTERVIEW_FEEDBACK_QUESTIONS.map((q) => (
                <View key={q.id} style={styles.feedbackQuestionBlock}>
                  <Text style={styles.feedbackQuestionTitle}>{q.title}</Text>
                  <Text style={styles.feedbackQuestionPrompt}>{q.prompt}</Text>
                  <View style={styles.feedbackScaleRow}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                      const active = postInterviewRatings[q.id] === value;
                      return (
                        <TouchableOpacity
                          key={`${q.id}-${value}`}
                          style={[styles.feedbackScalePill, active && styles.feedbackScalePillActive]}
                          onPress={() => {
                            onClearFeedbackError();
                            onSetRating(q.id, value);
                          }}
                        >
                          <Text style={[styles.feedbackScalePillText, active && styles.feedbackScalePillTextActive]}>
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    value={postInterviewComments[q.id]}
                    onChangeText={(text) => onSetComment(q.id, text)}
                    placeholder="Optional comment"
                    placeholderTextColor="#6B7280"
                    multiline
                    style={styles.feedbackCommentInput}
                  />
                </View>
              ))}
              <View style={styles.feedbackQuestionBlock}>
                <Text style={styles.feedbackQuestionTitle}>Additional Feedback</Text>
                <Text style={styles.feedbackQuestionPrompt}>Is there any other feedback you would like to give?</Text>
                <TextInput
                  value={postInterviewGeneralFeedback}
                  onChangeText={onSetGeneralFeedback}
                  placeholder="Optional"
                  placeholderTextColor="#6B7280"
                  multiline
                  style={styles.feedbackCommentInput}
                />
              </View>
            </ScrollView>
            <View style={styles.feedbackModalActions}>
              <TouchableOpacity
                onPress={onCloseFeedback}
                style={[styles.feedbackActionButton, styles.feedbackActionCancel]}
              >
                <Text style={styles.feedbackActionCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSubmitFeedback}
                style={[styles.feedbackActionButton, styles.feedbackActionSubmit]}
              >
                <Text style={styles.feedbackActionSubmitText}>
                  {hasSubmittedPostInterviewFeedback ? 'Resubmit' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaContainer>
  );
}
