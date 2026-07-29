import { isScenarioCRepairAssistantPrompt } from '@features/aria/probeAndScoringUtils';
import { transcriptContainsScenarioCRepairQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';

/** Set when the scripted S3 repair Q2 is passed to TTS (not merely staged in transcript). */
export function markS3RepairProbeTtsDelivered(deps: {
  s3RepairProbeDeliveredRef: { current: boolean };
}): void {
  deps.s3RepairProbeDeliveredRef.current = true;
}

/** True when repair Q2 was actually spoken (stream) or committed after confirmed TTS delivery. */
export function isS3RepairProbeAudiblyDelivered(
  deps: {
    s3RepairProbeDeliveredRef: { current: boolean };
    parallelStreamingTtsRef: { current: { spokenCompleteText: string } };
  },
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  if (
    isScenarioCRepairAssistantPrompt(deps.parallelStreamingTtsRef.current.spokenCompleteText)
  ) {
    return true;
  }
  return (
    deps.s3RepairProbeDeliveredRef.current &&
    transcriptContainsScenarioCRepairQuestion(messages)
  );
}

/** Clears optimistic delivery ref set before TTS when repair never reached audio or transcript. */
export function clearS3RepairProbeDeliveredRefIfFalsePositive(
  deps: {
    s3RepairProbeDeliveredRef: { current: boolean };
    parallelStreamingTtsRef: { current: { spokenCompleteText: string } };
  },
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  if (!deps.s3RepairProbeDeliveredRef.current) return false;
  if (isS3RepairProbeAudiblyDelivered(deps, messages)) return false;
  deps.s3RepairProbeDeliveredRef.current = false;
  return true;
}
