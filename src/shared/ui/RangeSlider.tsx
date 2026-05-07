import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 44;
const RAIL_HEIGHT = 6;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return clamp(snapped, min, max);
}

/** Map touch x on track (0..trackWidth) to domain value. */
function xToValue(
  x: number,
  trackWidth: number,
  minValue: number,
  maxValue: number,
  step: number
): number {
  if (trackWidth <= THUMB_SIZE) return minValue;
  const usable = trackWidth - THUMB_SIZE;
  const center = clamp(x, THUMB_SIZE / 2, trackWidth - THUMB_SIZE / 2);
  const t = (center - THUMB_SIZE / 2) / usable;
  const raw = minValue + t * (maxValue - minValue);
  return snapToStep(raw, minValue, maxValue, step);
}

export type RangeSliderProps = {
  minValue: number;
  maxValue: number;
  initialMinValue?: number;
  initialMaxValue?: number;
  step?: number;
  onValueChange: (min: number, max: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  /** One thumb: min is fixed at `minValue`, only max distance is adjustable (stores `[minValue, max]`). */
  mode?: 'range' | 'singleMax';
};

export const RangeSlider: React.FC<RangeSliderProps> = ({
  minValue,
  maxValue,
  initialMinValue,
  initialMaxValue,
  step = 1,
  onValueChange,
  minimumTrackTintColor = '#7C3AED',
  maximumTrackTintColor = '#32384A',
  mode = 'range',
}) => {
  const isSingleMax = mode === 'singleMax';
  const accent = minimumTrackTintColor;
  const muted = maximumTrackTintColor;

  const [trackWidth, setTrackWidth] = useState(0);
  const [low, setLow] = useState(() => {
    if (isSingleMax) return minValue;
    const lo = num(initialMinValue, minValue);
    const hi = num(initialMaxValue, maxValue);
    const a = clamp(lo, minValue, maxValue);
    const b = clamp(hi, minValue, maxValue);
    return a <= b ? a : b;
  });
  const [high, setHigh] = useState(() => {
    if (isSingleMax) {
      return clamp(num(initialMaxValue, maxValue), minValue, maxValue);
    }
    const lo = num(initialMinValue, minValue);
    const hi = num(initialMaxValue, maxValue);
    const a = clamp(lo, minValue, maxValue);
    const b = clamp(hi, minValue, maxValue);
    return a <= b ? b : a;
  });

  const lowRef = useRef(low);
  const highRef = useRef(high);
  lowRef.current = low;
  highRef.current = high;

  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;

  const draggingRef = useRef(false);
  const activeThumbRef = useRef<'low' | 'high'>('low');
  const dragStartXRef = useRef(0);

  const minValueRef = useRef(minValue);
  const maxValueRef = useRef(maxValue);
  const stepRef = useRef(step);
  const modeRef = useRef(mode);
  minValueRef.current = minValue;
  maxValueRef.current = maxValue;
  stepRef.current = step;
  modeRef.current = mode;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const commit = useCallback((nextLow: number, nextHigh: number) => {
    const mn = minValueRef.current;
    const mx = maxValueRef.current;
    const st = stepRef.current;
    if (modeRef.current === 'singleMax') {
      const hi = snapToStep(nextHigh, mn, mx, st);
      setLow(mn);
      setHigh(hi);
      onValueChangeRef.current(mn, hi);
      return;
    }
    let lo = snapToStep(nextLow, mn, mx, st);
    let hi = snapToStep(nextHigh, mn, mx, st);
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    if (hi - lo < st) {
      if (activeThumbRef.current === 'low') {
        hi = clamp(lo + st, mn, mx);
      } else {
        lo = clamp(hi - st, mn, mx);
      }
    }
    setLow(lo);
    setHigh(hi);
    onValueChangeRef.current(lo, hi);
  }, []);

  useEffect(() => {
    if (draggingRef.current) return;
    if (modeRef.current === 'singleMax') {
      setLow(minValue);
      setHigh(clamp(num(initialMaxValue, maxValue), minValue, maxValue));
      return;
    }
    const lo = clamp(num(initialMinValue, minValue), minValue, maxValue);
    const hi = clamp(num(initialMaxValue, maxValue), minValue, maxValue);
    if (lo <= hi) {
      setLow(lo);
      setHigh(hi);
    } else {
      setLow(hi);
      setHigh(lo);
    }
  }, [initialMinValue, initialMaxValue, minValue, maxValue, mode, isSingleMax]);

  const applyX = useCallback((x: number) => {
    const w = trackWidthRef.current;
    if (w <= 0) return;
    const mn = minValueRef.current;
    const mx = maxValueRef.current;
    const st = stepRef.current;
    const vx = xToValue(x, w, mn, mx, st);
    if (modeRef.current === 'singleMax') {
      commit(mn, vx);
      return;
    }
    const curL = lowRef.current;
    const curH = highRef.current;
    if (activeThumbRef.current === 'low') {
      const nextL = Math.min(vx, curH - st);
      commit(nextL, curH);
    } else {
      const nextH = Math.max(vx, curL + st);
      commit(curL, nextH);
    }
  }, [commit]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const w = trackWidthRef.current;
          if (w <= 0) return;
          draggingRef.current = true;
          const x0 = clamp(e.nativeEvent.locationX, 0, w);
          dragStartXRef.current = x0;
          if (modeRef.current === 'singleMax') {
            activeThumbRef.current = 'high';
            applyX(x0);
            return;
          }
          const v0 = xToValue(x0, w, minValueRef.current, maxValueRef.current, stepRef.current);
          const curL = lowRef.current;
          const curH = highRef.current;
          activeThumbRef.current =
            Math.abs(v0 - curL) <= Math.abs(v0 - curH) ? 'low' : 'high';
          applyX(x0);
        },
        onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
          const w = trackWidthRef.current;
          if (w <= 0) return;
          const x = clamp(dragStartXRef.current + gs.dx, 0, w);
          applyX(x);
        },
        onPanResponderRelease: () => {
          draggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
        },
      }),
    [applyX]
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const ratio = (v: number) => {
    const span = maxValue - minValue;
    if (span <= 0) return 0;
    return (v - minValue) / span;
  };

  const lowLeft =
    trackWidth > 0 ? ratio(low) * (trackWidth - THUMB_SIZE) : 0;
  const highLeft =
    trackWidth > 0 ? ratio(high) * (trackWidth - THUMB_SIZE) : 0;
  const selLeft = lowLeft + THUMB_SIZE / 2;
  const selWidth = Math.max(0, highLeft - lowLeft);

  return (
    <View style={styles.wrap}>
      <View style={styles.valuesRow}>
        {isSingleMax ? (
          <Text style={styles.valueLabel}>{high}</Text>
        ) : (
          <>
            <Text style={styles.valueLabel}>{low}</Text>
            <Text style={[styles.valueDash, { color: muted }]}>–</Text>
            <Text style={styles.valueLabel}>{high}</Text>
          </>
        )}
      </View>
      <View style={styles.trackOuter} onLayout={onTrackLayout} {...panResponder.panHandlers}>
        <View style={[styles.railBg, { backgroundColor: muted }]} />
        {trackWidth > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.railFill,
              {
                left: selLeft,
                width: selWidth,
                backgroundColor: accent,
              },
            ]}
          />
        )}
        {!isSingleMax && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: lowLeft,
                borderColor: accent,
                backgroundColor: '#1A1F2E',
              },
            ]}
          />
        )}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: highLeft,
              borderColor: accent,
              backgroundColor: '#1A1F2E',
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 8,
    gap: 6,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  valueLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E8ECF4',
    minWidth: 28,
    textAlign: 'center',
  },
  valueDash: { fontSize: 16, fontWeight: '600' },
  trackOuter: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    marginTop: 4,
  },
  railBg: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: RAIL_HEIGHT,
    borderRadius: RAIL_HEIGHT / 2,
    top: (TRACK_HEIGHT - RAIL_HEIGHT) / 2,
    opacity: 0.45,
  },
  railFill: {
    position: 'absolute',
    height: RAIL_HEIGHT,
    borderRadius: RAIL_HEIGHT / 2,
    top: (TRACK_HEIGHT - RAIL_HEIGHT) / 2,
    opacity: 0.95,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
});
