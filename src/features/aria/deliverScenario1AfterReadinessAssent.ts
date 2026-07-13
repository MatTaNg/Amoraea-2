import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import {
  buildFallbackIntroBriefingText,
  extractFirstNameFromIntroBriefingLead,
  insertPreambleBriefingIfMissing,
  transcriptHasScenario1VignetteAssistant,
} from '@features/aria/interviewPreambleBriefing';
import { userTextLooksLikeDecline } from '@features/aria/interviewControlTokens';
import {
  isInterviewPreambleBriefingMoment,
  looksLikeReadinessAffirmation,
  userIsAnsweringInterviewReadinessPrompt,
} from '@features/aria/interviewLanguageGate';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import { SHOW_SCENARIO_1_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { buildScenario1VignetteIntroBundle } from '@features/aria/interviewTransitionBundles';
import {
  SHOW_SCENARIO_CARD_CANONICAL_SPEECH,
} from '@features/aria/interviewTtsSpeakOptions';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import type { ShowScenarioCardCanonicalPlaybackConfirmedKinds } from '@features/aria/showScenarioCardCanonicalTts';
import { speakLongFormInterviewHtmlMp3 } from '@features/aria/utils/speakLongFormInterviewHtmlMp3';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { InterviewUiPhase } from '@features/aria/sessionLifecycleTypes';
import { remoteLog } from '@utilities/remoteLog';
import { markQuestionDelivered } from '@utilities/sessionLogging';

export type Scenario1ReadinessDeliveryDeps = {
  isInterviewAppRoute: boolean;
  isAdmin: boolean;
  status: string;
  currentInterviewMomentRef: { current: number };
  currentScenarioRef: { current: number };
  scenarioAContemptProbeAskedRef: { current: boolean };
  interviewNameRef: { current: string | null };
  interviewSessionIdRef: { current: string };
  lastQuestionTextRef: { current: string | null };
  parallelStreamingTtsRef: { current: ParallelStreamingTtsState };
  /**
   * HTML long-form speak bypasses speakTextSafe — arm these so tab-hide during
   * ElevenLabs fetch / playback still queues Tap-to-continue (same as S2/S3 card speak).
   */
  ttsLineInFlightRef?: { current: boolean };
  webTtsUtteranceInFlightRef?: { current: string | null };
  showScenarioCardCanonicalPlaybackConfirmedKindsRef?: {
    current: ShowScenarioCardCanonicalPlaybackConfirmedKinds;
  };
  commitInterviewMessages: (messages: MessageWithScenario[]) => void;
  speakTextSafe: (text: string, opts: typeof ASSISTANT_INTERVIEW_SPEECH) => Promise<void>;
  setVoiceState: (state: 'idle' | 'speaking' | 'processing' | 'recording') => void;
  setIsWaiting: (waiting: boolean) => void;
  setReferenceCardPrompt?: (prompt: string | null) => void;
  setReferenceCardScenario?: (scenario: ActiveScenario | null) => void;
  setInterviewUiPhase?: (phase: InterviewUiPhase) => void;
  committedScenarioRef?: { current: ActiveScenario | null };
};

function recentAssistantCueTexts(
  deps: Scenario1ReadinessDeliveryDeps,
  messagesToUse: MessageWithScenario[],
  tailCount: number,
): string[] {
  return [
    deps.lastQuestionTextRef.current,
    deps.parallelStreamingTtsRef.current.spokenCompleteText,
    deps.parallelStreamingTtsRef.current.accumulatedFullText,
    ...messagesToUse
      .filter((m) => m.role === 'assistant')
      .slice(-tailCount)
      .map((m) => m.content ?? ''),
  ];
}

function resolveIntroParticipantFirstName(
  deps: Scenario1ReadinessDeliveryDeps,
  participantFirstNameForSpoken: string,
  messagesToUse: MessageWithScenario[],
  readinessCueTexts: string[],
): string {
  const fromRef = resolvePlausibleInterviewFirstName(deps.interviewNameRef.current);
  if (fromRef) return fromRef;
  const fromParam = resolvePlausibleInterviewFirstName(participantFirstNameForSpoken);
  if (fromParam) return fromParam;
  for (const cue of readinessCueTexts) {
    const fromCue = extractFirstNameFromIntroBriefingLead(cue ?? '');
    if (fromCue) return fromCue;
  }
  for (const m of messagesToUse) {
    if (m.role !== 'assistant') continue;
    const fromMsg = extractFirstNameFromIntroBriefingLead(m.content ?? '');
    if (fromMsg) return fromMsg;
  }
  return '';
}

/**
 * Client-injected Scenario 1 vignette after readiness assent — bypasses the model for the first situation.
 */
function readinessDeliveryBlockReason(
  deps: Scenario1ReadinessDeliveryDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): string | null {
  if (!deps.isInterviewAppRoute) return 'not_interview_route';
  if (deps.isAdmin) return 'admin';
  if (deps.status !== 'active') return 'status_not_active';
  if (deps.currentScenarioRef.current !== 1) return 'scenario_not_1';
  if (deps.scenarioAContemptProbeAskedRef.current) return 'contempt_probe_asked';
  if (!looksLikeReadinessAffirmation(trimmed)) return 'not_readiness_affirmation';
  if (userTextLooksLikeDecline(trimmed.toLowerCase())) return 'decline';
  if (transcriptHasScenario1VignetteAssistant(messagesToUse)) return 'vignette_already_present';
  if (!resolvePlausibleInterviewFirstName(deps.interviewNameRef.current)) return 'name_not_captured';
  return null;
}

export async function deliverScenario1VignetteAfterReadinessAssent(
  deps: Scenario1ReadinessDeliveryDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
  source: 'pre_claude_intro_gate' | 'post_claude_preamble_skip',
): Promise<boolean> {
  const blockReason = readinessDeliveryBlockReason(deps, trimmed, messagesToUse);
  if (blockReason) {
    return false;
  }

  const readinessCueTexts = recentAssistantCueTexts(deps, messagesToUse, 4);
  const answeringReadiness = userIsAnsweringInterviewReadinessPrompt(readinessCueTexts);
  const hasPreambleBriefingInTranscript = messagesToUse.some(
    (m) => m.role === 'assistant' && isInterviewPreambleBriefingMoment(m.content ?? ''),
  );
  const preScenarioOnly =
    !transcriptHasScenario1VignetteAssistant(messagesToUse) && hasPreambleBriefingInTranscript;
  if (!answeringReadiness && !preScenarioOnly) {
    return false;
  }

  const participantFirstName = resolveIntroParticipantFirstName(
    deps,
    participantFirstNameForSpoken,
    messagesToUse,
    readinessCueTexts,
  );
  const briefingCandidate =
    deps.parallelStreamingTtsRef.current.accumulatedFullText.trim() ||
    deps.parallelStreamingTtsRef.current.spokenCompleteText.trim() ||
    (isInterviewPreambleBriefingMoment(deps.lastQuestionTextRef.current)
      ? deps.lastQuestionTextRef.current
      : '');
  const briefingText =
    briefingCandidate.trim() || buildFallbackIntroBriefingText(participantFirstName);
  const stagedMessages = insertPreambleBriefingIfMissing(messagesToUse, briefingText);
  const vignetteBundle = buildScenario1VignetteIntroBundle(SCENARIO_1_VIGNETTE, SCENARIO_1_OPENING);
  let displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(vignetteBundle),
    participantFirstName,
  );
  displayText = ensureSpokenTextIncludesParticipantFirstName(displayText, participantFirstName, {
    allowAppendWhenMissing: true,
  });
  displayText = substituteCanonicalInterviewScenarioBodiesForTts(displayText);
  const aiMsg: MessageWithScenario = {
    role: 'assistant',
    content: displayText,
    scenarioNumber: 1,
    interviewMoment: 1,
  };
  const updatedMessages = [...stagedMessages, aiMsg];
  deps.commitInterviewMessages(updatedMessages);
  deps.currentScenarioRef.current = 1;
  deps.currentInterviewMomentRef.current = 1;
  if (participantFirstName && !deps.interviewNameRef.current) {
    deps.interviewNameRef.current = participantFirstName;
  }
  void remoteLog('[INTRO_READINESS_INTERCEPT]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    userPreview: trimmed.slice(0, 80),
    answeringReadiness,
    preScenarioOnly,
    source,
    backfilledBriefing: stagedMessages.length > messagesToUse.length,
    recoveredNameFromBriefing: participantFirstName || null,
  });
  /**
   * Arm before fetch/playback: tab-hide during the ElevenLabs gap otherwise hits
   * interrupt_early_return_inactive (no surface / ttsLine / pending) and never shows
   * Tap-to-continue. Mirror parallelStreamShowScenarioCardTts for situation_1.
   */
  if (deps.webTtsUtteranceInFlightRef) {
    deps.webTtsUtteranceInFlightRef.current = displayText;
  }
  if (deps.ttsLineInFlightRef) {
    deps.ttsLineInFlightRef.current = true;
  }
  deps.parallelStreamingTtsRef.current.accumulatedFullText = displayText;
  deps.lastQuestionTextRef.current = SCENARIO_1_OPENING;
  let htmlMp3Played = false;
  try {
    htmlMp3Played = await speakLongFormInterviewHtmlMp3({
      text: displayText,
      telemetrySource: 'turn',
      onPlaybackStarted: () => deps.setVoiceState('speaking'),
    });
  } catch {
    htmlMp3Played = false;
  }
  if (htmlMp3Played) {
    if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
      deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
        ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
        situation_1: true,
      };
    }
  } else {
    await deps.speakTextSafe(displayText, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
  }
  if (deps.webTtsUtteranceInFlightRef) {
    deps.webTtsUtteranceInFlightRef.current = null;
  }
  if (deps.ttsLineInFlightRef) {
    deps.ttsLineInFlightRef.current = false;
  }
  deps.parallelStreamingTtsRef.current.spokenCompleteText = displayText;
  deps.setReferenceCardPrompt?.(SCENARIO_1_OPENING);
  const s1Scenario: ActiveScenario = { label: 'Situation 1', text: SHOW_SCENARIO_1_VIGNETTE_EXACT };
  deps.setReferenceCardScenario?.(s1Scenario);
  if (deps.committedScenarioRef) {
    deps.committedScenarioRef.current = s1Scenario;
  }
  deps.setInterviewUiPhase?.('scenario_active');
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  markQuestionDelivered(new Date().toISOString());
  return true;
}
