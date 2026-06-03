import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/data/supabase/client';
import {
  LIFE_DOMAIN_ONBOARDING_DOMAINS,
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID,
  findLifeDomainQuestionDef,
  isLifeDomainQuestionRequiredForOnboarding,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  fetchLifeDomainAnswersMap,
  type LifeDomainAnswersMap,
} from '@/screens/profile/editProfile/lifeDomainProfileService';

const HIGHLIGHT_QUESTION_IDS = new Set([
  'sleepSchedule',
  LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID,
  'petStatus',
  'chronicIllnessStatus',
  'yearlyIncome',
  'debtAmount',
  'debtPayoffPlan',
  'financesPooled',
  'livingLocation',
  'sexFrequency',
  'spiritualPracticeWeeklyHours',
  'raisingChildrenInFaith',
]);

function formatQuestionLabel(domainId: LifeDomainId, questionId: string): string {
  const def = findLifeDomainQuestionDef(domainId, questionId);
  return def?.text ?? questionId;
}

function requirementLabel(
  domainId: LifeDomainId,
  questionId: string,
  wantKids: string | null | undefined,
): string {
  const def = findLifeDomainQuestionDef(domainId, questionId);
  if (!def) return '';
  if (def.explicitlyOptional) return 'Optional';
  if (isLifeDomainQuestionRequiredForOnboarding(def, { wantKids })) return 'Required';
  if (def.requiredWhenWantKids) return 'Required when wants kids';
  return 'Optional';
}

export function LifeDomainAnswersSection({
  userId,
  wantKids: wantKidsProp,
}: {
  userId: string;
  wantKids?: string | null;
}) {
  const [answers, setAnswers] = useState<LifeDomainAnswersMap | null>(null);
  const [wantKids, setWantKids] = useState<string | null | undefined>(wantKidsProp);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [{ data: profileRow }, answerMap] = await Promise.all([
          supabase.from('profiles').select('profile_json').eq('id', userId).maybeSingle(),
          fetchLifeDomainAnswersMap(userId),
        ]);
        if (cancelled) return;
        const pj = (profileRow?.profile_json ?? {}) as Record<string, unknown>;
        const fromProfile =
          typeof pj.wantKids === 'string'
            ? pj.wantKids
            : typeof pj.want_kids === 'string'
              ? pj.want_kids
              : null;
        setWantKids(wantKidsProp ?? fromProfile);
        setAnswers(answerMap);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setAnswers(null);
          setError(e instanceof Error ? e.message : 'Failed to load life domain answers');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, wantKidsProp]);

  if (loading) {
    return <ActivityIndicator color="#5BA8E8" style={{ marginVertical: 12 }} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (!answers || Object.keys(answers).length === 0) {
    return (
      <Text style={styles.emptyText}>No life domain question answers stored for this user.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {LIFE_DOMAIN_ONBOARDING_DOMAINS.map((domain) => {
        const domainAnswers = answers[domain.id] ?? {};
        const legacySleep = domainAnswers[LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID];
        const entries = Object.entries(domainAnswers).filter(
          ([id, value]) =>
            value?.trim() &&
            (HIGHLIGHT_QUESTION_IDS.has(id) ||
              LIFE_DOMAIN_ONBOARDING_QUESTIONS[domain.id].some((q) => q.id === id)),
        );
        if (domain.id === 'health' && legacySleep?.trim() && !domainAnswers.sleepSchedule?.trim()) {
          entries.push([LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID, legacySleep]);
        }
        if (entries.length === 0) return null;

        return (
          <View key={domain.id} style={styles.domainBlock}>
            <Text style={styles.domainTitle}>
              {domain.icon} {domain.name}
            </Text>
            {entries.map(([questionId, value]) => {
              const req = requirementLabel(domain.id, questionId, wantKids);
              const isLegacySleep =
                questionId === LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID;
              return (
                <View key={questionId} style={styles.row}>
                  <Text style={styles.questionLabel}>
                    {formatQuestionLabel(domain.id, questionId)}
                    {isLegacySleep ? ' (legacy free text)' : ''}
                  </Text>
                  <Text style={styles.reqBadge}>{req}</Text>
                  <Text style={styles.answerValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  domainBlock: {
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.15)',
  },
  domainTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F0FF',
  },
  row: {
    gap: 4,
  },
  questionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(238,246,255,0.85)',
  },
  reqBadge: {
    fontSize: 11,
    color: '#94A3B8',
  },
  answerValue: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  errorText: {
    fontSize: 14,
    color: '#f87171',
  },
});
