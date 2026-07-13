import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { INTERVIEW_MARKER_IDS, INTERVIEW_MARKER_LABELS } from '@features/aria/interviewMarkers';
import { INTERVIEW_PILLAR_DISPLAY_META } from '@features/aria/interviewPillarDisplayMeta';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { messageLooksLikeScoreCard } from '@features/aria/interviewSessionUtilities';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResult';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type AriaAdminReasoningProgress =
  | 'generating'
  | 'slow'
  | 'very_slow'
  | 'done'
  | 'pending'
  | 'failed'
  | null;

export function AriaAdminInterviewPanel({
  isAdmin,
  status,
  results,
  stageResults,
  messages,
  scrollViewRef,
  isWaiting,
  currentTranscript,
  voiceState,
  reasoningProgress,
  userId,
  userEmail,
  standardResultsReferralCode,
  standardResultsReferralCopyFeedback,
  typedAnswer,
  inputDisabled,
  emotionModalVisible,
  micError,
  micWarning,
  webInterviewerOutputActive,
  onPressStart,
  onPressEnd,
  onSendTyped,
  onSetTypedAnswer,
  onViewResults,
  onStandardApplicantContinue,
  onAdminResultsContinue,
  onCopyReferralCode,
}: {
  isAdmin: boolean;
  status: string;
  results: InterviewResults | null;
  stageResults: Array<{ stage: number; results: InterviewResults }>;
  messages: ReadonlyArray<{ role: string; content?: string; isError?: boolean; isWaiting?: boolean; id?: string }>;
  scrollViewRef: React.RefObject<ScrollView | null>;
  isWaiting: boolean;
  currentTranscript: string;
  voiceState: VoiceState;
  reasoningProgress: AriaAdminReasoningProgress;
  userId: string;
  userEmail: string | undefined;
  standardResultsReferralCode: string | null;
  standardResultsReferralCopyFeedback: boolean;
  typedAnswer: string;
  inputDisabled: boolean;
  emotionModalVisible: boolean;
  micError: string | null;
  micWarning: string | null;
  webInterviewerOutputActive: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onSendTyped: () => void;
  onSetTypedAnswer: (text: string) => void;
  onViewResults: () => void;
  onStandardApplicantContinue: () => void;
  onAdminResultsContinue: () => void;
  onCopyReferralCode: () => void;
}): React.ReactElement {
  const safeMessages = messages ?? [];
  const safeStageResults = stageResults ?? [];

  return (
    <View style={styles.adminWrap}>
      {isAdmin && (status === 'results' && results?.pillarScores ? (
        <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
          <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Final scores</Text>
          <View style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
            <View style={styles.stageScorePillars}>
              {Object.entries(results.pillarScores).map(([id, score]) => {
                const meta = INTERVIEW_PILLAR_DISPLAY_META[id] ?? { name: `Pillar ${id}`, color: colors.primary };
                return (
                  <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                    {meta.name}: {score}
                  </Text>
                );
              })}
            </View>
          </View>
        </View>
      ) : safeStageResults.length > 0 ? (
        <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
          <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Scores so far</Text>
          {safeStageResults.map(({ stage, results: sr }) => (
            <View key={stage} style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
              <Text style={[styles.stageScoreLabel, styles.adminStageScoreLabel]}>Stage {stage}</Text>
              <View style={styles.stageScorePillars}>
                {sr.pillarScores && Object.entries(sr.pillarScores).map(([id, score]) => {
                  const label = INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ?? id;
                  return (
                    <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                      {label}: {score}
                    </Text>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null)}
      <ScrollView
        ref={scrollViewRef}
        style={[styles.transcriptScroll, styles.adminTranscriptScroll]}
        contentContainerStyle={[styles.transcriptContent, styles.adminTranscriptContent]}
        keyboardShouldPersistTaps="handled"
      >
        {safeMessages.map((msg, i) => {
          const looksLikeScoreCard = messageLooksLikeScoreCard(msg);
          const isError = msg.isError === true;
          if (looksLikeScoreCard && !isAdmin) return null;
          if (msg.role === 'user' && !isAdmin) return null;
          const displayContent = typeof msg.content === 'string' ? stripControlTokens(msg.content) : msg.content;
          if (looksLikeScoreCard) {
            return (
              <View key={i} style={[styles.scoreCard, styles.adminScoreCard]}>
                <Text style={[styles.scoreCardContent, styles.adminScoreCardContent]}>{msg.content}</Text>
              </View>
            );
          }
          if (isError) {
            return (
              <View key={msg.id ?? i} style={[styles.msgRow, styles.msgRowError]}>
                <Text style={[styles.msgContent, styles.msgContentError]}>{displayContent}</Text>
              </View>
            );
          }
          const msgWaiting = msg.isWaiting;
          return (
            <View key={msg.id ?? i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
              <Text style={[styles.msgRole, styles.adminMsgRole]}>
                {msg.role === 'assistant' ? '◆ Interviewer' : 'You'}
              </Text>
              <Text
                style={[
                  styles.msgContent,
                  msgWaiting && styles.msgContentWaiting,
                  msg.role === 'assistant' ? styles.adminMsgContentInterviewer : styles.adminMsgContentUser,
                ]}
              >
                {displayContent}
              </Text>
            </View>
          );
        })}
        {isAdmin && isWaiting && (
          <View style={[styles.msgRowWaiting, styles.adminMsgRowWaiting]}>
            <Text style={[styles.msgRole, styles.adminMsgRole]}>◆ Interviewer</Text>
            <Text style={[styles.msgContentWaiting, styles.adminMsgContentWaiting]}>◆ Amoraea is thinking...</Text>
          </View>
        )}
        {currentTranscript && voiceState === 'listening' && (
          <View style={styles.msgRow}>
            <Text style={[styles.msgRole, { color: colors.error }]}>● You (speaking…)</Text>
            <Text style={[styles.msgContent, { fontStyle: 'italic' }]}>{currentTranscript}</Text>
          </View>
        )}
      </ScrollView>

      {status === 'scoring' && (
        <View style={styles.scoringIndicator}>
          <Text style={styles.scoringIndicatorDot}>◆</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoringIndicatorText}>
              {reasoningProgress === 'slow'
                ? 'This is taking a moment...'
                : reasoningProgress === 'very_slow'
                  ? 'Almost there...'
                  : reasoningProgress === 'pending'
                    ? 'Saving your results…'
                    : reasoningProgress === 'failed'
                      ? 'Something went wrong.'
                      : 'Preparing your analysis...'}
            </Text>
            {(reasoningProgress === 'slow' || reasoningProgress === 'very_slow') && (
              <Text style={styles.scoringIndicatorSub}>
                {reasoningProgress === 'very_slow'
                  ? 'Detailed analyses take a little longer.'
                  : 'Your transcript is being read carefully.'}
              </Text>
            )}
            {reasoningProgress === 'pending' && (
              <>
                <Text style={styles.scoringIndicatorSub}>
                  Your scores are saved. Full narrative analysis will finish when the connection allows — you can open
                  your results now.
                </Text>
                <Pressable onPress={onViewResults} style={styles.scoringViewScoresButton}>
                  <Text style={styles.scoringViewScoresButtonLabel}>View Scores →</Text>
                </Pressable>
              </>
            )}
            {reasoningProgress === 'failed' && (
              <>
                <Text style={styles.scoringIndicatorSub}>
                  Your scores have been saved. The detailed analysis may not be available.
                </Text>
                <Pressable onPress={onViewResults} style={styles.scoringViewScoresButton}>
                  <Text style={styles.scoringViewScoresButtonLabel}>View Scores →</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {status === 'results' && results && (
        <ScrollView
          key="final-results"
          style={[styles.resultsPanel, styles.resultsPanelHighlight]}
          contentContainerStyle={styles.resultsPanelContent}
        >
          <Text style={styles.resultsPanelTitle}>✦ Interview complete</Text>
          {!(isAmoraeaAdminConsoleEmail(userEmail) || isAdmin) ? (
            <>
              <Text style={styles.resultsPanelSummary}>
                Thank you for completing your interview. Your application is now being reviewed — this usually takes up to
                24 hours.
              </Text>
              {standardResultsReferralCode ? (
                <View style={styles.resultsReferFriendBlock}>
                  <Text style={styles.resultsReferFriendTitle}>Know someone who can pass?</Text>
                  <Text style={styles.resultsReferFriendBody}>
                    Share your personal code with someone you think is ready. If they complete the full interview, you
                    will both receive a 20% discount at our next event!
                  </Text>
                  <View style={styles.resultsReferCodeRow}>
                    <Text style={styles.resultsReferCodeText} selectable>
                      {standardResultsReferralCode}
                    </Text>
                    <Pressable
                      onPress={onCopyReferralCode}
                      style={({ pressed }) => [styles.resultsReferCopyBtn, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.resultsReferCopyBtnLabel}>
                        {standardResultsReferralCopyFeedback ? 'Copied' : 'Copy'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <Button title="Continue" onPress={onStandardApplicantContinue} style={styles.resultsPanelButton} />
            </>
          ) : (
            <>
              {results.gateResult ? (
                <View
                  style={[
                    styles.gateResultBlock,
                    {
                      backgroundColor: results.gateResult.pass ? '#F0F7F0' : '#FDF0F0',
                      borderColor: results.gateResult.pass ? colors.success : colors.error,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.gateResultLabel,
                      { color: results.gateResult.pass ? colors.success : colors.error },
                    ]}
                  >
                    {results.gateResult.pass ? '✓ Interview passed' : '✗ Interview not passed'}
                  </Text>
                  <Text style={styles.gateResultText}>
                    {results.gateResult.pass
                      ? `Weighted score: ${results.gateResult.weightedScore}/10 — meets the threshold of ${GATE_PASS_WEIGHTED_MIN} for profile creation.`
                      : results.gateResult.failReason
                        ? `${results.gateResult.failReason}${
                            results.gateResult.weightedScore != null
                              ? ` Overall weighted score: ${results.gateResult.weightedScore}/10.`
                              : ''
                          }`
                        : `Weighted score: ${results.gateResult.weightedScore ?? '—'}/10 — below the threshold of ${GATE_PASS_WEIGHTED_MIN} required for profile creation.`}
                  </Text>
                  {(results.gateResult.excludedMarkers?.length ?? 0) > 0 ? (
                    <Text style={styles.gateResultText}>
                      Unassessed markers (shown as "—") were excluded from weighted score calculation:{' '}
                      {results.gateResult.excludedMarkers
                        ?.map((id) => INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ?? id)
                        .join(', ')}
                      .
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {results.skipBreakdown != null && results.skipBreakdown.skips_taken > 0 ? (
                <Text style={styles.gateResultText}>
                  Skips: {results.skipBreakdown.skips_taken}
                  {results.skipBreakdown.skip_penalty_total !== 0
                    ? ` · Skip penalty: ${results.skipBreakdown.skip_penalty_total.toFixed(1)}`
                    : ''}
                </Text>
              ) : null}
              {results.interviewSummary ? (
                <Text style={styles.resultsPanelSummary}>{results.interviewSummary}</Text>
              ) : null}
              <View style={styles.resultsPanelPillars}>
                {INTERVIEW_MARKER_IDS.map((id) => {
                  const score = results.pillarScores?.[id];
                  const meta = INTERVIEW_PILLAR_DISPLAY_META[id] ?? { name: id, color: colors.primary };
                  const hasNumericScore = typeof score === 'number' && Number.isFinite(score);
                  return (
                    <View key={id} style={styles.resultsPillarRow}>
                      <View style={styles.resultsPillarHeader}>
                        <Text style={styles.resultsPillarName}>{meta.name}</Text>
                        <Text style={[styles.resultsPillarScore, { color: meta.color }]}>
                          {hasNumericScore ? `${score}/10` : '—'}
                        </Text>
                      </View>
                      {hasNumericScore ? (
                        <View style={styles.resultsPillarBar}>
                          <View
                            style={[
                              styles.resultsPillarBarFill,
                              { width: `${score * 10}%`, backgroundColor: meta.color },
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Button title="Continue →" onPress={onAdminResultsContinue} style={styles.resultsPanelButton} />
            </>
          )}
        </ScrollView>
      )}

      {status === 'active' && (
        <View style={[styles.voiceDock, isAdmin && styles.adminVoiceDock]}>
          {micError ? <Text style={[styles.dockError, isAdmin && styles.adminDockText]}>{micError}</Text> : null}
          {micWarning && !micError ? (
            <Text style={[styles.dockWarning, isAdmin && styles.adminDockText]}>{micWarning}</Text>
          ) : null}
          <Pressable
            onPressIn={onPressStart}
            onPressOut={onPressEnd}
            disabled={
              !!micError ||
              emotionModalVisible ||
              voiceState === 'processing' ||
              (Platform.OS === 'web' ? webInterviewerOutputActive : voiceState === 'speaking')
            }
            style={[
              styles.micOrb,
              voiceState === 'listening' && styles.micOrbListening,
              voiceState === 'processing' && styles.micOrbProcessing,
              voiceState === 'speaking' && styles.micOrbSpeaking,
            ]}
          >
            {voiceState === 'listening' ? (
              <Ionicons name="mic" size={36} color="#fff" />
            ) : voiceState === 'processing' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : voiceState === 'speaking' ? (
              <Ionicons name="volume-high" size={28} color="#fff" />
            ) : (
              <Ionicons name="mic" size={36} color="#fff" />
            )}
          </Pressable>
          <Text style={[styles.voiceLabel, isAdmin && styles.adminVoiceLabel]}>
            {voiceState === 'listening' && 'Listening…'}
            {voiceState === 'processing' && 'Thinking…'}
            {voiceState === 'speaking' && 'Interviewer speaking'}
            {voiceState === 'idle' && 'Tap to speak'}
          </Text>
          {isAdmin && (
            <View style={styles.typeFallback}>
              <Text style={[styles.typeFallbackLabel, styles.adminTypeFallbackLabel]}>
                Or type your answer (you can type while the interviewer is speaking)
              </Text>
              <TextInput
                style={[styles.typeFallbackInput, styles.adminTypeFallbackInput]}
                placeholder="Type here…"
                placeholderTextColor="#7A9ABE"
                value={typedAnswer}
                onChangeText={onSetTypedAnswer}
                editable={!inputDisabled && voiceState !== 'processing'}
                multiline
                maxLength={2000}
                {...(Platform.OS === 'web'
                  ? {
                      onPaste: () => {
                        if (!userId) return;
                        const r = getSessionLogRuntime();
                        writeSessionLog({
                          userId,
                          attemptId: r.attemptId,
                          eventType: 'copy_paste_detected',
                          eventData: { field_name: 'admin_typed_answer' },
                          platform: r.platform,
                        });
                      },
                    }
                  : {})}
                onKeyPress={(e) => {
                  const key = (e.nativeEvent?.key ?? (e as { key?: string }).key) ?? '';
                  const shiftKey =
                    (e.nativeEvent as { shiftKey?: boolean } | undefined)?.shiftKey ??
                    (e as { shiftKey?: boolean }).shiftKey ??
                    false;
                  if (key === 'Enter' && !shiftKey) {
                    (e as { preventDefault?: () => void }).preventDefault?.();
                    if (typedAnswer.trim() && !inputDisabled && voiceState !== 'processing') {
                      onSendTyped();
                    }
                  }
                }}
              />
              <Button
                title="Send"
                onPress={onSendTyped}
                disabled={inputDisabled || !typedAnswer.trim() || voiceState === 'processing'}
                variant="outline"
                style={styles.typeFallbackButton}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
