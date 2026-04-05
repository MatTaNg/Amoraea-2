/**
 * Alpha-only: Analysis screen — flame orb header, score summary, feedback flow, retake.
 * Design system: #05060D, Cormorant/Jost, blues, pass/fail, inline/StyleSheet.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { UserCommunicationStyleSection } from '@ui/components/UserCommunicationStyleSection';
import { supabase } from '@data/supabase/client';
import { waitForInterviewAttemptScoringReady } from '@utilities/waitForInterviewAttemptScoringReady';
import { FlameOrb } from '@app/screens/FlameOrb';

type TranscriptMessage = { role: string; content?: string; isScoreCard?: boolean; isWaiting?: boolean; isSwitchDivider?: boolean };

function buildTranscriptString(messages: TranscriptMessage[] | null): string {
  if (!messages || messages.length === 0) return 'No transcript available.';
  return messages
    .filter(
      (m) =>
        m.role !== 'error' &&
        !(m as { isWaiting?: boolean }).isWaiting &&
        !(m as { isSwitchDivider?: boolean }).isSwitchDivider &&
        !(m as { isScoreCard?: boolean }).isScoreCard &&
        (m.content?.trim() ?? '').length > 0
    )
    .map((m) => {
      const speaker = m.role === 'assistant' ? 'Amoraea' : 'You';
      return `${speaker}: ${(m.content ?? '').trim()}`;
    })
    .join('\n\n');
}

const CONSTRUCTS = [
  { key: 'mentalizing', label: 'Mentalizing', pillarId: 'mentalizing' },
  { key: 'accountability', label: 'Accountability / Defensiveness', pillarId: 'accountability' },
  { key: 'contempt', label: 'Contempt / Criticism', pillarId: 'contempt' },
  { key: 'repair', label: 'Repair', pillarId: 'repair' },
  { key: 'regulation', label: 'Emotional Regulation', pillarId: 'regulation' },
  { key: 'attunement', label: 'Attunement', pillarId: 'attunement' },
  { key: 'appreciation', label: 'Appreciation', pillarId: 'appreciation' },
  { key: 'commitment_threshold', label: 'Commitment Threshold', pillarId: 'commitment_threshold' },
] as const;

type AttemptRow = {
  id: string;
  user_id?: string;
  weighted_score: number | null;
  passed: boolean | null;
  pillar_scores: Record<string, number> | null;
  ai_reasoning: Record<string, unknown> | null;
  transcript: TranscriptMessage[] | null;
};

// —— Feedback flow (4 steps) ——

const FEEDBACK_STEPS: Array<{
  id: string;
  title: string;
  question?: string;
  hint?: string;
  isMulti?: boolean;
  questions?: Array<{ id: string; question: string; hint: string }>;
}> = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    question: 'How accurately did the interview measure your relationship effectiveness?',
    hint: '1 = Not at all accurate  ·  7 = Completely accurate',
  },
  {
    id: 'human',
    title: 'Human Feel',
    question: 'How human did the interview feel?',
    hint: '1 = Very robotic  ·  7 = Felt like a real conversation',
  },
  {
    id: 'safety',
    title: 'Emotional Safety',
    question: 'How safe did you feel being honest during the interview?',
    hint: '1 = Not safe at all  ·  7 = Completely safe to be honest',
  },
  {
    id: 'multi',
    title: 'Final Questions',
    isMulti: true,
    questions: [
      { id: 'experience', question: 'Overall experience of the interview process', hint: '1 = Very poor  ·  7 = Excellent' },
      { id: 'fairness', question: 'How fairly did the score reflect your actual patterns?', hint: '1 = Very unfair  ·  7 = Very fair' },
      { id: 'surprise', question: 'How surprising were your results?', hint: '1 = Not surprising  ·  7 = Very surprising' },
    ],
  },
];

function FeedbackQuestion({
  question,
  hint,
  value,
  comment,
  onRate,
  onComment,
  compact = false,
}: {
  question: string;
  hint: string;
  value: number | undefined;
  comment: string | undefined;
  onRate: (v: number) => void;
  onComment: (t: string) => void;
  compact?: boolean;
}) {
  return (
    <View>
      <Text style={[styles.feedbackQuestion, compact && styles.feedbackQuestionCompact]}>{question}</Text>
      <Text style={styles.feedbackHint}>{hint}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onRate(n)}
            style={[
              styles.ratingDot,
              value === n && styles.ratingDotSelected,
            ]}
          >
            <Text style={[styles.ratingDotText, value === n && styles.ratingDotTextSelected]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!compact && (
        <TextInput
          placeholder="Add more if you'd like... (optional)"
          placeholderTextColor="#3D5470"
          value={comment ?? ''}
          onChangeText={onComment}
          multiline
          numberOfLines={3}
          style={styles.feedbackCommentInput}
        />
      )}
    </View>
  );
}

function FeedbackFlow({
  attemptId,
  onComplete,
}: {
  attemptId: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentStep = FEEDBACK_STEPS[step];
  const isLastStep = step === FEEDBACK_STEPS.length - 1;
  const progress = (step + 1) / FEEDBACK_STEPS.length;

  const canAdvance = currentStep.isMulti
    ? (currentStep.questions ?? []).every((q) => ratings[q.id] != null)
    : ratings[currentStep.id] != null;

  const handleNext = async () => {
    if (isLastStep) {
      setSubmitting(true);
      await supabase
        .from('interview_attempts')
        .update({
          feedback_accuracy: ratings.accuracy,
          feedback_human: ratings.human,
          feedback_safety: ratings.safety,
          feedback_experience: ratings.experience,
          feedback_fairness: ratings.fairness,
          feedback_surprise: ratings.surprise,
          feedback_comments: Object.keys(comments).length ? comments : null,
          feedback_submitted_at: new Date().toISOString(),
        })
        .eq('id', attemptId);
      setSubmitting(false);
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <View style={styles.feedbackRoot}>
      <View style={styles.feedbackProgressBg}>
        <View style={[styles.feedbackProgressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.feedbackStepLabel}>
        {step + 1} of {FEEDBACK_STEPS.length}  ·  {currentStep.title}
      </Text>

      {!currentStep.isMulti && currentStep.question != null && currentStep.hint != null && (
        <FeedbackQuestion
          question={currentStep.question}
          hint={currentStep.hint}
          value={ratings[currentStep.id]}
          comment={comments[currentStep.id]}
          onRate={(v) => setRatings((prev) => ({ ...prev, [currentStep.id]: v }))}
          onComment={(t) => setComments((prev) => ({ ...prev, [currentStep.id]: t }))}
        />
      )}

      {currentStep.isMulti && (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.feedbackMultiScroll}>
          {(currentStep.questions ?? []).map((q) => (
            <View key={q.id} style={styles.feedbackMultiItem}>
              <FeedbackQuestion
                question={q.question}
                hint={q.hint}
                value={ratings[q.id]}
                comment={comments[q.id]}
                onRate={(v) => setRatings((prev) => ({ ...prev, [q.id]: v }))}
                onComment={(t) => setComments((prev) => ({ ...prev, [q.id]: t }))}
                compact
              />
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.feedbackNav}>
        {step > 0 ? (
          <TouchableOpacity onPress={() => setStep(step - 1)}>
            <Text style={styles.feedbackNavBack}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onComplete}>
            <Text style={styles.feedbackNavBack}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canAdvance || submitting}
          style={[styles.feedbackNavNext, canAdvance && styles.feedbackNavNextActive]}
        >
          <Text style={[styles.feedbackNavNextText, canAdvance && styles.feedbackNavNextTextActive]}>
            {submitting ? 'Saving...' : isLastStep ? 'Submit' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// —— Loading state ——

function LoadingState() {
  return (
    <SafeAreaContainer>
      <View style={styles.loadingRoot}>
        <Text style={styles.loadingTitle}>Preparing your analysis...</Text>
        <Text style={styles.loadingSub}>This may take a moment</Text>
      </View>
    </SafeAreaContainer>
  );
}

// —— Main analysis screen ——

export function InterviewAnalysisScreen({
  attemptId,
  onRetake,
  isAdmin,
  alphaMode = true,
}: {
  attemptId: string | null;
  onRetake: () => void;
  isAdmin?: boolean;
  alphaMode?: boolean;
}) {
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStartOverFallback, setShowStartOverFallback] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!attemptId) {
      setLoading(false);
      const t = setTimeout(() => setShowStartOverFallback(true), 90000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      await waitForInterviewAttemptScoringReady(supabase, attemptId, {
        maxMs: 600_000,
        intervalMs: 500,
      });
      if (cancelled) return;
      const { data, error } = await supabase
        .from('interview_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (!cancelled && !error && data) setAttempt(data as AttemptRow);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  const handleCopyTranscript = async () => {
    const transcriptString = buildTranscriptString(attempt?.transcript ?? null);
    try {
      await Clipboard.setStringAsync(transcriptString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(transcriptString);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch {
        // ignore
      }
    }
  };

  if (!attemptId) {
    return (
      <SafeAreaContainer>
        <View style={styles.loadingRoot}>
          <Text style={styles.loadingTitle}>Preparing your analysis...</Text>
          <Text style={styles.loadingSub}>
            {showStartOverFallback
              ? 'Taking longer than expected. You can start over if needed.'
              : 'This may take a moment'}
          </Text>
          {showStartOverFallback && (
            <TouchableOpacity onPress={onRetake} style={styles.startOverBtn}>
              <Text style={styles.startOverBtnText}>Start over →</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaContainer>
    );
  }

  if (loading) return <LoadingState />;

  if (showFeedback) {
    return (
      <SafeAreaContainer>
        <FeedbackFlow attemptId={attemptId} onComplete={() => setShowFeedback(false)} />
      </SafeAreaContainer>
    );
  }

  const r = attempt?.ai_reasoning as Record<string, unknown> | undefined;
  const scores = attempt?.pillar_scores ?? {};
  const passed = attempt?.passed ?? false;
  const weightedScore = attempt?.weighted_score ?? null;

  return (
    <SafeAreaContainer>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: flame orb, badge, overall score */}
        <View style={styles.header}>
          <FlameOrb state="idle" size={100} />
          <View
            style={[
              styles.badge,
              passed ? styles.badgePass : styles.badgeFail,
            ]}
          >
            <Text style={[styles.badgeText, passed ? styles.badgeTextPass : styles.badgeTextFail]}>
              {passed ? '● Passed' : '● Not yet'}
            </Text>
          </View>
          <Text style={styles.scoreBig}>
            {weightedScore != null ? Number(weightedScore).toFixed(1) : '—'}
          </Text>
          <Text style={styles.scoreLabel}>Overall Score</Text>
        </View>

        {/* Incomplete scoring note — when not all three scenarios were scored */}
        {alphaMode && (() => {
          const a = attempt as { scenario_1_scores?: unknown; scenario_2_scores?: unknown; scenario_3_scores?: unknown } | null | undefined;
          const scoringComplete = a?.scenario_1_scores != null && a?.scenario_2_scores != null && a?.scenario_3_scores != null;
          return !scoringComplete ? (
            <View style={styles.incompleteScoringNote}>
              <Text style={styles.incompleteScoringNoteText}>
                Note: Some constructs were assessed from fewer than three scenarios. Your scores may be less precise than usual.
              </Text>
            </View>
          ) : null;
        })()}

        {/* Score summary — Alpha only */}
        {alphaMode && (
          <View style={styles.summaryBlock}>
            {r?.overall_summary && (
              <View style={styles.overallSummaryCard}>
                <Text style={styles.overallSummaryText}>
                  "{String(r.overall_summary)}"
                </Text>
              </View>
            )}

            {CONSTRUCTS.map((c) => {
              const raw = scores[c.pillarId];
              const score = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
              const breakdown = (r?.construct_breakdown as Record<string, { headline?: string; summary?: string }> | undefined)?.[c.key];
              const unassessedScore = score === undefined || score === 0;
              const scorePct = unassessedScore ? 0 : (score / 10) * 100;
              return (
                <View key={c.key} style={styles.constructCard}>
                  <View style={styles.constructCardHeader}>
                    <View style={styles.constructCardHeaderLeft}>
                      <Text style={styles.constructCardTitle}>{c.label}</Text>
                      {breakdown?.headline && (
                        <Text style={styles.constructCardHeadline}>{breakdown.headline}</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.constructCardScore,
                        !unassessedScore && score >= 7 && styles.constructScoreHigh,
                        !unassessedScore && score >= 5 && score < 7 && styles.constructScoreMid,
                        !unassessedScore && score < 5 && styles.constructScoreLow,
                        unassessedScore && styles.constructScoreUnassessed,
                      ]}
                    >
                      {unassessedScore ? '—' : score.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.scoreBarBg}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${scorePct}%` },
                        !unassessedScore && score >= 7 && styles.scoreBarFillHigh,
                        !unassessedScore && score >= 5 && score < 7 && styles.scoreBarFillMid,
                        !unassessedScore && score < 5 && styles.scoreBarFillLow,
                        unassessedScore && styles.scoreBarFillUnassessed,
                      ]}
                    />
                  </View>
                  {breakdown?.summary ? (
                    <Text style={styles.constructCardSummary}>{breakdown.summary}</Text>
                  ) : unassessedScore ? (
                    <Text style={styles.constructCardSummaryMuted}>
                      This construct was not directly assessed in this interview. A missing or zero score means there was not enough scored evidence — not a demonstrated weakness.
                    </Text>
                  ) : null}
                </View>
              );
            })}

            <UserCommunicationStyleSection userId={attempt?.user_id} />

            {r?.closing_reflection && (
              <View style={styles.fullReasoningBlock}>
                <TouchableOpacity
                  onPress={() => setReasoningExpanded(!reasoningExpanded)}
                  style={styles.fullReasoningToggle}
                >
                  <Text style={styles.fullReasoningToggleText}>
                    {reasoningExpanded ? 'Hide Full Analysis ↑' : 'Read Full Analysis ↓'}
                  </Text>
                </TouchableOpacity>
                {reasoningExpanded && (
                  <View style={styles.fullReasoningContent}>
                    {[
                      { label: 'Cross-Scenario Patterns', content: r.cross_scenario_patterns },
                      { label: 'What a Partner Would Experience', content: r.what_a_partner_would_experience },
                      { label: 'Closing Reflection', content: r.closing_reflection, italic: true },
                    ]
                      .filter((f) => f.content)
                      .map((field, i) => (
                        <View key={i} style={styles.fullReasoningField}>
                          <Text style={styles.fullReasoningFieldLabel}>{field.label}</Text>
                          <Text
                            style={[
                              field.italic ? styles.fullReasoningFieldItalic : styles.fullReasoningFieldBody,
                            ]}
                          >
                            {field.italic ? `"${String(field.content)}"` : String(field.content)}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* View Full Transcript (collapsed by default) */}
        <View style={styles.transcriptContainer}>
          <TouchableOpacity
            onPress={() => setShowTranscript((prev) => !prev)}
            style={styles.transcriptToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.transcriptToggleLabel}>
              {showTranscript ? 'Hide Transcript' : 'View Full Transcript'}
            </Text>
            <Text style={styles.transcriptChevron}>{showTranscript ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showTranscript && (
            <View style={styles.transcriptBody}>
              {(attempt?.transcript ?? [])
                .filter(
                  (m) =>
                    (m.content?.trim() ?? '').length > 0 &&
                    !(m as { isWaiting?: boolean }).isWaiting &&
                    !(m as { isSystem?: boolean }).isSystem
                )
                .map((message, index) => (
                  <View
                    key={index}
                    style={[
                      styles.transcriptMessageRow,
                      message.role === 'user' ? styles.transcriptUserMessage : styles.transcriptAiraMessage,
                    ]}
                  >
                    <Text style={styles.transcriptSpeakerLabel}>
                      {message.role === 'user' ? 'You' : 'Amoraea'}
                    </Text>
                    <Text style={styles.transcriptMessageText}>{message.content}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Copy transcript */}
        <View style={styles.copyBlock}>
          <TouchableOpacity onPress={handleCopyTranscript} style={styles.copyBtn} activeOpacity={0.7}>
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextCopied]}>
              {copied ? '✓ Copied' : 'Copy Transcript'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions: Feedback, Retake */}
        <View style={styles.actionsBlock}>
          <TouchableOpacity onPress={() => setShowFeedback(true)} style={styles.feedbackBtn}>
            <Text style={styles.feedbackBtnText}>Leave Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRetake} style={styles.retakeBtn}>
            <Text style={styles.retakeBtnText}>Retake Interview</Text>
            <Text style={styles.retakeBtnSub}>Your previous results are saved</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#05060D' },
  scrollContent: { paddingBottom: 60 },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#05060D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontFamily: 'Cormorant_300Light',
    fontSize: 22,
    color: '#C8E4FF',
    marginBottom: 8,
  },
  loadingSub: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  startOverBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.4)',
    borderRadius: 8,
  },
  startOverBtnText: {
    fontFamily: 'Jost_300Light',
    fontSize: 14,
    color: '#5BA8E8',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
  },
  badge: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgePass: {
    borderColor: 'rgba(42,140,106,0.4)',
    backgroundColor: 'rgba(42,140,106,0.08)',
  },
  badgeFail: {
    borderColor: 'rgba(232,122,122,0.4)',
    backgroundColor: 'rgba(232,122,122,0.08)',
  },
  badgeText: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  badgeTextPass: { color: '#2A8C6A' },
  badgeTextFail: { color: '#E87A7A' },
  scoreBig: {
    fontFamily: 'Cormorant_300Light',
    fontSize: 72,
    fontWeight: '300',
    color: '#C8E4FF',
    marginTop: 16,
    lineHeight: 72,
  },
  scoreLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginTop: 4,
  },
  incompleteScoringNote: {
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    marginHorizontal: 24,
  },
  incompleteScoringNoteText: {
    fontFamily: 'Jost_300Light',
    fontSize: 12,
    fontWeight: '300',
    color: '#C9A96E',
    letterSpacing: 0.5,
  },
  summaryBlock: { paddingHorizontal: 24 },
  overallSummaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(13,17,32,0.6)',
  },
  overallSummaryText: {
    fontFamily: 'Cormorant_300Light_Italic',
    fontSize: 17,
    fontStyle: 'italic',
    color: '#C8E4FF',
    lineHeight: 26,
  },
  constructCard: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  constructCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingRight: 20,
  },
  constructCardHeaderLeft: {
    flex: 1,
    paddingRight: 12,
    minWidth: 0,
  },
  constructCardTitle: {
    fontFamily: 'Cormorant_400Regular',
    fontSize: 18,
    color: '#E8F0F8',
  },
  constructCardHeadline: {
    fontFamily: 'Jost_300Light',
    fontSize: 11,
    color: '#7A9ABE',
    marginTop: 2,
    fontStyle: 'italic',
  },
  constructCardScore: {
    fontFamily: 'Cormorant_300Light',
    fontSize: 28,
    color: '#C8E4FF',
    minWidth: 44,
    textAlign: 'right',
    flexShrink: 0,
  },
  constructScoreHigh: { color: '#C8E4FF' },
  constructScoreMid: { color: '#7A9ABE' },
  constructScoreLow: { color: '#E87A7A' },
  constructScoreUnassessed: { color: '#5C6B7E', fontSize: 22 },
  scoreBarBg: {
    height: 2,
    backgroundColor: 'rgba(82,142,220,0.08)',
    marginHorizontal: 16,
  },
  scoreBarFill: {
    height: 2,
    backgroundColor: '#1E6FD9',
  },
  scoreBarFillHigh: { backgroundColor: '#1E6FD9' },
  scoreBarFillMid: { backgroundColor: '#7A9ABE' },
  scoreBarFillLow: { backgroundColor: '#E87A7A' },
  scoreBarFillUnassessed: { backgroundColor: 'rgba(92,107,126,0.35)' },
  constructCardSummary: {
    fontFamily: 'Jost_300Light',
    fontSize: 13,
    color: '#7A9ABE',
    lineHeight: 20,
    padding: 16,
    paddingTop: 12,
  },
  constructCardSummaryMuted: {
    fontFamily: 'Jost_300Light',
    fontSize: 12,
    color: '#5C6B7E',
    lineHeight: 18,
    padding: 16,
    paddingTop: 12,
    fontStyle: 'italic',
  },
  fullReasoningBlock: { marginBottom: 24 },
  fullReasoningToggle: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  fullReasoningToggleText: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  fullReasoningContent: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 12,
    padding: 20,
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  fullReasoningField: { marginBottom: 20 },
  fullReasoningFieldLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 8,
  },
  fullReasoningFieldBody: {
    fontFamily: 'Jost_300Light',
    fontSize: 13,
    color: '#7A9ABE',
    lineHeight: 20,
  },
  fullReasoningFieldItalic: {
    fontFamily: 'Cormorant_300Light_Italic',
    fontSize: 16,
    fontStyle: 'italic',
    color: '#C8E4FF',
    lineHeight: 24,
  },
  transcriptContainer: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.1)',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  transcriptToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  transcriptToggleLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  transcriptChevron: {
    fontFamily: 'Jost_300Light',
    fontSize: 11,
    color: '#3D5470',
  },
  transcriptBody: {
    marginTop: 16,
  },
  transcriptMessageRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    maxWidth: '90%',
  },
  transcriptAiraMessage: {
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    alignSelf: 'flex-start',
  },
  transcriptUserMessage: {
    backgroundColor: 'rgba(30,111,217,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(30,111,217,0.15)',
    alignSelf: 'flex-end',
  },
  transcriptSpeakerLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 6,
  },
  transcriptMessageText: {
    fontFamily: 'Jost_300Light',
    fontSize: 14,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 22,
  },
  copyBlock: { paddingHorizontal: 24, marginTop: 8 },
  copyBtn: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  copyBtnText: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  copyBtnTextCopied: { color: '#2A8C6A' },
  actionsBlock: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  feedbackBtn: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.3)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(30,111,217,0.08)',
    marginBottom: 12,
  },
  feedbackBtnText: {
    fontFamily: 'Jost_300Light',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  retakeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  retakeBtnText: {
    fontFamily: 'Jost_300Light',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  retakeBtnSub: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    color: '#3D5470',
    marginTop: 4,
    opacity: 0.6,
  },
  // Feedback flow
  feedbackRoot: {
    flex: 1,
    backgroundColor: '#05060D',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  feedbackProgressBg: {
    height: 1,
    backgroundColor: 'rgba(82,142,220,0.1)',
    borderRadius: 1,
    marginBottom: 40,
  },
  feedbackProgressFill: {
    height: 1,
    backgroundColor: '#1E6FD9',
    borderRadius: 1,
  },
  feedbackStepLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 9,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 16,
  },
  feedbackQuestion: {
    fontFamily: 'Cormorant_300Light',
    fontSize: 24,
    fontWeight: '300',
    color: '#E8F0F8',
    lineHeight: 32,
    marginBottom: 8,
  },
  feedbackQuestionCompact: {
    fontSize: 18,
    lineHeight: 24,
  },
  feedbackHint: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    color: '#3D5470',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  ratingDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingDotSelected: {
    borderColor: '#1E6FD9',
    backgroundColor: 'rgba(30,111,217,0.2)',
  },
  ratingDotText: {
    fontFamily: 'Cormorant_300Light',
    fontSize: 16,
    color: '#3D5470',
  },
  ratingDotTextSelected: { color: '#C8E4FF' },
  feedbackCommentInput: {
    fontFamily: 'Jost_300Light',
    fontSize: 13,
    color: '#E8F0F8',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 8,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  feedbackMultiScroll: { maxHeight: 400 },
  feedbackMultiItem: { marginBottom: 32 },
  feedbackNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 'auto',
  },
  feedbackNavBack: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  feedbackNavNext: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
  },
  feedbackNavNextActive: {
    backgroundColor: 'rgba(30,111,217,0.15)',
    borderColor: 'rgba(82,142,220,0.4)',
  },
  feedbackNavNextText: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  feedbackNavNextTextActive: { color: '#5BA8E8' },
});
