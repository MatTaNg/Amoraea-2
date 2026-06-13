import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import {
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  POST_INTERVIEW_ASSESSMENTS,
  POST_INTERVIEW_ASSESSMENT_ORDER,
  type AssessmentId,
  type PostInterviewAssessmentId,
  type PsychometricQuestion,
} from '@features/psychometrics/assessmentContent';
import {
  fetchPsychometricResponsesBundle,
  type PsychometricResponsesBundle,
} from '@features/psychometrics/psychometricsPersistence';

type AssessmentDef = (typeof ASSESSMENTS)[AssessmentId];

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

function scoredItemValue(assessment: AssessmentDef, questionId: number, raw: number): number {
  const isReverse = assessment.scoring.reverseItems.includes(questionId);
  if (!isReverse) return raw;
  if (assessment.scoring.reverseScale) {
    return (assessment.scoring.reverseScale as Record<number, number>)[raw] ?? raw;
  }
  return assessment.scale.max + assessment.scale.min - raw;
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

function InstrumentResponses({
  name,
  assessment,
  responses,
}: {
  name: string;
  assessment: AssessmentDef | (typeof POST_INTERVIEW_ASSESSMENTS)[PostInterviewAssessmentId];
  responses: Record<number, number>;
}) {
  const answered = assessment.questions.filter((q) => responses[q.id] != null);
  if (answered.length === 0) return null;

  return (
    <View style={styles.instrumentBlock}>
      <Text style={styles.instrumentTitle}>{name}</Text>
      <Text style={styles.instrumentMeta}>
        {answered.length} of {assessment.questions.length} items answered
      </Text>
      {answered.map((q) => {
        const raw = responses[q.id]!;
        const isReverse = assessment.scoring.reverseItems.includes(q.id);
        const scored = scoredItemValue(assessment as AssessmentDef, q.id, raw);
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
          </View>
        );
      })}
    </View>
  );
}

export function PsychometricAnswersSection({ userId }: { userId: string }) {
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
        return (
          <InstrumentResponses
            key={assessmentId}
            name={ASSESSMENTS[assessmentId].name}
            assessment={ASSESSMENTS[assessmentId]}
            responses={responses}
          />
        );
      })}
      {POST_INTERVIEW_ASSESSMENT_ORDER.map((assessmentId) => {
        const responses = bundle.postInterview[assessmentId];
        if (!responses || Object.keys(responses).length === 0) return null;
        return (
          <InstrumentResponses
            key={assessmentId}
            name={POST_INTERVIEW_ASSESSMENTS[assessmentId].name}
            assessment={POST_INTERVIEW_ASSESSMENTS[assessmentId]}
            responses={responses}
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
  emptyText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    fontSize: 13,
    color: '#f87171',
  },
});
