/**
 * Alpha-only: User analysis page — full assessment with AI reasoning,
 * overall and per-construct ratings, and retake. Remove before production.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { supabase } from '@data/supabase/client';

const CONSTRUCTS = [
  { key: 'conflict_repair', label: 'Conflict & Repair', pillarId: '1' },
  { key: 'accountability', label: 'Accountability', pillarId: '3' },
  { key: 'responsiveness', label: 'Responsiveness', pillarId: '5' },
  { key: 'desire_limits', label: 'Desire & Limits', pillarId: '6' },
] as const;

type AttemptRow = {
  id: string;
  weighted_score: number | null;
  passed: boolean | null;
  pillar_scores: Record<string, number> | null;
  ai_reasoning: Record<string, unknown> | null;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function ReasoningBlock({
  label,
  children,
  gold,
}: {
  label: string;
  children: string | undefined;
  gold?: boolean;
}) {
  if (!children) return null;
  return (
    <View style={styles.reasoningBlock}>
      <Text style={[styles.reasoningLabel, gold && styles.reasoningLabelGold]}>{label}</Text>
      <Text style={styles.reasoningText}>{children}</Text>
    </View>
  );
}

function StarRating({
  value,
  onChange,
  large,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  large?: boolean;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.star, large && styles.starLarge, n <= (value ?? 0) && styles.starFilled]}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RetakeButton({ onRetake }: { onRetake: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Pressable onPress={() => setConfirming(true)} style={styles.retakeButton}>
        <Text style={styles.retakeButtonText}>Retake Interview</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.retakeConfirm}>
      <Text style={styles.retakeConfirmText}>
        Your current results will be preserved. This starts a new attempt.
      </Text>
      <View style={styles.retakeConfirmRow}>
        <Pressable onPress={() => setConfirming(false)} style={styles.retakeCancel}>
          <Text style={styles.retakeCancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onRetake} style={styles.retakeStart}>
          <Text style={styles.retakeStartText}>Start New Attempt →</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function InterviewAnalysisScreen({
  attemptId,
  onRetake,
}: {
  attemptId: string;
  onRetake: () => void;
}) {
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<{ overall?: number }>({});
  const [constructRatings, setConstructRatings] = useState<
    Record<string, { rating?: number; comment?: string }>
  >({});
  const [overallComment, setOverallComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('interview_attempts')
        .select('id, weighted_score, passed, pillar_scores, ai_reasoning')
        .eq('id', attemptId)
        .single();
      if (!cancelled && !error && data) setAttempt(data as AttemptRow);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const handleConstructRating = (constructKey: string, field: 'rating' | 'comment', value: number | string) => {
    setConstructRatings((prev) => ({
      ...prev,
      [constructKey]: { ...prev[constructKey], [field]: value },
    }));
  };

  const handleSubmitFeedback = async () => {
    setSaving(true);
    await supabase
      .from('interview_attempts')
      .update({
        user_analysis_rating: ratings.overall,
        user_analysis_comment: overallComment || null,
        user_analysis_submitted_at: new Date().toISOString(),
        per_construct_ratings: constructRatings,
      })
      .eq('id', attemptId);
    setSaving(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <SafeAreaContainer>
        <View style={styles.loadingRoot}>
          <Text style={styles.loadingTitle}>Preparing your analysis...</Text>
          <Text style={styles.loadingSub}>This may take a moment</Text>
        </View>
      </SafeAreaContainer>
    );
  }

  const r = attempt?.ai_reasoning as Record<string, unknown> | undefined;
  const reasoningFailed = r?._generationFailed === true;
  const scores = attempt?.pillar_scores ?? {};
  const overallSummary = (r?.overall_summary as string) ?? '';
  const overallStrengths = (r?.overall_strengths as string[]) ?? [];
  const overallGrowthAreas = (r?.overall_growth_areas as string[]) ?? [];
  const constructBreakdown = (r?.construct_breakdown as Record<string, Record<string, unknown>>) ?? {};
  const scenarioObservations = (r?.scenario_observations as Record<string, { name?: string; what_happened?: string; standout_moments?: string[]; what_it_revealed?: string }>) ?? {};
  const consistencyNote = r?.consistency_note as string | undefined;
  const crossScenarioPatterns = r?.cross_scenario_patterns as string | undefined;
  const languageStyle = r?.language_and_style_observations as string | undefined;
  const partnerExperience = r?.what_a_partner_would_experience as string | undefined;
  const readinessAssessment = r?.readiness_assessment as string | undefined;
  const closingReflection = r?.closing_reflection as string | undefined;

  return (
    <SafeAreaContainer>
      <View style={styles.alphaBadge}>
        <Text style={styles.alphaBadgeText}>
          ◆ Alpha — This analysis is shown to help improve the assessment
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {reasoningFailed && (
          <View style={styles.reasoningFailedBanner}>
            <Text style={styles.reasoningFailedText}>
              The detailed analysis is still being prepared. Check back shortly — your scores and transcript have been saved.
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.headerLabel}>Your Assessment</Text>
          <Text style={styles.scoreBig}>
            {attempt?.weighted_score != null ? Number(attempt.weighted_score).toFixed(1) : '—'} / 10
          </Text>
          <Text
            style={[
              styles.passLabel,
              attempt?.passed ? styles.passLabelPass : styles.passLabelFail,
            ]}
          >
            {attempt?.passed ? '● Passed' : '● Needs Work'}
          </Text>
        </View>

        <Section title="How You Show Up">
          <Text style={styles.overallSummary}>"{overallSummary}"</Text>
        </Section>

        <View style={styles.twoCol}>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Strengths</Text>
            {overallStrengths.map((s, i) => (
              <View key={i} style={styles.strengthItem}>
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Growth Areas</Text>
            {overallGrowthAreas.map((s, i) => (
              <View key={i} style={styles.growthItem}>
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <Section title="The Four Constructs">
          {CONSTRUCTS.map(({ key, label, pillarId }) => {
            const data = constructBreakdown[key];
            const score = scores[pillarId] ?? (data?.score as number);
            const cRating = constructRatings[key];
            return (
              <View key={key} style={styles.constructBlock}>
                <View style={styles.constructHeader}>
                  <View>
                    <Text style={styles.constructTitle}>{label}</Text>
                    <Text style={styles.constructHeadline} numberOfLines={2}>
                      {(data?.headline as string) ?? ''}
                    </Text>
                  </View>
                  <View style={styles.constructScoreWrap}>
                    <Text style={styles.constructScore}>{score != null ? Number(score).toFixed(1) : '—'}</Text>
                    <Text style={styles.constructScoreLabel}>/ 10</Text>
                  </View>
                </View>
                <View style={styles.scoreBarBg}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      { width: Math.min(100, (Number(score) || 0) * 10) + '%' },
                    ]}
                  />
                </View>
                <ReasoningBlock label="Summary" children={data?.summary as string} />
                <ReasoningBlock label="What you did well" children={data?.what_you_did_well as string} />
                <ReasoningBlock label="Where you struggled" children={data?.where_you_struggled as string} />
                <ReasoningBlock label="Core pattern" children={data?.key_pattern as string} gold />
                <ReasoningBlock label="Nuance & Context" children={data?.nuance_and_context as string} />
                <ReasoningBlock label="Growth Edge" children={data?.growth_edge as string} />
                {!submitted && (
                  <View style={styles.constructFeedback}>
                    <Text style={styles.sectionLabel}>How accurate does this feel?</Text>
                    <StarRating
                      value={cRating?.rating}
                      onChange={(v) => handleConstructRating(key, 'rating', v)}
                    />
                    <TextInput
                      placeholder="Add a comment (optional)..."
                      placeholderTextColor="#3D5470"
                      value={cRating?.comment ?? ''}
                      onChangeText={(t) => handleConstructRating(key, 'comment', t)}
                      style={styles.textarea}
                      multiline
                    />
                  </View>
                )}
                {submitted && cRating?.rating != null && (
                  <Text style={styles.submittedRating}>
                    Your rating: {'★'.repeat(cRating.rating)}{'☆'.repeat(5 - cRating.rating)}
                    {cRating.comment ? ` — "${cRating.comment}"` : ''}
                  </Text>
                )}
              </View>
            );
          })}
        </Section>

        <Section title="Moments That Stood Out">
          {[1, 2, 3].map((n) => {
            const obs = scenarioObservations[`scenario_${n}`];
            if (!obs) return null;
            return (
              <View key={n} style={styles.scenarioCard}>
                <Text style={styles.scenarioCardLabel}>
                  Situation {n} — {obs.name ?? `Scenario ${n}`}
                </Text>
                <ReasoningBlock label="What Happened" children={obs.what_happened} />
                {obs.standout_moments?.map((moment, mi) => (
                  <Text key={mi} style={styles.standoutMoment}>
                    {moment}
                  </Text>
                ))}
                <ReasoningBlock label="What It Revealed" children={obs.what_it_revealed} />
              </View>
            );
          })}
        </Section>

        {consistencyNote ? (
          <Section title="Consistency Across Situations">
            <Text style={styles.bodyText}>{consistencyNote}</Text>
          </Section>
        ) : null}
        {crossScenarioPatterns ? (
          <Section title="Patterns Across All Three Situations">
            <Text style={styles.bodyText}>{crossScenarioPatterns}</Text>
          </Section>
        ) : null}
        {languageStyle ? (
          <Section title="How You Communicate">
            <Text style={styles.bodyText}>{languageStyle}</Text>
          </Section>
        ) : null}
        {partnerExperience ? (
          <Section title="What a Partner Would Experience">
            <Text style={styles.bodyText}>{partnerExperience}</Text>
          </Section>
        ) : null}
        {readinessAssessment ? (
          <Section title="Readiness for Intimacy">
            <Text style={styles.bodyText}>{readinessAssessment}</Text>
          </Section>
        ) : null}
        <Section title="A Closing Reflection">
          <Text style={styles.closingReflection}>"{closingReflection}"</Text>
        </Section>

        {!submitted ? (
          <Section title="How Accurate Was This Overall?">
            <Text style={styles.feedbackHint}>
              Your feedback helps us calibrate the assessment. Be honest — including if you disagree.
            </Text>
            <StarRating
              value={ratings.overall}
              onChange={(v) => setRatings((prev) => ({ ...prev, overall: v }))}
              large
            />
            <TextInput
              placeholder="What felt accurate? What didn't? Any context we should know?"
              placeholderTextColor="#3D5470"
              value={overallComment}
              onChangeText={setOverallComment}
              style={[styles.textarea, styles.textareaLarge]}
              multiline
            />
            <Pressable
              onPress={handleSubmitFeedback}
              disabled={ratings.overall == null || saving}
              style={[styles.submitButton, ratings.overall != null && styles.submitButtonActive]}
            >
              <Text
                style={[
                  styles.submitButtonText,
                  ratings.overall != null && styles.submitButtonTextActive,
                ]}
              >
                {saving ? 'Saving...' : 'Submit Feedback →'}
              </Text>
            </Pressable>
          </Section>
        ) : (
          <View style={styles.thankYou}>
            <Text style={styles.thankYouTitle}>Thank you for your honesty.</Text>
            <Text style={styles.thankYouSub}>Your feedback helps us build something more true.</Text>
          </View>
        )}

        <View style={styles.retakeSection}>
          <Text style={styles.retakeSectionLabel}>◆ Alpha Feature</Text>
          <Text style={styles.retakeTitle}>Want to try again?</Text>
          <Text style={styles.retakeSub}>
            You can retake the interview as many times as you like during the Alpha. Your previous
            results are always preserved.
          </Text>
          <RetakeButton onRetake={onRetake} />
        </View>
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  alphaBadge: {
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,169,110,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  alphaBadgeText: {
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#C9A96E',
    textAlign: 'center',
  },
  scroll: { flex: 1, backgroundColor: '#05060D' },
  scrollContent: { maxWidth: 680, alignSelf: 'center', width: '100%', padding: 24, paddingBottom: 80 },
  reasoningFailedBanner: {
    backgroundColor: 'rgba(82,142,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 32,
  },
  reasoningFailedText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 22,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#05060D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '300',
    color: '#C8E4FF',
    marginBottom: 8,
  },
  loadingSub: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  header: { alignItems: 'center', marginBottom: 48 },
  headerLabel: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 12,
  },
  scoreBig: { fontSize: 36, fontWeight: '300', color: '#C8E4FF', marginBottom: 8 },
  passLabel: { fontSize: 11, fontWeight: '300', letterSpacing: 2, textTransform: 'uppercase' },
  passLabelPass: { color: '#2A8C6A' },
  passLabelFail: { color: '#E87A7A' },
  section: { marginBottom: 40 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 16,
  },
  overallSummary: {
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
    lineHeight: 28,
    color: '#C8E4FF',
  },
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 40, flexWrap: 'wrap' },
  card: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 14,
    padding: 20,
  },
  strengthItem: { marginBottom: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#1E6FD9' },
  growthItem: { marginBottom: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: 'rgba(82,142,220,0.3)' },
  bulletText: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', lineHeight: 22 },
  constructBlock: {
    marginBottom: 32,
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.1)',
  },
  constructHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  constructTitle: { fontSize: 20, fontWeight: '400', color: '#E8F0F8', marginBottom: 4 },
  constructHeadline: { fontSize: 12, fontWeight: '300', color: '#7A9ABE', fontStyle: 'italic', flex: 1 },
  constructScoreWrap: { alignItems: 'flex-end' },
  constructScore: { fontSize: 28, fontWeight: '300', color: '#C8E4FF' },
  constructScoreLabel: { fontSize: 9, color: '#3D5470', letterSpacing: 1 },
  scoreBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#5BA8E8',
    borderRadius: 2,
  },
  reasoningBlock: { marginBottom: 14, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(82,142,220,0.3)' },
  reasoningLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 4,
  },
  reasoningLabelGold: { color: '#C9A96E' },
  reasoningText: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', lineHeight: 22 },
  constructFeedback: {
    marginTop: 20,
    backgroundColor: 'rgba(30,111,217,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    padding: 16,
  },
  textarea: {
    padding: 12,
    marginTop: 8,
    backgroundColor: 'rgba(5,6,13,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: '300',
    color: '#E8F0F8',
    minHeight: 72,
    lineHeight: 20,
  },
  textareaLarge: { minHeight: 100 },
  submittedRating: { fontSize: 11, color: '#3D5470', marginTop: 12 },
  scenarioCard: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 12,
  },
  scenarioCardLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 10,
  },
  standoutMoment: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#C8E4FF',
    lineHeight: 24,
    marginBottom: 10,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200,228,255,0.2)',
  },
  bodyText: { fontSize: 14, fontWeight: '300', color: '#7A9ABE', lineHeight: 24 },
  closingReflection: {
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
    lineHeight: 28,
    color: '#C8E4FF',
  },
  feedbackHint: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', marginBottom: 16, lineHeight: 22 },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  star: { fontSize: 20, color: '#3D5470' },
  starLarge: { fontSize: 28 },
  starFilled: { color: '#C8E4FF' },
  submitButton: {
    width: '100%',
    padding: 15,
    marginTop: 8,
    backgroundColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonActive: {
    backgroundColor: '#1E6FD9',
  },
  submitButtonText: { fontSize: 11, fontWeight: '400', letterSpacing: 2.5, textTransform: 'uppercase', color: '#3D5470' },
  submitButtonTextActive: { color: '#EEF6FF' },
  thankYou: { alignItems: 'center', paddingVertical: 32, borderTopWidth: 1, borderTopColor: 'rgba(82,142,220,0.1)' },
  thankYouTitle: { fontSize: 22, fontWeight: '300', color: '#C8E4FF', marginBottom: 8 },
  thankYouSub: { fontSize: 13, fontWeight: '300', color: '#7A9ABE' },
  retakeSection: {
    marginTop: 48,
    padding: 24,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.08)',
    borderRadius: 14,
    alignItems: 'center',
  },
  retakeSectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 12,
  },
  retakeTitle: { fontSize: 18, fontWeight: '300', color: '#7A9ABE', marginBottom: 8 },
  retakeSub: {
    fontSize: 13,
    fontWeight: '300',
    color: '#3D5470',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  retakeButton: {
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 10,
  },
  retakeButtonText: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  retakeConfirm: { width: '100%', alignItems: 'center' },
  retakeConfirmText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7A9ABE',
    marginBottom: 16,
    textAlign: 'center',
  },
  retakeConfirmRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  retakeCancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.15)',
    borderRadius: 10,
  },
  retakeCancelText: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  retakeStart: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1E6FD9',
    borderRadius: 10,
  },
  retakeStartText: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
});
