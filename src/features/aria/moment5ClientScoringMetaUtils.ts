import type { MutableRefObject } from 'react';

import type { Moment5ClientScoringMetadata } from '@features/aria/moment5AccountabilityScoringPrompt';

/** Fallback when gate refs were not populated before scoring or persist. */
export function resolveMoment5ClientScoringMeta(
  metaRef: MutableRefObject<Moment5ClientScoringMetadata | null | unknown>,
  probeFiredRef: MutableRefObject<boolean>,
  options?: { includeWarmAckFallback?: boolean },
): Moment5ClientScoringMetadata {
  const stored = metaRef.current as Moment5ClientScoringMetadata | null;
  if (stored) return stored;
  const probeFired = probeFiredRef.current;
  return {
    accountabilityProbeFired: probeFired,
    probeTriggerReason: probeFired ? 'lacks_explicit_self_accountability' : undefined,
    ...(options?.includeWarmAckFallback && probeFired ? { warmAckBeforeAccountabilityProbe: true } : {}),
  };
}
