import { colors } from '@ui/theme/colors';
import { INTERVIEW_MARKER_LABELS } from '@features/aria/interviewMarkers';

export const INTERVIEW_PILLAR_DISPLAY_META: Record<string, { name: string; color: string }> = {
  mentalizing: { name: INTERVIEW_MARKER_LABELS.mentalizing, color: colors.error },
  accountability: { name: INTERVIEW_MARKER_LABELS.accountability, color: colors.success },
  contempt: { name: INTERVIEW_MARKER_LABELS.contempt, color: '#B85C5C' },
  repair: { name: INTERVIEW_MARKER_LABELS.repair, color: colors.primary },
  regulation: { name: INTERVIEW_MARKER_LABELS.regulation, color: '#8B3A5C' },
  attunement: { name: INTERVIEW_MARKER_LABELS.attunement, color: '#0D6B6B' },
  appreciation: { name: INTERVIEW_MARKER_LABELS.appreciation, color: '#2A5C5C' },
  commitment_threshold: { name: INTERVIEW_MARKER_LABELS.commitment_threshold, color: '#6B5CB8' },
};
