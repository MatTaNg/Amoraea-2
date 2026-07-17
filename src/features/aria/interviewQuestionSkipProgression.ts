import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import {
  isScenarioARepairFollowUpCompleteInTranscript,
  transcriptContainsScenarioAContemptProbe,
  transcriptContainsScenarioARepairQuestion,
  transcriptContainsScenarioBAppreciationProbe,
  transcriptContainsScenarioBJamesDifferentlyProbe,
  transcriptContainsScenarioBRepairAsJamesQuestion,
  transcriptContainsScenarioCRepairQuestion,
} from './scenarioFollowUpTranscriptGuard';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
} from './scenarioAContemptProbeTtsStrip';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from './probeAndScoringUtils';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
  SCENARIO_B_Q1_CANONICAL,
} from './scenarioBProbeLogic';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from './scenarioCPromptDetection';
import { SCENARIO_1_OPENING, SCENARIO_3_OPENING } from './interviewScenarioOpeningStreamGate';
import {
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE,
} from './skipAcceptedNextQuestionBridge';

export {
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE,
  looksLikeSkipAcceptedNextQuestionBridgeLine,
  stripSkipAcceptedNextQuestionBridge,
} from './skipAcceptedNextQuestionBridge';

export type QuestionSkipProgressionResult = {
  nextPrompt: string;
  scenarioMomentComplete: boolean;
};

function substantiveMessages(messages: readonly MessageWithScenario[]) {
  return messages.filter(
    (m) =>
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
}

/** True when an assistant turn already delivered this beat (answered or about to be skipped). */
function transcriptHasAssistantPrompt(
  messages: readonly MessageWithScenario[],
  matchesPrompt: (content: string) => boolean,
): boolean {
  return substantiveMessages(messages).some(
    (m) => m.role === 'assistant' && matchesPrompt((m.content ?? '').trim()),
  );
}

function resolveScenarioAQuestionSkipProgression(
  messages: readonly MessageWithScenario[],
): QuestionSkipProgressionResult {
  const q1Asked = transcriptHasAssistantPrompt(
    messages,
    (c) =>
      c.includes(SCENARIO_1_OPENING) ||
      /\bwhat(?:'s| is) going on between these two\b/i.test(c),
  );
  // Skip advances past the active asked beat — never re-deliver the same question.
  if (!q1Asked) {
    return { nextPrompt: SCENARIO_1_OPENING, scenarioMomentComplete: false };
  }
  if (!transcriptContainsScenarioAContemptProbe(messages)) {
    return { nextPrompt: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY, scenarioMomentComplete: false };
  }
  if (
    !transcriptContainsScenarioARepairQuestion(messages) &&
    !isScenarioARepairFollowUpCompleteInTranscript(messages)
  ) {
    return { nextPrompt: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY, scenarioMomentComplete: false };
  }
  return { nextPrompt: '', scenarioMomentComplete: true };
}

function resolveScenarioBQuestionSkipProgression(
  messages: readonly MessageWithScenario[],
): QuestionSkipProgressionResult {
  const q1Asked = transcriptHasAssistantPrompt(
    messages,
    (c) =>
      c.includes(SCENARIO_B_Q1_CANONICAL) ||
      /\bwhat do you think is going on here\b/i.test(c),
  );
  if (!q1Asked) {
    return { nextPrompt: SCENARIO_B_Q1_CANONICAL, scenarioMomentComplete: false };
  }
  if (
    !transcriptContainsScenarioBJamesDifferentlyProbe(messages) &&
    !transcriptContainsScenarioBAppreciationProbe(messages)
  ) {
    return { nextPrompt: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, scenarioMomentComplete: false };
  }
  if (!transcriptContainsScenarioBRepairAsJamesQuestion(messages)) {
    return { nextPrompt: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioMomentComplete: false };
  }
  return { nextPrompt: '', scenarioMomentComplete: true };
}

function resolveScenarioCQuestionSkipProgression(
  messages: readonly MessageWithScenario[],
): QuestionSkipProgressionResult {
  const q1Asked = transcriptHasAssistantPrompt(
    messages,
    (c) =>
      c.includes(SCENARIO_3_OPENING) ||
      /\bwhat do you make of (?:that|this|daniel|sophie)\b/i.test(c) ||
      /\bwhat(?:'s| is) going on (?:here|between|with)\b/i.test(c),
  );
  if (!q1Asked) {
    return { nextPrompt: SCENARIO_3_OPENING, scenarioMomentComplete: false };
  }
  if (!transcriptContainsScenarioCRepairQuestion(messages)) {
    return { nextPrompt: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioMomentComplete: false };
  }
  return { nextPrompt: '', scenarioMomentComplete: true };
}

/** Next scripted beat after the user confirms skipping the active question (not the whole scenario). */
export function resolveQuestionSkipProgression(
  messages: readonly MessageWithScenario[],
  momentNum: number,
  _scenarioNum: 1 | 2 | 3,
): QuestionSkipProgressionResult {
  const scenario =
    momentNum >= 1 && momentNum <= 3 ? (momentNum as 1 | 2 | 3) : _scenarioNum;
  if (scenario === 1) {
    return resolveScenarioAQuestionSkipProgression(messages);
  }
  if (scenario === 2) {
    return resolveScenarioBQuestionSkipProgression(messages);
  }
  return resolveScenarioCQuestionSkipProgression(messages);
}

export function buildSkipAcceptedSystemSuffix(
  progression: QuestionSkipProgressionResult,
  momentNum: number,
): string {
  if (progression.scenarioMomentComplete) {
    return `
─────────────────────────────────────────
SKIP ACCEPTED (CLIENT) — SCENARIO ${momentNum} COMPLETE
─────────────────────────────────────────
The participant **confirmed** skipping after the skip confirmation prompt. They have skipped the **last** required question in this scenario.

In **one** assistant reply: open with **exactly** "${SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE}" (minor contractions OK), then deliver **BOUNDARY CLOSURE** for Scenario ${momentNum === 1 ? 'A' : momentNum === 2 ? 'B' : 'C'} per the framework (segment close + short transition, no content reflection) and emit **[SCENARIO_COMPLETE:${momentNum}]**. **Do not** re-ask the skipped prompt. **Do not** offer skip confirmation again.
`;
  }
  return `
─────────────────────────────────────────
SKIP ACCEPTED (CLIENT) — NEXT QUESTION IN SAME SCENARIO
─────────────────────────────────────────
The participant **confirmed** skipping the **active question only** — **not** the whole scenario.

**Forbidden this turn:** segment-close / "finished the three situations" / personal-handoff language, **[SCENARIO_COMPLETE:${momentNum}]**, or any next-scenario vignette.

In **one** assistant reply: open with **exactly** "${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE}" (minor contractions OK), then speak **only** this scripted question verbatim (no reflective preamble):
"${progression.nextPrompt}"
`;
}
