import { INTERVIEW_MARKER_LABELS } from '@features/aria/interviewMarkers';

const colors = {
  error: '#C45C5C',
  success: '#2A8C6A',
  primary: '#5BA8E8',
};

export const INTERVIEW_PILLAR_DISPLAY_META: Record<
  string,
  { name: string; color: string }
> = {
  mentalizing: { name: INTERVIEW_MARKER_LABELS.mentalizing, color: colors.error },
  accountability: { name: INTERVIEW_MARKER_LABELS.accountability, color: colors.success },
  destructive_conflict: { name: INTERVIEW_MARKER_LABELS.destructive_conflict, color: '#B85C5C' },
  contempt: { name: INTERVIEW_MARKER_LABELS.destructive_conflict, color: '#B85C5C' },
  repair: { name: INTERVIEW_MARKER_LABELS.repair, color: colors.primary },
  regulation: { name: INTERVIEW_MARKER_LABELS.regulation, color: '#8B3A5C' },
  responsiveness_support: { name: INTERVIEW_MARKER_LABELS.responsiveness_support, color: '#0D6B6B' },
  attunement: { name: INTERVIEW_MARKER_LABELS.responsiveness_support, color: '#0D6B6B' },
  appreciation: { name: INTERVIEW_MARKER_LABELS.appreciation, color: '#2A5C5C' },
  commitment_persistence: { name: INTERVIEW_MARKER_LABELS.commitment_persistence, color: '#6B5CB8' },
  commitment_threshold: { name: INTERVIEW_MARKER_LABELS.commitment_persistence, color: '#6B5CB8' },
};
