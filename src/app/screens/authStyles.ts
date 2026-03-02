import { StyleSheet, Platform } from 'react-native';

const BG = '#05060D';
const SURFACE = 'rgba(13,17,32,0.9)';
const BORDER = 'rgba(82,142,220,0.15)';
const FLAME_BRIGHT = '#C8E4FF';
const FLAME_MID = '#5BA8E8';
const TEXT_PRIMARY = '#E8F0F8';
const TEXT_SECONDARY = '#7A9ABE';
const TEXT_DIM = '#3D5470';
const ERROR_RED = '#E87A7A';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_UI = Platform.OS === 'web' ? "'Jost', sans-serif" : undefined;

export const authStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    maxWidth: 380,
    position: 'relative',
    zIndex: 1,
  },
  wordmark: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 3.2,
    color: FLAME_BRIGHT,
    marginBottom: 28,
    textAlign: 'center',
  },
  wordmarkAe: {
    color: FLAME_MID,
  },
  tagline: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '300',
    fontStyle: 'italic',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 27,
    marginBottom: 40,
    letterSpacing: 0.4,
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    fontFamily: FONT_UI,
    fontSize: 14,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
  },
  inputOptional: {
    borderColor: 'rgba(82,142,220,0.08)',
    color: TEXT_SECONDARY,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 24,
    backgroundColor: FLAME_MID,
    borderWidth: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 30px rgba(30,111,217,0.25)' }
      : { shadowColor: '#1E6FD9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }),
  },
  primaryButtonText: {
    fontFamily: FONT_UI,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
  errorText: {
    fontFamily: FONT_UI,
    fontSize: 12,
    fontWeight: '300',
    color: ERROR_RED,
    marginBottom: 16,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(82,142,220,0.1)',
    marginVertical: 28,
  },
  footerText: {
    fontFamily: FONT_UI,
    fontSize: 13,
    fontWeight: '300',
    color: TEXT_DIM,
    textAlign: 'center',
  },
  link: {
    color: FLAME_MID,
    letterSpacing: 0.5,
  },
  grainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.022,
    zIndex: 0,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }
      : {}),
  },
  ambientGlow: {
    position: 'absolute',
    top: '15%',
    left: '50%',
    width: 400,
    height: 400,
    marginLeft: -200,
    borderRadius: 200,
    backgroundColor: 'rgba(30, 111, 217, 0.09)',
    zIndex: 0,
    ...(Platform.OS === 'web'
      ? { filter: 'blur(50px)' }
      : { shadowColor: '#1E6FD9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 50, elevation: 2 }),
  },
  ambientGlowRegister: {
    top: '10%',
  },
  confirmationNote: {
    fontFamily: FONT_UI,
    fontSize: 11,
    fontWeight: '300',
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    letterSpacing: 0.3,
  },
  sentScreenTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    fontWeight: '300',
    color: FLAME_BRIGHT,
    marginBottom: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sentScreenBody: {
    fontFamily: FONT_UI,
    fontSize: 14,
    fontWeight: '300',
    color: TEXT_SECONDARY,
    lineHeight: 22,
    textAlign: 'center',
  },
});
