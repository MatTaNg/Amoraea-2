import { useMemo } from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';
import { spacing } from '@ui/theme/spacing';

/** Viewports narrower than this use tighter padding and slightly smaller type. */
export const NARROW_ASSESSMENT_VIEWPORT_WIDTH = 420;

export function isNarrowAssessmentViewport(width: number): boolean {
  return width < NARROW_ASSESSMENT_VIEWPORT_WIDTH;
}

export function assessmentScrollContentStyle(width: number, extra?: ViewStyle): ViewStyle {
  const narrow = isNarrowAssessmentViewport(width);
  return {
    padding: narrow ? 16 : spacing.lg,
    paddingTop: narrow ? 16 : spacing.lg,
    paddingBottom: narrow ? spacing.xxl : spacing.xxl * 2,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    ...extra,
  };
}

export function useNarrowAssessmentViewport(): boolean {
  const { width } = useWindowDimensions();
  return isNarrowAssessmentViewport(width);
}

export function useAssessmentScrollContent(extra?: ViewStyle): ViewStyle {
  const { width } = useWindowDimensions();
  return useMemo(() => assessmentScrollContentStyle(width, extra), [width, extra]);
}

/** Scale heading sizes down slightly on narrow phones so content fits without feeling zoomed. */
export function assessmentFontSize(base: number, width: number): number {
  return isNarrowAssessmentViewport(width) ? Math.max(13, Math.round(base * 0.9)) : base;
}
