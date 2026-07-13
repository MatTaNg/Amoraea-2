import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/probeAndScoringUtils';
import {
  mergeDeferredScenarioAContemptProbeLeadWithNextSentence,
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
} from '@features/aria/scenarioAContemptProbeLogic';
import {
  clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
} from '@features/aria/scenarioARepairQuestionHelpers';
import { shouldDeliverScenarioFollowUpQuestion, transcriptContainsScenarioAContemptProbe } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

export function createParallelStreamSpeakScenarioAContemptProbe(
  ctx: ParallelStreamTtsPlaybackContext,
  batch: ParallelStreamTtsBatchController,
) {
  const { deps, params, state } = ctx;
  return async function speakScenarioAContemptProbeStreamOnce() {

        const contemptProbePlaybackConfirmed =
          deps.scenarioAContemptProbePlaybackConfirmedRef.current ||
          deps.scenarioAContemptProbeTtsDeliveredSessionRef.current;
        if (state.scenarioAContemptProbeSpokenThisStream || contemptProbePlaybackConfirmed) {
          void remoteLog('[S1_CONTEMPT_PROBE_SINGLE_SPEAK_SKIPPED]', {
            spokenThisStream: state.scenarioAContemptProbeSpokenThisStream,
            askedRef: deps.scenarioAContemptProbeAskedRef.current,
            ttsDeliveredSession: deps.scenarioAContemptProbeTtsDeliveredSessionRef.current,
            playbackConfirmed: deps.scenarioAContemptProbePlaybackConfirmedRef.current,
            s1ContemptFixVersion: 16,
          });
          return;
        }
        /** Claim before any await so concurrent stream-end flush cannot double-speak. */
        state.scenarioAContemptProbeSpokenThisStream = true;
        const suppressRepairBeforeContempt = shouldSuppressScenarioARepairBeforeContemptAnswer({
          currentScenario: deps.currentScenarioRef.current,
          currentMoment: deps.currentInterviewMomentRef.current,
          shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
          scenarioAContemptProbeSpokenThisStream: true,
          scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
          specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
          scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
        });
        const batchBeforeContempt = batch.parallelTtsBatchDeduped();
        const batchDiscard = clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
          batchText: batchBeforeContempt,
          suppressRepairBeforeContempt,
          streamContemptProbeMuteArmedFromStart: ctx.streamContemptProbeMuteArmedFromStart,
        });
        if (batchDiscard.discarded) {
          state.parallelTtsBatchBuffer = '';
          state.parallelTtsBatchPrefetch = null;
          void remoteLog('[S1_BATCH_DISCARDED_BEFORE_CONTEMPT_SPEAK]', {
            preview: batchBeforeContempt.slice(0, 220),
            s1ContemptFixVersion: 21,
          });
        } else if (batchBeforeContempt.trim()) {
          batch.flushParallelTtsBatch(true);
        }
        await state.ttsChain;
        deps.recordingJustFinishedBeforeNextTtsRef.current = false;
        deps.postRecordingParallelStreamSettleRef.current = false;
        deps.parallelStreamingTtsRef.current.cancelRequested = true;
        state.ttsCancelled = true;
        await deps.stopElevenLabsPlayback();
        if (state.deferredScenarioAContemptProbeLeadSentence) {
          state.scenarioAContemptProbeStreamBuffer = mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
            state.deferredScenarioAContemptProbeLeadSentence,
            state.scenarioAContemptProbeStreamBuffer,
          );
          state.deferredScenarioAContemptProbeLeadSentence = null;
        }
        let buffered = state.scenarioAContemptProbeStreamBuffer.trim();
        state.scenarioAContemptProbeStreamBuffer = '';
        if (!buffered) {
          const full = stripControlTokens(params.textToParallelStream.full).trim();
          if (looksLikeScenarioAContemptProbeQuestion(full)) {
            buffered = full;
          } else if (ctx.streamContemptProbeMuteArmedFromStart) {
            buffered = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
          }
        }
        if (!buffered) {
          state.scenarioAContemptProbeSpokenThisStream = false;
          return;
        }
        if (
          deps.scenarioAContemptProbeAskedRef.current ||
          transcriptContainsScenarioAContemptProbe(params.messagesToUse)
        ) {
          deps.scenarioAContemptProbeAskedRef.current = true;
          void remoteLog('[S1_CONTEMPT_PROBE_STREAM_SKIPPED_TRANSCRIPT_DEDUP]', {
            preview: buffered.slice(0, 200),
            s1ContemptFixVersion: 10,
          });
          return;
        }
        const probeText = ctx.streamContemptProbeMuteArmedFromStart
          ? SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY
          : looksLikeScenarioAContemptProbeQuestion(buffered)
            ? buffered
            : SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
        if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, probeText)) {
          deps.scenarioAContemptProbeAskedRef.current = true;
          void remoteLog('[S1_CONTEMPT_PROBE_STREAM_SKIPPED_TRANSCRIPT_DEDUP]', {
            preview: probeText.slice(0, 200),
            s1ContemptFixVersion: 10,
          });
          return;
        }
        const probeTextForTts = SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
        }
        deps.setReferenceCardPrompt(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
        void remoteLog('[S1_CONTEMPT_PROBE_SINGLE_SPEAK]', {
          preview: probeTextForTts.slice(0, 240),
          usedCanonicalCopy: ctx.streamContemptProbeMuteArmedFromStart,
          bufferedPreview: buffered.slice(0, 200),
          s1ContemptFixVersion: 17,
        });
        await deps.speakTextSafe(probeTextForTts, ASSISTANT_INTERVIEW_SPEECH);
        deps.parallelStreamingTtsRef.current.spokenCompleteText =
          SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
        deps.scenarioAContemptProbeTtsDeliveredSessionRef.current = true;
        deps.scenarioAContemptProbeAskedRef.current = true;
        params.textToParallelStream.spokenStarted = true;
        deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(
          SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        );
        if (deps.referenceCardShouldUpdateOnPlaybackStart(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)) {
          deps.applyReferenceCardFromAssistantSpeechRef.current(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
        }
      
  };
}
