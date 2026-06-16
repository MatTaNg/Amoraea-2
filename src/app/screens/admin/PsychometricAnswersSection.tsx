import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import {
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  GASP_EXTERNALIZATION_ITEM_IDS,
  isForcedChoiceAssessment,
  POST_INTERVIEW_ASSESSMENTS,
  POST_INTERVIEW_ASSESSMENT_ORDER,
  type AssessmentId,
  type NpiEntitlementResponse,
  type PostInterviewAssessmentId,
  type PsychometricQuestion,
  isUnfavorableLikertItemResponse,
  scoreLikertItemValue,
} from '@features/psychometrics/assessmentContent';
import {
  fetchPsychometricResponsesBundle,
  type PsychometricResponsesBundle,
} from '@features/psychometrics/psychometricsPersistence';
import type { PsychometricInstrumentImpacts } from '@app/screens/admin/AdminProfileAssessmentTabs';

type ForcedChoiceAssessmentDef = Extract<
  (typeof ASSESSMENTS)[AssessmentId],
  { format: 'forced_choice' }
>;

type LikertLikeAssessment = {
  scale: { min: number; max: number; labels: Record<number, string> };
  scoring: { reverseItems?: number[]; reverseScale?: Record<number, number> };
  questions: PsychometricQuestion[];
};

function likertReverseItems(assessment: LikertLikeAssessment): number[] {
  return assessment.scoring.reverseItems ?? [];
}

function formatQuestionPrompt(q: PsychometricQuestion): string {
  if (q.text?.trim()) return q.text.trim();
  if (q.scenario && q.response) {
    return `${q.scenario} — "${q.response}"`;
  }
  return `Item ${q.id}`;
}

function scaleLabel(
  assessment: { scale: { labels: Record<number, string> } },
  value: number,
): string {
  return assessment.scale.labels[value] ?? String(value);
}

function bundleHasResponses(bundle: PsychometricResponsesBundle): boolean {
  const preCount = ASSESSMENT_ORDER.filter((id) => {
    const map = bundle.assessments[id];
    return map != null && Object.keys(map).length > 0;
  }).length;
  const postCount = POST_INTERVIEW_ASSESSMENT_ORDER.filter((id) => {
    const map = bundle.postInterview[id];
    return map != null && Object.keys(map).length > 0;
  }).length;
  return preCount + postCount > 0;
}

function InstrumentImpactBanner({
  impact,
}: {
  impact: NonNullable<PsychometricInstrumentImpacts[string]>;
}) {
  const hasPenalty = impact.modifier < 0;
  const hasIssue = hasPenalty || impact.floorBreached || impact.straightLineDescription;

  return (
    <View style={[styles.impactBanner, hasIssue ? styles.impactBannerWarn : styles.impactBannerNeutral]}>
      {impact.aggregateScoreLabel ? (
        <Text style={styles.impactAggregate}>{impact.aggregateScoreLabel}</Text>
      ) : null}
      {hasPenalty ? (
        <Text style={styles.impactModifierNegative}>
          Score modifier: {impact.modifier.toFixed(2)} — reduced composite gate score
        </Text>
      ) : (
        <Text style={styles.impactModifierNeutral}>
          Score modifier: {impact.modifier.toFixed(2)} — no penalty from this instrument
        </Text>
      )}
      {impact.floorBreached ? (
        <Text style={styles.impactFloor}>
          ⛔ Gate fail floor — {impact.floorCode}
          {impact.floorDescription ? `\n${impact.floorDescription}` : ''}
        </Text>
      ) : null}
      {impact.straightLineDescription ? (
        <Text style={styles.impactStraightLine}>⚠ {impact.straightLineDescription}</Text>
      ) : null}
    </View>
  );
}

function ForcedChoiceInstrumentResponses({
  assessmentId,
  name,
  assessment,
  responses,
  impact,
}: {
  assessmentId: string;
  name: string;
  assessment: ForcedChoiceAssessmentDef;
  responses: Record<number, NpiEntitlementResponse>;
  impact?: PsychometricInstrumentImpacts[string];
}) {
  const answered = assessment.questions.filter((q) => responses[q.id] != null);
  if (answered.length === 0) return null;

  return (
    <View style={styles.instrumentBlock}>
      <Text style={styles.instrumentTitle}>{name}</Text>
      <Text style={styles.instrumentMeta}>
        {answered.length} of {assessment.questions.length} pairs answered
      </Text>
      {impact ? <InstrumentImpactBanner impact={impact} /> : null}
      {answered.map((q) => {
        const choice = responses[q.id]!;
        const selected = choice.selectedOptionIndex === 0 ? q.optionA : q.optionB;
        return (
          <View key={q.id} style={styles.itemRow}>
            <Text style={styles.itemLabel}>Q{q.id}</Text>
            <Text style={styles.itemQuestion}>
              A: {q.optionA}
              {'\n'}
              B: {q.optionB}
            </Text>
            <Text style={styles.itemAnswer}>
              Chose {choice.selectedOptionIndex === 0 ? 'A' : 'B'} — {selected}
            </Text>
            {choice.wasEntitlement ? (
              <Text style={styles.itemImpactNote}>
                Entitlement pole — counts toward{' '}
                {assessmentId === 'npi_entitlement' && impact?.floorBreached
                  ? 'gate fail floor and modifier review'
                  : impact?.modifier != null && impact.modifier < 0
                    ? 'composite score penalty'
                    : 'entitlement score'}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function InstrumentResponses({
  assessmentId,
  name,
  assessment,
  responses,
  impact,
}: {
  assessmentId: string;
  name: string;
  assessment: LikertLikeAssessment;
  responses: Record<number, number>;
  impact?: PsychometricInstrumentImpacts[string];
}) {
  const answered = assessment.questions.filter((q) => responses[q.id] != null);
  if (answered.length === 0) return null;

  const externalizationIds = new Set<number>(GASP_EXTERNALIZATION_ITEM_IDS as readonly number[]);

  return (
    <View style={styles.instrumentBlock}>
      <Text style={styles.instrumentTitle}>{name}</Text>
      <Text style={styles.instrumentMeta}>
        {answered.length} of {assessment.questions.length} items answered
      </Text>
      {impact ? <InstrumentImpactBanner impact={impact} /> : null}
      {answered.map((q) => {
        const raw = responses[q.id]!;
        const isReverse = likertReverseItems(assessment).includes(q.id);
        const scored = scoreLikertItemValue(assessment, q.id, raw);
        const isGaspExternalization =
          assessmentId === 'gasp' && externalizationIds.has(q.id);
        const unfavorableLikertResponse =
          impact != null &&
          (impact.modifier < 0 || impact.floorBreached) &&
          isUnfavorableLikertItemResponse(assessmentId, assessment, q.id, raw);

        return (
          <View key={q.id} style={styles.itemRow}>
            <Text style={styles.itemLabel}>
              Q{q.id}
              {q.subscale ? ` · ${q.subscale.replace(/_/g, ' ')}` : ''}
            </Text>
            <Text style={styles.itemQuestion}>{formatQuestionPrompt(q)}</Text>
            <Text style={styles.itemAnswer}>
              {raw} — {scaleLabel(assessment, raw)}
              {isReverse && scored !== raw ? ` · scored ${scored}` : ''}
            </Text>
            {unfavorableLikertResponse ? (
              <Text style={styles.itemImpactNote}>
                {isGaspExternalization
                  ? 'Externalization endorsement — contributes to '
                  : 'Endorsement at the unfavorable pole — contributes to '}
                {impact?.floorBreached ? 'floor breach and ' : ''}
                {impact?.modifier != null && impact.modifier < 0
                  ? 'score reduction'
                  : 'aggregate band'}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function PsychometricAnswersSection({
  userId,
  instrumentImpacts,
}: {
  userId: string;
  instrumentImpacts?: PsychometricInstrumentImpacts;
}) {
  const [bundle, setBundle] = useState<PsychometricResponsesBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await fetchPsychometricResponsesBundle(userId);
        if (cancelled) return;
        setBundle(data);
        setError(data == null ? 'Could not load psychometric responses.' : null);
      } catch (e) {
        if (!cancelled) {
          setBundle(null);
          setError(e instanceof Error ? e.message : 'Failed to load psychometric responses');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <ActivityIndicator color="#5BA8E8" style={{ marginVertical: 12 }} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (!bundle || !bundleHasResponses(bundle)) {
    return (
      <Text style={styles.emptyText}>No psychometric item responses stored for this user.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {ASSESSMENT_ORDER.map((assessmentId) => {
        const responses = bundle.assessments[assessmentId];
        if (!responses || Object.keys(responses).length === 0) return null;
        const assessment = ASSESSMENTS[assessmentId];
        const impact = instrumentImpacts?.[assessmentId];
        if (isForcedChoiceAssessment(assessment)) {
          return (
            <ForcedChoiceInstrumentResponses
              key={assessmentId}
              assessmentId={assessmentId}
              name={assessment.name}
              assessment={assessment}
              responses={responses as Record<number, NpiEntitlementResponse>}
              impact={impact}
            />
          );
        }
        return (
          <InstrumentResponses
            key={assessmentId}
            assessmentId={assessmentId}
            name={assessment.name}
            assessment={assessment}
            responses={responses as Record<number, number>}
            impact={impact}
          />
        );
      })}
      {POST_INTERVIEW_ASSESSMENT_ORDER.map((assessmentId) => {
        const responses = bundle.postInterview[assessmentId];
        if (!responses || Object.keys(responses).length === 0) return null;
        return (
          <InstrumentResponses
            key={assessmentId}
            assessmentId={assessmentId}
            name={POST_INTERVIEW_ASSESSMENTS[assessmentId].name}
            assessment={POST_INTERVIEW_ASSESSMENTS[assessmentId]}
            responses={responses}
            impact={instrumentImpacts?.[assessmentId]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  instrumentBlock: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    gap: 8,
  },
  instrumentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  instrumentMeta: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  impactBanner: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    marginBottom: 4,
  },
  impactBannerNeutral: {
    borderColor: '#2a3a2a',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  impactBannerWarn: {
    borderColor: '#5c3d1a',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  impactAggregate: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  impactModifierNegative: {
    fontSize: 12,
    color: '#f87171',
    fontWeight: '600',
  },
  impactModifierNeutral: {
    fontSize: 12,
    color: '#86efac',
  },
  impactFloor: {
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 17,
  },
  impactStraightLine: {
    fontSize: 12,
    color: '#fbbf24',
    lineHeight: 17,
  },
  itemRow: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  itemLabel: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemQuestion: {
    fontSize: 13,
    color: 'rgba(238,246,255,0.9)',
    lineHeight: 18,
  },
  itemAnswer: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  itemImpactNote: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 15,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    fontSize: 13,
    color: '#f87171',
  },
});
