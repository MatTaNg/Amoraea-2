import {
  isAmoraeaAdminConsoleEmail,
} from '@/constants/adminConsole';
import {
  updateUserInterviewApplication,
} from '@data/repos/usersInterviewRepo';
import {
  supabase,
} from '@data/supabase/client';
import {
  countAnsweredEmotionItems,
  emotionRecognitionRawScoreFromResponses,
  isEmotionRecognitionBatteryComplete,
} from '@features/aria/emotionRecognitionInterview';
import {
  fetchHolisticScoringOnce,
} from '@features/aria/fetchHolisticScoringOnce';
import { hydrateScenarioScoresFromAttempt } from '@features/aria/hydrateScenarioScoresFromAttempt';
import {
  markPreparingResultsSession,
} from '@features/aria/interviewLocalPersistence';
import { runAlphaModeCompletion } from '@features/aria/runAlphaModeCompletion';
import { runNoAnthropicScoringFallback } from '@features/aria/runNoAnthropicScoringFallback';
import { runScoreInterviewErrorCatchFallback } from '@features/aria/runScoreInterviewErrorCatchFallback';
import { runStandardOnboardingServerDelegate } from '@features/aria/runStandardOnboardingServerDelegate';
import {
  computeHolisticClientScoring,
  finalizeStandardHolisticClientFallback,
} from '@features/aria/scoreHolisticClientFallback';
import {
  persistInterviewAttemptSessionLifecycle,
} from '@utilities/interviewAttemptLifecycle';
import {
  remoteLog,
} from '@utilities/remoteLog';
import {
  getSessionLogRuntime,
} from '@utilities/sessionLogging';

import type { InterviewResults } from './interviewResultsTypes';
import {
  buildAnthropicMessagesHeaders,
  getAnthropicEndpoint,
} from './anthropicClientConfig';
import {
  ALPHA_MODE,
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
} from './scoreInterviewModuleConstants';
import type { ScoreInterviewDeps, ScoreInterviewParams } from './scoreInterviewTypes';

export async function runScoreInterview(
  deps: ScoreInterviewDeps,
  params: ScoreInterviewParams,
): Promise<void> {
  if (deps.scoreInterviewInFlightRef.current) {
    void remoteLog('[WARN] scoreInterview_duplicate_skipped', {
      attemptId: deps.interviewSessionAttemptIdRef.current,
    });
    return;
  }
  deps.scoreInterviewInFlightRef.current = true;
  deps.scoreInterviewAttemptedRef.current = true;
  deps.markCompletionScoringInFlight(true);
  let isOnboardingFlow = false;
  let isAdminConsoleAccount = false;
  try {
    const hydratedEmotionForScore = await deps.loadEmotionResponsesForCompletion();
    deps.applyEmotionResponsesToSession(hydratedEmotionForScore);
    if (hydratedEmotionForScore.length > 0) {
      await remoteLog('[EmotionRecognition] hydrated_for_completion', {
        attemptId: deps.interviewSessionAttemptIdRef.current,
        answeredCount: countAnsweredEmotionItems(hydratedEmotionForScore),
        batteryComplete: isEmotionRecognitionBatteryComplete(hydratedEmotionForScore),
      });
    }
    console.log(
      '[CompletionPath] client scoreInterview called for attempt:',
      deps.interviewSessionAttemptIdRef.current ?? 'pending',
    );
    await remoteLog('[1] INTERVIEW_COMPLETE scoreInterview entered', {
      isAdmin: deps.isAdmin,
      ALPHA_MODE,
      userId: deps.userId ?? null,
      interviewStatus: deps.interviewStatusRef.current,
      routeName: deps.routeName,
    });
    if (__DEV__) {
      console.log('=== [2] Entering completion handler ===');
      console.log('interviewStatus:', deps.interviewStatusRef.current);
    }

    isOnboardingFlow = deps.routeName === 'Amoraea' || deps.routeName === 'OnboardingInterview';
    const { data: authSessionForScore } = await supabase.auth.getSession();
    const sessionEmailForScore = authSessionForScore.session?.email ?? null;
    isAdminConsoleAccount =
      isAmoraeaAdminConsoleEmail(sessionEmailForScore) ||
      isAmoraeaAdminConsoleEmail(deps.userEmail) ||
      deps.isAdmin;
    const context = deps.typologyContext || 'No typology context — score from transcript only.';
    const anthropicConfigured = Boolean(ANTHROPIC_API_KEY || ANTHROPIC_PROXY_URL);
    const apiUrl = anthropicConfigured ? getAnthropicEndpoint() : '';
    const headers =
      anthropicConfigured && apiUrl
        ? buildAnthropicMessagesHeaders({ apiUrl, includeDirectHeadersWithoutKey: false })
        : { 'Content-Type': 'application/json' };
    const isStandardOnboardingApplicant =
      isOnboardingFlow && !!deps.userId && !isAdminConsoleAccount;
    const emotionRawScoreForGate = (): number | null =>
      emotionRecognitionRawScoreFromResponses(deps.emotionItemResponsesRef.current);
    const emotionResponsesForGate = (): string[] => [...deps.emotionItemResponsesRef.current];
    const fetchHolisticOnceBound = async (): Promise<InterviewResults> => {
      const { data: egoParseSession } = await supabase.auth.getSession();
      const sessionUid = egoParseSession.session?.user?.id ?? null;
      return fetchHolisticScoringOnce({
        apiUrl,
        headers,
        finalMessages: params.finalMessages,
        typologyContext: context,
        userId: deps.userId ?? null,
        attemptId: getSessionLogRuntime().attemptId ?? null,
        sessionUserId: sessionUid,
      });
    };
    const hydrateScenarioScoresFromAttemptIfNeeded = () =>
      hydrateScenarioScoresFromAttempt(deps, supabase);

    let standardDeferredHolisticForEgoCache: InterviewResults | null = null;
    if (isStandardOnboardingApplicant && anthropicConfigured) {
      const delegate = await runStandardOnboardingServerDelegate({
        deps,
        supabase,
        finalMessages: params.finalMessages,
        apiUrl,
        headers,
        typologyContext: context,
        fetchHolisticOnceBound,
        emotionRawScoreForGate,
        emotionResponsesForGate,
      });
      if (delegate.handled) return;
      standardDeferredHolisticForEgoCache = delegate.standardDeferredHolisticForEgoCache;
    }

    deps.interviewStatusRef.current = 'preparing_results';
    deps.setInterviewStatus('preparing_results');
    if (deps.userId) markPreparingResultsSession(deps.userId);
    const sessionAttemptForPoll = deps.interviewSessionAttemptIdRef.current;
    if (typeof sessionAttemptForPoll === 'string' && sessionAttemptForPoll.length > 0) {
      deps.setPendingScoringSyncAttemptId(sessionAttemptForPoll);
    }
    void persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'scoring');
    deps.setStatus('scoring');
    await remoteLog('[2] Screen set to scoring');

    if (!anthropicConfigured) {
      await runNoAnthropicScoringFallback({ deps, isOnboardingFlow, isAdminConsoleAccount });
      return;
    }

    const holisticState = await computeHolisticClientScoring({
      deps,
      supabase,
      finalMessages: params.finalMessages,
      standardDeferredHolisticCache: standardDeferredHolisticForEgoCache,
      fetchHolisticOnceBound,
      emotionRawScoreForGate,
      emotionResponsesForGate,
      hydrateScenarioScoresFromAttemptIfNeeded,
    });
    const parsed = holisticState.parsed;
    const gateResult = holisticState.gateResult;
    const weightedMin = holisticState.weightedPassMin;
    deps.setResults(parsed);
    await remoteLog('[3] Scoring complete', {
      weightedScore: gateResult?.weightedScore,
      passed: gateResult?.pass,
      pillarScores: parsed.pillarScores ?? {},
    });
    if (__DEV__) {
      console.log('=== Scoring API complete ===', 'passed:', gateResult?.pass);
    }
    if (isOnboardingFlow) {
      await updateUserInterviewApplication(deps.userId, {
        applicationStatus: 'under_review',
        onboardingStage: 'complete',
      });
      deps.queryClient.invalidateQueries({ queryKey: ['deps.profile', deps.userId] });
    }

    if (ALPHA_MODE && deps.userId) {
      const alphaSaveOk = await runAlphaModeCompletion({
        deps,
        supabase,
        finalMessages: params.finalMessages,
        parsed,
        gateResult,
        weightedMin,
        apiUrl,
        headers,
        isStandardOnboardingApplicant,
        hydrateScenarioScoresFromAttemptIfNeeded,
        emotionRawScoreForGate,
        emotionResponsesForGate,
      });
      if (!alphaSaveOk) {
        deps.setInterviewStatus('congratulations');
        deps.setStatus('results');
        return;
      }
    } else {
      await finalizeStandardHolisticClientFallback({
        deps,
        supabase,
        finalMessages: params.finalMessages,
        isStandardOnboardingApplicant,
        state: holisticState,
      });
    }
  } catch (err) {
    await runScoreInterviewErrorCatchFallback({
      deps,
      isOnboardingFlow,
      isAdminConsoleAccount,
      err,
    });
  } finally {
    deps.scoreInterviewInFlightRef.current = false;
    deps.markCompletionScoringInFlight(false);
  }
}
