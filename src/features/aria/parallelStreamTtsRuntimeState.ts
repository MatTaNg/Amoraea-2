export type ParallelStreamTtsBatchPrefetch = {
  text: string;
  promise: Promise<ArrayBuffer | null>;
};

/** Mutable turn-local state for parallel Claude SSE → TTS playback. */
export type ParallelStreamTtsRuntimeState = {
  streamContemptProbeMuteActive: boolean;
  sentenceBuffer: string;
  deferredScenarioVignetteTailForOpeningMerge: string | null;
  deferredWarmBoundarySentence: string | null;
  deferredScenarioARepairLeadSentence: string | null;
  deferredScenarioARepairShortAckSentence: string | null;
  deferredScenarioBJamesShortAckSentence: string | null;
  deferredScenarioBJamesDifferentlyLeadSentence: string | null;
  deferredScenarioBJamesSayToJamesLeadSentence: string | null;
  deferredScenarioAContemptProbeLeadSentence: string | null;
  deferredInterviewClosingLeadSentence: string | null;
  moment5ClosingStreamBuffer: string;
  moment5StickyCloseBufferAll: boolean;
  scenarioAContemptProbeSpokenThisStream: boolean;
  scenarioARepairQuestionSpokenThisStream: boolean;
  interviewClosingSpokenThisStream: boolean;
  scenarioAContemptProbeStreamBuffer: string;
  streamShowScenarioCardMuteActive: boolean;
  showScenarioCardStreamBuffer: string;
  showScenarioCardCanonicalSpokenThisStream: boolean;
  showScenarioCardTransitionPrefixSpoken: boolean;
  scenarioCSophiePerspectiveProbeSpokenThisStream: boolean;
  scenarioBJamesRepairQuestionSpokenThisStream: boolean;
  scenarioCRepairQuestionSpokenThisStream: boolean;
  deferredScenarioCShortAckSentence: string | null;
  pendingScenarioCNextProbeFlush: boolean;
  ttsChain: Promise<void>;
  ttsCancelled: boolean;
  firstSentenceLogged: boolean;
  parallelStreamSentenceIndex: number;
  parallelTtsBatchBuffer: string;
  parallelTtsBatchPrefetch: ParallelStreamTtsBatchPrefetch | null;
  lastParallelStreamSentenceNorm: string | null;
  introBriefingReadinessQueuedThisStream: boolean;
  streamMoveAckPrepended: boolean;
  pendingS1RepairSatisfiedHandoff: boolean;
  s1RepairSatisfiedHandoffSpokenThisStream: boolean;
  pendingS2RepairSatisfiedHandoff: boolean;
  s2RepairSatisfiedHandoffSpokenThisStream: boolean;
  pendingScenarioARepairAfterContemptFlush: boolean;
};

export function createParallelStreamTtsRuntimeState(args: {
  streamContemptProbeMuteActive: boolean;
  moment5StickyCloseBufferAll: boolean;
  streamShowScenarioCardMuteActive?: boolean;
}): ParallelStreamTtsRuntimeState {
  return {
    streamContemptProbeMuteActive: args.streamContemptProbeMuteActive,
    sentenceBuffer: '',
    deferredScenarioVignetteTailForOpeningMerge: null,
    deferredWarmBoundarySentence: null,
    deferredScenarioARepairLeadSentence: null,
    deferredScenarioARepairShortAckSentence: null,
    deferredScenarioBJamesShortAckSentence: null,
    deferredScenarioBJamesDifferentlyLeadSentence: null,
    deferredScenarioBJamesSayToJamesLeadSentence: null,
    deferredScenarioAContemptProbeLeadSentence: null,
    deferredInterviewClosingLeadSentence: null,
    moment5ClosingStreamBuffer: '',
    moment5StickyCloseBufferAll: args.moment5StickyCloseBufferAll,
    scenarioAContemptProbeSpokenThisStream: false,
    scenarioARepairQuestionSpokenThisStream: false,
    interviewClosingSpokenThisStream: false,
    scenarioAContemptProbeStreamBuffer: '',
    streamShowScenarioCardMuteActive: args.streamShowScenarioCardMuteActive ?? false,
    showScenarioCardStreamBuffer: '',
    showScenarioCardCanonicalSpokenThisStream: false,
    showScenarioCardTransitionPrefixSpoken: false,
    ttsChain: Promise.resolve(),
    ttsCancelled: false,
    firstSentenceLogged: false,
    parallelStreamSentenceIndex: 0,
    parallelTtsBatchBuffer: '',
    parallelTtsBatchPrefetch: null,
    lastParallelStreamSentenceNorm: null,
    introBriefingReadinessQueuedThisStream: false,
    streamMoveAckPrepended: false,
    pendingS1RepairSatisfiedHandoff: false,
    s1RepairSatisfiedHandoffSpokenThisStream: false,
    pendingS2RepairSatisfiedHandoff: false,
    s2RepairSatisfiedHandoffSpokenThisStream: false,
    pendingScenarioARepairAfterContemptFlush: false,
    scenarioCSophiePerspectiveProbeSpokenThisStream: false,
    scenarioBJamesRepairQuestionSpokenThisStream: false,
    scenarioCRepairQuestionSpokenThisStream: false,
    deferredScenarioCShortAckSentence: null,
    pendingScenarioCNextProbeFlush: false,
  };
}

export type ParallelStreamTtsPlaybackContext = {
  deps: import('./claudeParallelStreamTtsCallTypes').ClaudeParallelStreamTtsCallDeps;
  params: import('./claudeParallelStreamTtsCallTypes').ClaudeParallelStreamTtsCallParams;
  state: ParallelStreamTtsRuntimeState;
  postRecordingSettleForThisParallelStream: boolean;
  closingAlreadyInTranscriptForStream: boolean;
  streamContemptProbeMuteArmedFromStart: boolean;
  streamS3ToM4HandoffMuteArmedFromStart: boolean;
};
