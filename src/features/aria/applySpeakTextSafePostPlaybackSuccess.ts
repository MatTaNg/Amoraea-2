import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { looksLikeInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { markInterviewClosingTtsDelivered } from '@features/aria/interviewClosingTtsSession';
import { markSpeakTextSafeSuccessfulDelivery } from '@features/aria/speakTextSafeSuccessfulDelivery';
import {
  isShowScenarioCardCanonicalDeliveryText,
  isShowScenarioCardCanonicalPlaybackConfirmed,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';

export function applySpeakTextSafePostPlaybackSuccess(args: {
  text: string;
  silent: boolean;
  skipDeliveryForTabInterrupt: boolean;
  interviewSpeechRole?: 'assistant_response';
  skipInterviewSpeechAdvance: boolean;
  applyInterviewSpeechComplete: (rawText: string) => void;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  lastSuccessfulTtsDeliveredPreviewRef: MutableRefObject<string>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef: MutableRefObject<ShowScenarioCardCanonicalPlaybackConfirmedKinds>;
  closingTtsSessionKey: string;
}): void {
  const canonicalKind = isShowScenarioCardCanonicalDeliveryText(args.text);
  const confirmedKinds = args.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current;
  const canonicalPlaybackConfirmed =
    !canonicalKind ||
    (confirmedKinds != null &&
      isShowScenarioCardCanonicalPlaybackConfirmed(confirmedKinds, canonicalKind));

  if (
    !args.skipDeliveryForTabInterrupt &&
    args.interviewSpeechRole === 'assistant_response' &&
    !args.skipInterviewSpeechAdvance &&
    canonicalPlaybackConfirmed
  ) {
    args.applyInterviewSpeechComplete(args.text);
  }

  if (args.silent || args.skipDeliveryForTabInterrupt || !canonicalPlaybackConfirmed) {
    return;
  }

  markSpeakTextSafeSuccessfulDelivery({
    text: args.text,
    silent: args.silent,
    lastSuccessfulTtsTextNormalizedRef: args.lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef: args.lastSuccessfulTtsDeliveredPreviewRef,
    scenarioAContemptProbeTtsDeliveredSessionRef: args.scenarioAContemptProbeTtsDeliveredSessionRef,
    scenarioAContemptProbePlaybackConfirmedRef: args.scenarioAContemptProbePlaybackConfirmedRef,
  });

  if (looksLikeInterviewClosingAssistantMessage(stripControlTokens(args.text).trim())) {
    markInterviewClosingTtsDelivered(args.closingTtsSessionKey, args.text);
  }
}
