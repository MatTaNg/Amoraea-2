export type Moment4RelationshipType = 'close' | 'non_close' | 'mixed' | 'unknown';

export function evaluateMoment4RelationshipType(text: string): {
  relationshipType: Moment4RelationshipType;
  closeSignals: string[];
  nonCloseSignals: string[];
} {
  const t = (text ?? '').toLowerCase();
  const closeChecks: Array<{ id: string; re: RegExp }> = [
    { id: 'romantic_partner', re: /\b(ex[- ]?partner|partner|wife|husband|boyfriend|girlfriend|fiance|spouse)\b/ },
    { id: 'close_friend', re: /\b(close friend|best friend)\b/ },
    { id: 'family', re: /\b(mom|mother|dad|father|sister|brother|family|aunt|uncle|cousin|son|daughter)\b/ },
  ];
  const nonCloseChecks: Array<{ id: string; re: RegExp }> = [
    { id: 'coworker', re: /\b(coworker|co-worker|colleague|workmate|work friend|work partner)\b/ },
    { id: 'boss_or_manager', re: /\b(boss|manager|supervisor)\b/ },
    { id: 'acquaintance', re: /\b(acquaintance|neighbor|client|customer)\b/ },
  ];
  const closeSignals = closeChecks.filter((c) => c.re.test(t)).map((c) => c.id);
  const nonCloseSignals = nonCloseChecks.filter((c) => c.re.test(t)).map((c) => c.id);
  const relationshipType: Moment4RelationshipType =
    closeSignals.length > 0 && nonCloseSignals.length === 0
      ? 'close'
      : closeSignals.length === 0 && nonCloseSignals.length > 0
        ? 'non_close'
        : closeSignals.length > 0 && nonCloseSignals.length > 0
          ? 'mixed'
          : 'unknown';
  return { relationshipType, closeSignals, nonCloseSignals };
}

export function shouldForceMoment4ThresholdProbe(params: {
  relationshipType: Moment4RelationshipType;
  thresholdAlreadyProvided: boolean;
  probeAlreadyAsked: boolean;
  isMoment4: boolean;
}): boolean {
  return (
    params.isMoment4 &&
    params.relationshipType === 'close' &&
    !params.thresholdAlreadyProvided &&
    !params.probeAlreadyAsked
  );
}

