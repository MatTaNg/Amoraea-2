import { buildSexualCommunicationScores } from '@features/psychometrics/sexualCommunicationInsight';
import { POST_INTERVIEW_ASSESSMENTS } from '@features/psychometrics/assessmentContent';

export const SEXUAL_COMMUNICATION_ITEMS: string[] =
  POST_INTERVIEW_ASSESSMENTS.sexual_communication.questions.map((q) => q.text);

export function scoreSexualCommunication10(
  responses: Record<string, number>,
): Record<string, number> {
  return buildSexualCommunicationScores(responses);
}
