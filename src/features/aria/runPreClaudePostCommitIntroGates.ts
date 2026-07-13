import { userTextLooksLikeDecline } from '@features/aria/interviewControlTokens';

import { deliverScenario1VignetteAfterReadinessAssent } from '@features/aria/deliverScenario1AfterReadinessAssent';

import {

  isInterviewExitConfirmationMoment,

  looksLikeInterviewExitDecline,

  looksLikeReadinessAffirmation,

} from '@features/aria/interviewLanguageGate';

import { transcriptHasScenario1VignetteAssistant } from '@features/aria/interviewPreambleBriefing';

import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';

import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';

import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

import { remoteLog } from '@utilities/remoteLog';



export type PreClaudePostCommitIntroGatesResult = {

  handled: boolean;

};



function recentAssistantCueTexts(

  deps: PreClaudeTurnGateDeps,

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



/**

 * Post-commit intro intercepts: exit-decline → readiness prompt, then readiness → Scenario 1 vignette.

 */

export async function runPreClaudePostCommitIntroGates(

  deps: PreClaudeTurnGateDeps,

  trimmed: string,

  messagesToUse: MessageWithScenario[],

  participantFirstNameForSpoken: string,

): Promise<PreClaudePostCommitIntroGatesResult> {

  if (!deps.isInterviewAppRoute || deps.isAdmin || deps.status !== 'active') {

    return { handled: false };

  }



  const exitDeclineCueTexts = recentAssistantCueTexts(deps, messagesToUse, 3);

  const answeringExitDecline =

    exitDeclineCueTexts.some((t) => isInterviewExitConfirmationMoment(t)) &&

    looksLikeInterviewExitDecline(trimmed);

  if (

    deps.currentInterviewMomentRef.current === 1 &&

    !transcriptHasScenario1VignetteAssistant(messagesToUse) &&

    answeringExitDecline

  ) {

    const readinessPrompt = `Great, I'm here. Are you ready to start with the first situation?`;

    const aiMsg: MessageWithScenario = {

      role: 'assistant',

      content: readinessPrompt,

      scenarioNumber: 1,

      interviewMoment: 1,

    };

    const updatedMessages = [...messagesToUse, aiMsg];

    deps.commitInterviewMessages(updatedMessages);

    void remoteLog('[INTRO_EXIT_DECLINE_INTERCEPT]', {

      interviewSessionId: deps.interviewSessionIdRef.current,

      userPreview: trimmed.slice(0, 80),

    });

    await deps.speakTextSafe(readinessPrompt, ASSISTANT_INTERVIEW_SPEECH);

    deps.setVoiceState('idle');

    deps.setIsWaiting(false);

    return { handled: true };

  }



  if (

    deps.currentScenarioRef.current === 1 &&

    !deps.scenarioAContemptProbeAskedRef.current &&

    looksLikeReadinessAffirmation(trimmed) &&

    !userTextLooksLikeDecline(trimmed.toLowerCase()) &&

    !transcriptHasScenario1VignetteAssistant(messagesToUse)

  ) {

    const delivered = await deliverScenario1VignetteAfterReadinessAssent(

      deps,

      trimmed,

      messagesToUse,

      participantFirstNameForSpoken,

      'pre_claude_intro_gate',

    );

    if (delivered) {

      return { handled: true };

    }

  }



  return { handled: false };

}

