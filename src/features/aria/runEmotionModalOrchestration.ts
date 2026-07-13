import { supabase } from '@data/supabase/client';
import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  buildEmotionRecognitionPersistPayload,
  completedScenarioForEmotionModalFromTransition,
  countAnsweredEmotionItems,
  emotionModalIndexForCompletedScenario,
  hydrateEmotionResponsesFromSources,
  isEmotionItemAnsweredAt,
  isEmotionRecognitionBatteryComplete,
  isNaturalLanguageScenarioHandoffTransition,
  isScenarioThreeToMoment4EmotionModalHandoff,
  setEmotionResponseAtIndex,
  shouldDeferEmotionModalForTransitionText,
  splitScenarioTransitionForEmotionModal,
} from '@features/aria/emotionRecognitionInterview';
import type { EmotionModalOrchestrationDeps, EmotionModalAfterScenarioTransitionOpts } from '@features/aria/emotionModalOrchestrationTypes';
import { remoteLog } from '@utilities/remoteLog';
import { loadInterviewFromStorage, saveInterviewToStorage } from '@utilities/storage/InterviewStorage';

export async function runLoadEmotionResponsesForCompletion(
  deps: EmotionModalOrchestrationDeps,
  attemptId?: string | null,
): Promise<string[]> {
  const { userId, interviewSessionAttemptIdRef, emotionItemResponsesRef } = deps;
      if (!userId) return [];
      const aid = attemptId ?? interviewSessionAttemptIdRef.current;
      const sources: unknown[] = [[...emotionItemResponsesRef.current]];
      const saved = await loadInterviewFromStorage(userId);
      if (saved?.emotionItemResponses != null) sources.push(saved.emotionItemResponses);
      if (typeof aid === 'string' && aid.length > 0) {
        const { data } = await supabase
          .from('interview_attempts')
          .select('emotion_recognition_responses')
          .eq('id', aid)
          .eq('user_id', userId)
          .maybeSingle();
        if (data?.emotion_recognition_responses != null) {
          sources.push(data.emotion_recognition_responses);
        }
      }
      return hydrateEmotionResponsesFromSources(...sources);
}

export function runApplyEmotionResponsesToSession(
  deps: EmotionModalOrchestrationDeps,
  hydrated: string[],
): void {
  const { emotionItemResponsesRef, setEmotionItemResponses, setEmotionItemsComplete } = deps;
    if (hydrated.length === 0) return;
    emotionItemResponsesRef.current = hydrated;
    setEmotionItemResponses(hydrated);
    setEmotionItemsComplete(
      countAnsweredEmotionItems(hydrated) >= EMOTION_INTERVIEW_MODAL_ITEMS.length,
    );
}

export async function runPersistEmotionResponsesPartial(
  deps: EmotionModalOrchestrationDeps,
): Promise<void> {
  const {
    userId,
    interviewSessionAttemptIdRef,
    emotionItemResponsesRef,
  } = deps;
    const attemptId = interviewSessionAttemptIdRef.current;
    const snap = [...emotionItemResponsesRef.current];
    if (!userId || countAnsweredEmotionItems(snap) === 0) return;

    const prior = await loadInterviewFromStorage(userId);
    if (prior) {
      await saveInterviewToStorage(userId, {
        ...prior,
        emotionItemResponses: snap,
      });
    }

    if (!attemptId || !isEmotionRecognitionBatteryComplete(snap)) return;

    const payload = buildEmotionRecognitionPersistPayload(snap);
    const { error } = await supabase
      .from('interview_attempts')
      .update(payload)
      .eq('id', attemptId)
      .eq('user_id', userId);
    if (error) {
      console.warn('[EmotionModal] complete-battery persist failed:', error.message);
    }
}

export function runHandleEmotionInterviewAnswer(
  deps: EmotionModalOrchestrationDeps,
  letter: string,
): void {
  const {
    emotionModalOpenForIndexRef,
    emotionModalTimeoutRef,
    emotionItemResponsesRef,
    setEmotionItemResponses,
    setEmotionItemsComplete,
    setEmotionModalVisible,
    emotionModalPendingTransitionRef,
    emotionModalResolveRef,
  } = deps;
      const idx = emotionModalOpenForIndexRef.current;
      console.log('[EmotionModal] answer received:', letter, 'for index:', idx);

      const timeout = emotionModalTimeoutRef.current;
      if (timeout) {
        clearTimeout(timeout);
        emotionModalTimeoutRef.current = null;
      }

      const newResponses = setEmotionResponseAtIndex(
        emotionItemResponsesRef.current,
        idx,
        letter,
      );
      emotionItemResponsesRef.current = newResponses;

      setEmotionItemResponses(newResponses);

      if (countAnsweredEmotionItems(newResponses) >= EMOTION_INTERVIEW_MODAL_ITEMS.length) {
        setEmotionItemsComplete(true);
        console.log('[EmotionModal] all three complete:', newResponses);
      }

      void runPersistEmotionResponsesPartial(deps);

      setEmotionModalVisible(false);
      emotionModalPendingTransitionRef.current = false;

      const resolve = emotionModalResolveRef.current;
      emotionModalResolveRef.current = null;
      if (resolve) {
        console.log('[EmotionModal] resolving transition promise');
        resolve();
      } else {
        console.warn('[EmotionModal] resolve ref was null — transition may hang');
      }
}

export async function runAwaitEmotionModalForIndex(
  deps: EmotionModalOrchestrationDeps,
  itemIndex: number,
): Promise<void> {
  const {
    emotionItemResponsesRef,
    emotionModalTimeoutRef,
    emotionModalResolveRef,
    emotionModalOpenForIndexRef,
    emotionModalPendingTransitionRef,
    setEmotionModalItemIndex,
    setEmotionModalVisible,
  } = deps;
    if (itemIndex < 0 || itemIndex > 2) return;
    if (isEmotionItemAnsweredAt(emotionItemResponsesRef.current, itemIndex)) {
      console.log('[EmotionModal] index', itemIndex, 'already answered, skipping');
      return;
    }

    if (emotionModalTimeoutRef.current) {
      clearTimeout(emotionModalTimeoutRef.current);
      emotionModalTimeoutRef.current = null;
    }
    const priorResolve = emotionModalResolveRef.current;
    if (priorResolve) {
      console.warn('[EmotionModal] clearing stale pending resolve before opening modal');
      emotionModalResolveRef.current = null;
      priorResolve();
    }

    await new Promise<void>((resolve) => {
      emotionModalOpenForIndexRef.current = itemIndex;
      emotionModalResolveRef.current = resolve;
      emotionModalPendingTransitionRef.current = true;
      setEmotionModalItemIndex(itemIndex as 0 | 1 | 2);
      setEmotionModalVisible(true);
      // #region agent log
      fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d27a'},body:JSON.stringify({sessionId:'28d27a',location:'runEmotionModalOrchestration.ts:visible',message:'emotion_modal_visible_set',data:{itemIndex},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      console.log('[EmotionModal] setEmotionModalVisible(true) called');

      console.log('[EmotionModal] modal set visible for index:', itemIndex);
    });
}

export async function runMaybeAwaitEmotionAfterScenarioTransition(
  deps: EmotionModalOrchestrationDeps,
  sn: 1 | 2 | 3,
): Promise<void> {
  const { emotionItemResponsesRef, emotionItemsComplete } = deps;
    console.log('[EmotionModal] maybeAwait implementation called, sn:', sn);

    const refLen = emotionItemResponsesRef.current.length;
    if (__DEV__) {
      console.log('[EmotionModal] emotionItemResponses length:', refLen, 'emotionItemsComplete:', emotionItemsComplete);
    }

    if (countAnsweredEmotionItems(emotionItemResponsesRef.current) >= EMOTION_INTERVIEW_MODAL_ITEMS.length) {
      console.log('[EmotionModal] already complete, skipping');
      return;
    }

    const itemIndex = emotionModalIndexForCompletedScenario(sn);
    if (isEmotionItemAnsweredAt(emotionItemResponsesRef.current, itemIndex)) {
      console.log('[EmotionModal] index', itemIndex, 'already answered, skipping');
      return;
    }
    console.log('[EmotionModal] opening modal index:', itemIndex, 'after scenario:', sn);
    await runAwaitEmotionModalForIndex(deps, itemIndex);
}

export async function runEmotionModalAfterScenarioTransition(
  deps: EmotionModalOrchestrationDeps,
  scenarioNum: 1 | 2 | 3,
  opts?: EmotionModalAfterScenarioTransitionOpts,
): Promise<void> {
  const {
    emotionModalShownForScenarioRef,
    waitForWebInterviewTtsQuiescentBeforeEmotionModal,
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
  } = deps;
      void remoteLog('[EMOTION_MODAL] transition_modal_attempt', {
        scenarioNum,
        priorScenario: opts?.priorScenario ?? null,
        preview: (opts?.transitionText ?? '').slice(0, 220),
      });
      const transitionText = opts?.transitionText?.trim() ?? '';
      let completed = scenarioNum;
      if (transitionText.length > 0) {
        completed = completedScenarioForEmotionModalFromTransition({
          declaredComplete: scenarioNum,
          transitionText,
          priorScenario: opts?.priorScenario ?? null,
        });
        if (completed !== scenarioNum) {
          void remoteLog('[EMOTION_MODAL] reconciled_completed_scenario', {
            declared: scenarioNum,
            reconciled: completed,
            priorScenario: opts?.priorScenario ?? null,
          });
        }
      }
      if (emotionModalShownForScenarioRef.current.has(completed)) {
        void remoteLog('[EMOTION_MODAL] transition_modal_skip_duplicate', { completed });
        return;
      }
      // #region agent log
      const _modalWaitStartedAt = Date.now();
      fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d27a'},body:JSON.stringify({sessionId:'28d27a',location:'runEmotionModalOrchestration.ts:pre_wait',message:'emotion_modal_pre_tts_wait',data:{completed,afterBeforeModalPlayback:!!opts?.afterBeforeModalPlayback,waitMode:opts?.afterBeforeModalPlayback?'audible':'quiescent'},timestamp:_modalWaitStartedAt,hypothesisId:'H1,H4'})}).catch(()=>{});
      // #endregion
      if (opts?.afterBeforeModalPlayback) {
        await waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal();
      } else {
        await waitForWebInterviewTtsQuiescentBeforeEmotionModal();
      }
      // #region agent log
      fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d27a'},body:JSON.stringify({sessionId:'28d27a',location:'runEmotionModalOrchestration.ts:post_wait',message:'emotion_modal_post_tts_wait',data:{completed,waitMs:Date.now()-_modalWaitStartedAt},timestamp:Date.now(),hypothesisId:'H1,H4'})}).catch(()=>{});
      // #endregion
      if (emotionModalShownForScenarioRef.current.has(completed)) {
        void remoteLog('[EMOTION_MODAL] transition_modal_skip_duplicate_post_quiesce', { completed });
        return;
      }
      emotionModalShownForScenarioRef.current.add(completed);
      console.log('[EmotionModal] calling maybeAwait for scenario:', completed);
      await runMaybeAwaitEmotionAfterScenarioTransition(deps, completed);
      console.log('[EmotionModal] maybeAwait resolved for scenario:', completed);
}

export async function runTryRunEmotionModalFromScenarioTransition(
  deps: EmotionModalOrchestrationDeps,
  params: {
    completedScenario: 1 | 2 | 3;
    transitionText: string;
    priorScenario: 1 | 2 | 3 | null;
    source: string;
  },
): Promise<void> {
  const {
    isInterviewAppRoute,
    isAdmin,
    statusRef,
    emotionModalShownForScenarioRef,
    pendingEmotionModalTransitionRef,
  } = deps;
  const { completedScenario, transitionText, priorScenario, source } = params;
      if (!isInterviewAppRoute || isAdmin) return;
      if (statusRef.current !== 'active') {
        void remoteLog('[EMOTION_MODAL] skip_inactive_status', {
          source,
          status: statusRef.current,
          completedScenario,
        });
        return;
      }
      const trimmed = transitionText.trim();
      if (!trimmed) return;

      const handoff = isNaturalLanguageScenarioHandoffTransition(trimmed);
      const tokenHandoff = /\[SCENARIO_COMPLETE:\s*[123]\]/i.test(trimmed);
      const moment4Handoff = isScenarioThreeToMoment4EmotionModalHandoff(trimmed);
      if (!handoff && !tokenHandoff && !moment4Handoff) {
        void remoteLog('[EMOTION_MODAL] skip_not_handoff', {
          source,
          preview: trimmed.slice(0, 160),
        });
        return;
      }

      const reconciled = completedScenarioForEmotionModalFromTransition({
        declaredComplete: completedScenario,
        transitionText: trimmed,
        priorScenario,
      });
      if (emotionModalShownForScenarioRef.current.has(reconciled)) {
        void remoteLog('[EMOTION_MODAL] skip_already_scheduled', { source, reconciled });
        return;
      }

      const defer = shouldDeferEmotionModalForTransitionText(trimmed);
      const { afterModal } = splitScenarioTransitionForEmotionModal(trimmed);
      if (defer && afterModal.trim()) {
        pendingEmotionModalTransitionRef.current = {
          completedScenario: reconciled,
          afterModal,
          transitionText: trimmed,
          priorScenario,
        };
        void remoteLog('[EMOTION_MODAL] deferred_to_user_answer', { source, reconciled });
        return;
      }
      if (defer) {
        void remoteLog('[EMOTION_MODAL] skip_deferred_no_tail', { source, reconciled });
        return;
      }

      void remoteLog('[EMOTION_MODAL] scheduled_from_scenario_transition', {
        source,
        reconciled,
        handoff,
        tokenHandoff,
        moment4Handoff,
        preview: trimmed.slice(0, 220),
      });
      await runEmotionModalAfterScenarioTransition(deps, reconciled, {
        transitionText: trimmed,
        priorScenario,
        afterBeforeModalPlayback: handoff || tokenHandoff || moment4Handoff,
      });
}
