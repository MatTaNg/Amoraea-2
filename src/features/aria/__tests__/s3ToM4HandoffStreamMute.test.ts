import { describe, expect, it } from '@jest/globals';

import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';
import { resolvePreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { shouldMuteParallelTtsForS3ToM4HandoffStream } from '@features/aria/s3ToM4HandoffStreamMute';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('s3ToM4HandoffStreamMute', () => {
  const repairAssistant = SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  const repairAnswer =
    "Daniel needs to stop leaving. They need to figure out why he's leaving, otherwise they'll never be repaired.";

  it('arms full-stream mute after substantive S3 repair answer', () => {
    const messages = [
      { role: 'assistant', content: repairAssistant },
      { role: 'user', content: repairAnswer },
    ] as const;

    expect(
      shouldMuteParallelTtsForS3ToM4HandoffStream({
        currentMoment: 3,
        currentScenario: 3,
        lastAssistantContent: repairAssistant,
        messagesToUse: [...messages],
        shouldForceScenarioCRepairProbe: false,
      }),
    ).toBe(true);

    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      s3RepairProbeDeliveredRef: { current: true },
      pendingS3ToM4HandoffStreamMuteRef: { current: false },
    });

    const flags = resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      repairAnswer,
      [...messages],
      repairAssistant,
      repairAssistant,
      false,
    );

    expect(flags.muteParallelTtsForS3ToM4HandoffStream).toBe(true);
    expect(deps.pendingS3ToM4HandoffStreamMuteRef.current).toBe(true);
  });

  it('arms mute when last assistant is resume welcome but repair was already answered', () => {
    const welcome =
      "Welcome back! Lets continue where we left off. If you'd like me to repeat what I said, let me know.";
    expect(
      shouldMuteParallelTtsForS3ToM4HandoffStream({
        currentMoment: 3,
        currentScenario: 3,
        lastAssistantContent: welcome,
        messagesToUse: [
          { role: 'assistant', content: repairAssistant },
          { role: 'assistant', content: welcome, isWelcomeBack: true },
          { role: 'user', content: repairAnswer },
        ],
        shouldForceScenarioCRepairProbe: false,
      }),
    ).toBe(true);
  });

  it('does not arm mute while S3 repair construct is still pending', () => {
    expect(
      shouldMuteParallelTtsForS3ToM4HandoffStream({
        currentMoment: 3,
        currentScenario: 3,
        lastAssistantContent: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
        messagesToUse: [
          {
            role: 'assistant',
            content: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
          },
          { role: 'user', content: 'He was overwhelmed.' },
        ],
        shouldForceScenarioCRepairProbe: false,
      }),
    ).toBe(false);
  });

  it('does not arm mute when repair probe is being forced this turn', () => {
    expect(
      shouldMuteParallelTtsForS3ToM4HandoffStream({
        currentMoment: 3,
        currentScenario: 3,
        lastAssistantContent: repairAssistant,
        messagesToUse: [{ role: 'assistant', content: repairAssistant }, { role: 'user', content: repairAnswer }],
        shouldForceScenarioCRepairProbe: true,
      }),
    ).toBe(false);
  });
});
