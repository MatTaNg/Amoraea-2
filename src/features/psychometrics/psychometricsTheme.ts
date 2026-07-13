import { Platform } from 'react-native';
import { spacing } from '@ui/theme/spacing';

/** Matches Amoraea pre-interview (`#05060D`) and post-interview stack (`#0a0a0f`). */
export const PSYCHOMETRICS_BG = '#05060D';

export const PSYCHOMETRICS_ACCENT = '#5BA8E8';
export const PSYCHOMETRICS_ACCENT_STRONG = '#1E6FD9';

export const PSYCHOMETRICS_GLASS_BG = 'rgba(255,255,255,0.06)';
export const PSYCHOMETRICS_GLASS_BORDER = 'rgba(255,255,255,0.12)';

export const PSYCHOMETRICS_TIP_CARD_BG = 'rgba(30, 111, 217, 0.12)';
export const PSYCHOMETRICS_TIP_CARD_BORDER = '#1E6FD9';

export const PSYCHOMETRICS_FONT_DISPLAY =
  Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
export const PSYCHOMETRICS_FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

export const PSYCHOMETRICS_GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap';

export const psychometricsScrollContent = {
  padding: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.xxl * 2,
  maxWidth: 560,
  width: '100%',
  alignSelf: 'center' as const,
};

export function loadPsychometricsWebFontsOnce(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${PSYCHOMETRICS_GOOGLE_FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = PSYCHOMETRICS_GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}
