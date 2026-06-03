import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { ONBOARDING_MODAL_MAX_WIDTH } from './onboardingModalLayout';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: '100%',
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    marginBottom: 24,
  },
  photoContainer: {
    width: 112,
    height: 112,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.18)',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surface,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  uploadingContainer: {
    width: 112,
    height: 112,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.18)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  addPhotoButton: {
    width: 112,
    height: 112,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(82,142,220,0.36)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  addPhotoText: {
    fontSize: 32,
    color: theme.colors.textSecondary,
  },
  addPhotoLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  videoContainer: {
    marginBottom: 24,
  },
  videoPlayerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    marginHorizontal: -24,
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  deleteVideoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteVideoText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 12,
  },
  videoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  videoButton: {
    flex: 1,
  },
  uploadStatus: {
    marginBottom: 16,
  },
  uploadStatusText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});

