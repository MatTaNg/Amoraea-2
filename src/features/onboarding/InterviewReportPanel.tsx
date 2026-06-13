import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  INTERVIEW_REPORT_PILLAR_KEYS,
  type InterviewReportAttempt,
  readPillarScore,
} from '@features/onboarding/loadInterviewReportAttempt';
import {
  defaultPartialSummary,
  formatPillarScoreDisplay,
  psychometricContributionSummary,
  readAiReasoningString,
  readAiReasoningStringArray,
} from '@features/onboarding/interviewReportPresentation';
import { PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES } from '@features/psychometrics/assessmentContent';

const PILLAR_LABELS: Record<(typeof INTERVIEW_REPORT_PILLAR_KEYS)[number], string> = {
  repair: 'Repair',
  contempt: 'Contempt',
  attunement: 'Attunement',
  regulation: 'Regulation',
  mentalizing: 'Mentalizing',
  appreciation: 'Appreciation',
  accountability: 'Accountability',
  commitment_threshold: 'Commitment',
};

type Props = {
  attempt: InterviewReportAttempt;
  mode: 'partial' | 'full';
  isAlphaTester: boolean;
  showPsychometricSummary?: boolean;
};

function ConstructBreakdown({ ai }: { ai: Record<string, unknown> | null }) {
  const breakdown = ai?.construct_breakdown;
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  const entries = Object.entries(breakdown as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Construct breakdown</Text>
      {entries.map(([key, val]) => {
        if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
        const o = val as Record<string, unknown>;
        const growth = typeof o.growth_edge === 'string' ? o.growth_edge : null;
        const well = typeof o.what_you_did_well === 'string' ? o.what_you_did_well : null;
        return (
          <View key={key} style={styles.constructCard}>
            <Text style={styles.constructName}>{key.replace(/_/g, ' ')}</Text>
            {well ? <Text style={styles.constructBody}>{well}</Text> : null}
            {growth ? <Text style={styles.constructGrowth}>{growth}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function InterviewReportPanel({
  attempt,
  mode,
  isAlphaTester,
  showPsychometricSummary = false,
}: Props) {
  const summary = defaultPartialSummary(attempt);
  const strengths = readAiReasoningStringArray(attempt.ai_reasoning, 'overall_strengths');
  const readiness = readAiReasoningString(attempt.ai_reasoning, 'readiness_assessment');
  const showStrengths = !attempt.reasoning_pending && strengths.length > 0;
  const psychSummary =
    showPsychometricSummary && attempt.gate_result_finalized_at
      ? psychometricContributionSummary(attempt)
      : null;

  return (
    <View style={styles.root}>
      {mode === 'partial' ? (
        <>
          <Text style={styles.reportTitle}>Your partial personal report</Text>
          <Text style={styles.reportSubtitle}>Based on your AI interview — complete the self assessments to unlock your full report.</Text>
        </>
      ) : (
        <Text style={styles.reportTitle}>Your Interview Report</Text>
      )}

      {attempt.reasoning_pending && mode === 'partial' ? (
        <View style={styles.pendingRow}>
          <ActivityIndicator size="small" color="#7A9ABE" />
          <Text style={styles.pendingText}>Preparing narrative insights…</Text>
        </View>
      ) : null}

      <Text style={styles.summary}>{summary}</Text>

      <Text style={styles.sectionTitle}>Pillar scores</Text>
      <View style={styles.pillarGrid}>
        {INTERVIEW_REPORT_PILLAR_KEYS.map((key) => {
          const score = readPillarScore(attempt.pillar_scores, key);
          const pct = score != null ? Math.min(100, Math.max(0, score * 10)) : 0;
          return (
            <View key={key} style={styles.pillarCard}>
              <Text style={styles.pillarLabel}>{PILLAR_LABELS[key]}</Text>
              <View style={styles.pillarBarTrack}>
                <View style={[styles.pillarBarFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.pillarScore}>{formatPillarScoreDisplay(score)}</Text>
            </View>
          );
        })}
      </View>

      {showStrengths ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {strengths.slice(0, 3).map((s) => (
            <Text key={s} style={styles.bullet}>
              • {s}
            </Text>
          ))}
        </View>
      ) : null}

      {mode === 'partial' ? (
        <View style={styles.dividerSection}>
          <Text style={styles.dividerTitle}>Unlock your complete report</Text>
          <Text style={styles.dividerText}>
            Finish the self assessments (~{PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES} min) to add your psychological profile, compatibility insights,
            construct-by-construct analysis, and your final compatibility score.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.progressLabel}>Interview complete — self assessments remaining</Text>
        </View>
      ) : null}

      {mode === 'full' && readiness && !attempt.reasoning_pending ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Readiness</Text>
          <Text style={styles.bodyText}>{readiness}</Text>
        </View>
      ) : null}

      {mode === 'full' && !attempt.reasoning_pending ? (
        <ConstructBreakdown ai={attempt.ai_reasoning} />
      ) : null}

      {psychSummary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment contribution</Text>
          <Text style={styles.bodyText}>{psychSummary.text}</Text>
        </View>
      ) : null}

      {isAlphaTester ? (
        <View style={styles.alphaBox}>
          <Text style={styles.alphaTitle}>Alpha tester — scoring detail</Text>
          <Text style={styles.alphaLine}>weighted_score: {attempt.weighted_score ?? '—'}</Text>
          <Text style={styles.alphaLine}>
            modified_weighted_score: {attempt.modified_weighted_score ?? '—'}
          </Text>
          <Text style={styles.alphaLine}>
            modified_weighted_score_with_psychometrics:{' '}
            {attempt.modified_weighted_score_with_psychometrics ?? '—'}
          </Text>
          <Text style={styles.alphaLine}>final_gate_pass: {String(attempt.final_gate_pass)}</Text>
          <Text style={styles.alphaLine}>
            psychometric_modifier: {attempt.psychometric_modifier_applied ?? '—'} (corrected:{' '}
            {attempt.corrected_psychometric_modifier ?? '—'})
          </Text>
          <Text style={styles.alphaLine}>
            gate_fail_reasons: {(attempt.gate_fail_reasons ?? []).join(', ') || '—'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  reportTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F4F8FC',
    textAlign: 'center',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#9BB0C8',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  pendingText: { color: '#7A9ABE', fontSize: 12 },
  summary: { color: '#C8D8EC', fontSize: 15, lineHeight: 23 },
  section: { marginTop: 8, gap: 6 },
  sectionTitle: {
    color: '#9BB0CC',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillarCard: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
  },
  pillarLabel: { color: '#E8F0F8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  pillarBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  pillarBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3 },
  pillarScore: { color: '#7A9ABE', fontSize: 11 },
  bullet: { color: '#C8D8EC', fontSize: 14, lineHeight: 21 },
  dividerSection: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    backgroundColor: 'rgba(59,130,246,0.08)',
    gap: 10,
  },
  dividerTitle: {
    color: '#F4F8FC',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  dividerText: { color: '#B8C9DC', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#3b82f6' },
  progressLabel: { color: '#7A9ABE', fontSize: 11, textAlign: 'center' },
  bodyText: { color: '#C8D8EC', fontSize: 14, lineHeight: 22 },
  constructCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
  },
  constructName: { color: '#E8F0F8', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  constructBody: { color: '#C8D8EC', fontSize: 13, lineHeight: 20, marginTop: 4 },
  constructGrowth: { color: '#9BB0CC', fontSize: 12, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  alphaBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    gap: 4,
  },
  alphaTitle: { color: '#FDE68A', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  alphaLine: { color: '#FEF3C7', fontSize: 11, fontFamily: 'monospace' },
});
