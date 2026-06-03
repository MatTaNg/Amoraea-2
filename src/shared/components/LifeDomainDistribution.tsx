import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const ONBOARDING_LIFE_DOMAIN_KEYS = [
  'intimacy',
  'finance',
  'spirituality',
  'family',
  'physicalHealth',
] as const;

export type OnboardingLifeDomainKey = (typeof ONBOARDING_LIFE_DOMAIN_KEYS)[number];
export type OnboardingLifeDomainValues = Record<OnboardingLifeDomainKey, number>;

export const DEFAULT_ONBOARDING_LIFE_DOMAINS: OnboardingLifeDomainValues = {
  intimacy: 0,
  finance: 0,
  spirituality: 0,
  family: 0,
  physicalHealth: 0,
};

const LABELS: Record<OnboardingLifeDomainKey, string> = {
  intimacy: 'Intimacy / Sex',
  finance: 'Finance / Career / Business',
  spirituality: 'Spirituality / Religion',
  family: 'Family',
  physicalHealth: 'Physical & Nutritional Health',
};

const DOMAIN_COLORS: Record<OnboardingLifeDomainKey, string> = {
  intimacy: '#E87A9A',
  finance: '#4A9FE8',
  spirituality: '#9B7BDE',
  family: '#E9A14C',
  physicalHealth: '#5ECB8A',
};

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 8;
const SLIDER_ROW_HEIGHT = 44;

function clampDomainValue(
  key: OnboardingLifeDomainKey,
  next: number,
  current: OnboardingLifeDomainValues,
): number {
  const rounded = Math.max(0, Math.min(100, Math.round(next)));
  const total = ONBOARDING_LIFE_DOMAIN_KEYS.reduce((s, k) => s + (current[k] ?? 0), 0);
  const others = total - (current[key] ?? 0);
  const maxForKey = Math.min(100, Math.max(0, 100 - others));
  return Math.max(0, Math.min(maxForKey, rounded));
}

export type LifeDomainAnswerCount = { answered: number; total: number };

type RowProps = {
  domain: OnboardingLifeDomainKey;
  value: number;
  values: OnboardingLifeDomainValues;
  onValuesChange: (next: OnboardingLifeDomainValues) => void;
  onOpenQuestions?: (domain: OnboardingLifeDomainKey) => void;
  answerCount?: LifeDomainAnswerCount;
};

const DomainSliderRow: React.FC<RowProps> = ({
  domain,
  value,
  values,
  onValuesChange,
  onOpenQuestions,
  answerCount,
}) => {
  const trackWidthRef = useRef(1);

  const setFromLocalX = useCallback(
    (localX: number) => {
      const w = trackWidthRef.current;
      if (w <= 0) return;
      const ratio = Math.max(0, Math.min(1, localX / w));
      const desired = ratio * 100;
      const clamped = clampDomainValue(domain, desired, values);
      if (clamped !== values[domain]) {
        onValuesChange({ ...values, [domain]: clamped });
      }
    },
    [domain, onValuesChange, values],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromLocalX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setFromLocalX(e.nativeEvent.locationX),
      }),
    [setFromLocalX],
  );

  const color = DOMAIN_COLORS[domain];
  const thumbTop = (SLIDER_ROW_HEIGHT - THUMB_SIZE) / 2;

  return (
    <View style={styles.rowWrap}>
      <View style={styles.labelRow}>
        <View style={styles.labelStart}>
          <View style={styles.labelTitleRow}>
            <Text style={styles.label}>{LABELS[domain]}</Text>
            {onOpenQuestions ? (
              <Pressable
                onPress={() => onOpenQuestions(domain)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  answerCount
                    ? `View ${LABELS[domain]} questions, ${answerCount.answered} of ${answerCount.total} answered`
                    : `View ${LABELS[domain]} questions`
                }
                style={({ pressed }) => [styles.questionsBtn, pressed && { opacity: 0.65 }]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#7EB8F0" />
              </Pressable>
            ) : null}
          </View>
          {answerCount ? (
            <Text style={styles.answerCount}>
              {answerCount.answered} of {answerCount.total} optional answered
            </Text>
          ) : null}
        </View>
        <Text style={[styles.valueBadge, { color }]}>{value}</Text>
      </View>
      <View
        style={styles.sliderTouch}
        onLayout={(e: LayoutChangeEvent) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
      >
        <View style={styles.trackRail}>
          <View
            style={[
              styles.trackFill,
              { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: `${Math.min(100, Math.max(0, value))}%`,
              marginLeft: -THUMB_SIZE / 2,
              top: thumbTop,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
};

export const LifeDomainDistribution: React.FC<{
  values: OnboardingLifeDomainValues;
  onValuesChange: (next: OnboardingLifeDomainValues) => void;
  /** Opens life-domain deep-dive questions for the tapped domain (e.g. edit profile). */
  onOpenDomainQuestions?: (domain: OnboardingLifeDomainKey) => void;
  /** Per-domain answered counts (edit profile). */
  domainAnswerCounts?: Partial<Record<OnboardingLifeDomainKey, LifeDomainAnswerCount>>;
}> = ({ values, onValuesChange, onOpenDomainQuestions, domainAnswerCounts }) => {
  const total = ONBOARDING_LIFE_DOMAIN_KEYS.reduce((s, k) => s + (values[k] ?? 0), 0);
  return (
    <View style={styles.box}>
      {ONBOARDING_LIFE_DOMAIN_KEYS.map((k) => (
        <DomainSliderRow
          key={k}
          domain={k}
          value={values[k] ?? 0}
          values={values}
          onValuesChange={onValuesChange}
          onOpenQuestions={onOpenDomainQuestions}
          answerCount={domainAnswerCounts?.[k]}
        />
      ))}
      <Text style={styles.totalLine}>Total: {total} / 100</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    gap: 4,
    width: '100%',
  },
  rowWrap: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelStart: {
    flex: 1,
    paddingRight: 8,
    gap: 4,
  },
  labelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  answerCount: {
    color: 'rgba(200,217,238,0.72)',
    fontSize: 13,
    lineHeight: 18,
  },
  questionsBtn: {
    padding: 2,
  },
  label: {
    color: '#C8D9EE',
    fontSize: 16,
    fontWeight: '600',
  },
  valueBadge: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  sliderTouch: {
    height: SLIDER_ROW_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  trackRail: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(200,217,238,0.16)',
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#05060D',
  },
  totalLine: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    color: '#C8D9EE',
    fontSize: 16,
    fontWeight: '700',
  },
});
