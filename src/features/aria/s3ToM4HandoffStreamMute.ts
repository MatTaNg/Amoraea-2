import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  isScenarioCRepairAssistantPrompt,
  scenarioCRepairConstructStillPending,
} from '@features/aria/scenarioCPromptDetection';

/**
 * After S3 repair is satisfied, Claude streams boundary + M4 content but the client speaks
 * the canonical moment_4 bundle at stream end. Mute parallel TTS for the whole turn.
 *
 * Do not require `lastAssistantContent` to be the repair prompt — after app reopen a
 * welcome-back interstitial often sits between repair and the user's answer.
 */
export function shouldMuteParallelTtsForS3ToM4HandoffStream(args: {
  currentMoment: number;
  currentScenario: number;
  lastAssistantContent: string;
  messagesToUse: readonly MessageWithScenario[];
  shouldForceScenarioCRepairProbe: boolean;
}): boolean {
  if (args.currentMoment !== 3 || args.currentScenario !== 3) return false;
  if (args.shouldForceScenarioCRepairProbe) return false;
  if (scenarioCRepairConstructStillPending(args.messagesToUse)) return false;
  if (isScenarioCRepairAssistantPrompt(args.lastAssistantContent)) return true;
  return args.messagesToUse.some(
    (m) => m.role === 'assistant' && isScenarioCRepairAssistantPrompt(m.content ?? ''),
  );
}
