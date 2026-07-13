import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  captureScenarioCRepairOnlyEvidenceIfApplicable,
  runPreClaudeScenarioCMisplacedQ1Gate,
} from '@features/aria/runPreClaudeScenarioCPreAppendGates';
import { runPreClaudeScenarioAMisplacedAnswerGate } from '@features/aria/runPreClaudeScenarioAMisplacedAnswerGate';
import { runPreClaudeScenarioBAheadOfScheduleAnswerGate } from '@features/aria/runPreClaudeScenarioBAheadOfScheduleAnswerGate';
import {
  runPreClaudeClosingAdditionGate,
} from '@features/aria/runPreClaudeClosingAdditionGate';
import {
  runPreClaudeClosingQuestionAnswerGate,
} from '@features/aria/runPreClaudeClosingQuestionAnswerGate';
import {
  runPreClaudeDeferredEmotionModalIntercept,
} from '@features/aria/runPreClaudeDeferredEmotionModalIntercept';
import {
  runPreClaudeTurnNameEntryGate,
} from '@features/aria/runPreClaudeTurnNameEntryGate';

export type PreClaudePreCommitGatesResult = {
  handled: boolean;
  participantFirstNameForSpoken: string;
  isNameEntryTurn: boolean;
};

/** Gates that run before the user turn is committed to the transcript. */
export async function runPreClaudePreCommitGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  participantFirstNameForSpoken: string,
): Promise<PreClaudePreCommitGatesResult> {
  let spokenName = participantFirstNameForSpoken;
  let isNameEntryTurn = false;

  const nameEntry = await runPreClaudeTurnNameEntryGate(deps, trimmed);
  isNameEntryTurn = nameEntry.isNameEntryTurn;
  if (nameEntry.participantFirstNameForSpoken != null) {
    spokenName = nameEntry.participantFirstNameForSpoken;
  }
  if (nameEntry.haltTurn) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const deferredEmotionModal = await runPreClaudeDeferredEmotionModalIntercept(deps, trimmed);
  if (deferredEmotionModal.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const closingAddition = await runPreClaudeClosingAdditionGate(deps, trimmed, spokenName);
  if (closingAddition.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const closingQuestionAnswer = await runPreClaudeClosingQuestionAnswerGate(deps, trimmed, spokenName);
  if (closingQuestionAnswer.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const scenarioCMisplacedQ1 = await runPreClaudeScenarioCMisplacedQ1Gate(deps, trimmed);
  if (scenarioCMisplacedQ1.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const scenarioAMisplacedS2 = await runPreClaudeScenarioAMisplacedAnswerGate(deps, trimmed);
  if (scenarioAMisplacedS2.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  const scenarioBAheadOfSchedule = await runPreClaudeScenarioBAheadOfScheduleAnswerGate(deps, trimmed);
  if (scenarioBAheadOfSchedule.handled) {
    return { handled: true, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
  }

  captureScenarioCRepairOnlyEvidenceIfApplicable(deps, trimmed);

  return { handled: false, participantFirstNameForSpoken: spokenName, isNameEntryTurn };
}
