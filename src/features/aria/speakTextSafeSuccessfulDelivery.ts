import type { MutableRefObject } from 'react';

import { normalizeTtsTextForConsecutiveDedup, stripControlTokens } from '@features/aria/interviewControlTokens';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';

export type SpeakTextSafeTtsTriggerSource =
  | 'gesture_handler'
  | 'effect'
  | 'callback'
  | 'timeout'
  | 'preauthorized_element';

export function markSpeakTextSafeSuccessfulDelivery(args: {
  text: string;
  silent: boolean;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  lastSuccessfulTtsDeliveredPreviewRef: MutableRefObject<string>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
}): void {
  if (args.silent) return;
  const nOk = normalizeTtsTextForConsecutiveDedup(args.text);
  if (nOk.length > 0) {
    if (args.lastSuccessfulTtsTextNormalizedRef) {
      args.lastSuccessfulTtsTextNormalizedRef.current = nOk;
    }
    if (args.lastSuccessfulTtsDeliveredPreviewRef) {
      args.lastSuccessfulTtsDeliveredPreviewRef.current = stripControlTokens(args.text).trim().slice(0, 100);
    }
  }
  if (looksLikeScenarioAContemptProbeQuestion(stripControlTokens(args.text).trim())) {
    if (args.scenarioAContemptProbeTtsDeliveredSessionRef) {
      args.scenarioAContemptProbeTtsDeliveredSessionRef.current = true;
    }
    if (args.scenarioAContemptProbePlaybackConfirmedRef) {
      args.scenarioAContemptProbePlaybackConfirmedRef.current = true;
    }
  }
}
