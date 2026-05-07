import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';

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

type RowProps = {
  domain: OnboardingLifeDomainKey;
  value: number;
  values: OnboardingLifeDomainValues;
  onValuesChange: (next: OnboardingLifeDomainValues) => void;
};

const DomainSliderRow: React.FC<RowProps> = ({ domain, value, values, onValuesChange }) => {
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
        <Text style={styles.label}>{LABELS[domain]}</Text>
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
}> = ({ values, onValuesChange }) => {
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
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    backgroundColor: '#253042',
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
    borderColor: '#0f1419',
  },
  totalLine: {
    marginTop: 8,
    color: '#7A9ABE',
    fontSize: 15,
    fontWeight: '600',
  },
});
