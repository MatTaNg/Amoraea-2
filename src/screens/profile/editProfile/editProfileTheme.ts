import { Platform } from 'react-native';
import { theme } from '@/shared/theme/theme';

/** Amoraea edit-profile tokens — aligned with authStyles / shared theme. */
export const editProfileTheme = {
  colors: {
    void: theme.colors.background,
    surface: '#0D1120',
    surfaceElevated: theme.colors.card,
    surfaceCard: '#111827',
    surfaceTranslucent: 'rgba(13,17,32,0.9)',
    flameDeep: '#1E6FD9',
    flameMid: theme.colors.primary,
    flameBright: '#C8E4FF',
    textPrimary: '#E8F0F8',
    textBright: '#F4F8FC',
    textOnPrimary: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textDim: '#3D5470',
    textMuted: '#B8C9DC',
    success: '#2A8C6A',
    error: theme.colors.error,
    errorSoft: '#E87A7A',
    warning: '#D4A84B',
    borderDefault: 'rgba(82,142,220,0.15)',
    borderSubtle: 'rgba(82,142,220,0.12)',
    borderStrong: 'rgba(82,142,220,0.35)',
    tipCardBg: 'rgba(30,111,217,0.12)',
    buttonTintBg: 'rgba(30,111,217,0.1)',
    buttonTintBorder: 'rgba(82,142,220,0.2)',
    viewOnlyBg: 'rgba(61,84,112,0.25)',
    glassBg: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.12)',
    shadowBlue: 'rgba(30,111,217,0.25)',
  },
  fonts: {
    display:
      Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    ui: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    body:
      Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined,
  },
  spacing: {
    screenPadding: 22,
    sectionGap: 20,
    cardRadius: 12,
    inputRadius: 10,
  },
} as const;

export const ep = editProfileTheme;
