import { useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { AriaInterviewCoreLayerScreenRefs } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import { composeAriaInterviewCoreSyncContextLayerFromScreen } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import {
  createInterviewTtsPipelineSyncCtxFromScreen,
  type InterviewTtsPipelineScreenRefs,
} from '@features/aria/buildAriaInterviewClusterScreenParams';
import { runReferenceCardShouldUpdateOnPlaybackStart } from '@features/aria/runReferenceCardFromAssistantSpeech';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import { useInterviewSpeakTextSafe } from '@features/aria/hooks/useInterviewSpeakTextSafe';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import { syncAriaInterviewTtsPipelineDeps } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewTtsPipelineDepScreenRefs = Omit<
  InterviewTtsPipelineScreenRefs,
  'referenceCardShouldUpdateOnPlaybackStart'
>;

export type AriaInterviewCoreTtsDepSyncWiringParams = Omit<AriaInterviewCoreLayerScreenRefs, 'coreLocal'> & {
  coreLocal: Omit<AriaInterviewCoreLayerScreenRefs['coreLocal'], 'speakTextSafe'>;
  ttsPipeline: InterviewTtsPipelineDepScreenRefs;
};

/** Compose core sync layers, wire speak-text-safe + TTS pipeline dep refs each render. */
export function useAriaInterviewCoreTtsDepSyncWiring(params: AriaInterviewCoreTtsDepSyncWiringParams) {
  const { ttsPipeline, coreLocal, ...coreLayerRefs } = params;

  const speakTextSafeDepsRef = useRef({} as SpeakTextSafeDeps);
  const claudeParallelStreamTtsDepsRef = useRef({} as ClaudeParallelStreamTtsCallDeps);
  const { speakTextSafe } = useInterviewSpeakTextSafe(speakTextSafeDepsRef);

  const {
    coreCtx: ariaInterviewCoreSyncCtx,
    coreGateCtx: ariaInterviewCoreGateSyncCtx,
    coreGateServicesBaseCtx: ariaInterviewCoreGateServicesBaseSyncCtx,
    coreGateServicesFullCtx: ariaInterviewCoreGateServicesFullSyncCtx,
  } = composeAriaInterviewCoreSyncContextLayerFromScreen({
    ...coreLayerRefs,
    coreLocal: {
      ...coreLocal,
      speakTextSafe,
    },
  });

  const ttsPipelineSyncBaseCtx = mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(coreLayerRefs.runtimeGateCtx, ariaInterviewCoreSyncCtx),
    coreLayerRefs.gateCtx,
  );

  syncAriaInterviewTtsPipelineDeps(
    { speakTextSafeDepsRef, claudeParallelStreamTtsDepsRef },
    createInterviewTtsPipelineSyncCtxFromScreen(ttsPipelineSyncBaseCtx, {
      ...ttsPipeline,
      referenceCardShouldUpdateOnPlaybackStart: runReferenceCardShouldUpdateOnPlaybackStart,
    }),
  );

  return {
    speakTextSafe,
    ariaInterviewCoreSyncCtx,
    ariaInterviewCoreGateSyncCtx,
    ariaInterviewCoreGateServicesBaseSyncCtx,
    ariaInterviewCoreGateServicesFullSyncCtx,
    speakTextSafeDepsRef: speakTextSafeDepsRef as MutableRefObject<SpeakTextSafeDeps>,
    claudeParallelStreamTtsDepsRef: claudeParallelStreamTtsDepsRef as MutableRefObject<ClaudeParallelStreamTtsCallDeps>,
  };
}
