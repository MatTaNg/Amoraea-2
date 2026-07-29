import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { DevScenarioJumpTarget } from '@features/aria/devScenarioJumpReferral';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  SCENARIO_2_OPENING,
  SCENARIO_2_TEXT,
  SCENARIO_3_OPENING,
  SCENARIO_3_TEXT,
} from '@features/aria/interviewScenarioVignetteCopy';
import {
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { buildMoment4HandoffForInterview } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import type { InterviewSessionLifecycleDeps } from '@features/aria/sessionLifecycleTypes';
import { remoteLog } from '@utilities/remoteLog';

const DEV_JUMP_PARTICIPANT_NAME = 'Tester';

function markPriorScenariosCompleteForJump(
  deps: InterviewSessionLifecycleDeps,
  target: DevScenarioJumpTarget,
): void {
  const priorScenarioCount = target === 4 ? 3 : target - 1;
  for (let n = 1; n <= priorScenarioCount; n++) {
    deps.interviewMomentsCompleteRef.current[n] = true;
    deps.scoredScenariosRef.current.add(n);
  }
}

/**
 * Seeds interview refs and delivers opening TTS for dev scenario jump (targets 2–4).
 * Target 1 uses the normal name-prompt greeting path.
 */
export async function applyDevScenarioJumpAtInterviewStart(
  deps: InterviewSessionLifecycleDeps,
  target: DevScenarioJumpTarget,
  opts?: { fromUserGesture?: boolean },
): Promise<boolean> {
  if (target === 1) return false;

  deps.interviewNameRef.current = DEV_JUMP_PARTICIPANT_NAME;
  markPriorScenariosCompleteForJump(deps, target);

  let openingLineText: string;
  let openingQuestion: string;
  let scenarioNumber: 1 | 2 | 3;
  let interviewMoment: 2 | 3 | 4;

  if (target === 2) {
    scenarioNumber = 2;
    interviewMoment = 2;
    openingLineText = SCENARIO_2_TEXT;
    openingQuestion = SCENARIO_2_OPENING;
  } else if (target === 3) {
    scenarioNumber = 3;
    interviewMoment = 3;
    openingLineText = SCENARIO_3_TEXT;
    openingQuestion = SCENARIO_3_OPENING;
  } else {
    scenarioNumber = 3;
    interviewMoment = 4;
    deps.personalHandoffInjectedRef.current = true;
    openingLineText = buildMoment4HandoffForInterview('', MOMENT_4_GRUDGE_QUESTION_TEXT);
    openingQuestion = MOMENT_4_GRUDGE_QUESTION_TEXT;
  }

  deps.currentScenarioRef.current = scenarioNumber;
  deps.currentInterviewMomentRef.current = interviewMoment;
  deps.resumeActiveScenarioRef.current = scenarioNumber;
  deps.setHighestScenarioReached(Math.max(scenarioNumber, interviewMoment === 4 ? 3 : scenarioNumber));

  const openingRow: MessageWithScenario = {
    role: 'assistant',
    content: openingLineText,
    scenarioNumber,
    interviewMoment,
  };
  deps.setMessages([openingRow]);
  deps.lastQuestionTextRef.current = openingQuestion;

  if (target === 2) {
    const s2Scenario: ActiveScenario = {
      label: 'Situation 2',
      text: SHOW_SCENARIO_2_VIGNETTE_EXACT,
    };
    deps.setReferenceCardScenario(s2Scenario);
    deps.committedScenarioRef.current = s2Scenario;
    deps.setReferenceCardPrompt(SCENARIO_2_OPENING);
    deps.setInterviewUiPhase('scenario_active');
    await deps.notifyScenarioStarted(2, [openingRow], { allowMessageHistoryShrink: true });
  } else if (target === 3) {
    const s3Scenario: ActiveScenario = {
      label: 'Situation 3',
      text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
    };
    deps.setReferenceCardScenario(s3Scenario);
    deps.committedScenarioRef.current = s3Scenario;
    deps.setReferenceCardPrompt(SCENARIO_3_OPENING);
    deps.setInterviewUiPhase('scenario_active');
    await deps.notifyScenarioStarted(3, [openingRow], { allowMessageHistoryShrink: true });
  } else {
    deps.setReferenceCardScenario(null);
    deps.committedScenarioRef.current = null;
    deps.setReferenceCardPrompt(MOMENT_4_GRUDGE_QUESTION_TEXT);
    deps.setInterviewUiPhase('scenario_active');
  }

  void remoteLog('[START] Dev scenario jump opening', {
    target,
    scenarioNumber,
    interviewMoment,
    preview: openingLineText.slice(0, 180),
  });

  await deps.speakTextSafe(openingLineText, {
    telemetrySource: 'dev_scenario_jump',
    ttsTriggerSource: opts?.fromUserGesture ? 'gesture_handler' : 'callback',
  });
  return true;
}
