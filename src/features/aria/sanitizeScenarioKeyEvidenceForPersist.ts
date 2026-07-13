import type { ScenarioAttemptScoreBundle } from '@utilities/interviewAttemptScenarioPersistence';

const LEVEL_TAG_LEAK_PATTERN = /Level tag missing/i;

/** Strip internal QA validation text that must never be stored in keyEvidence. */
export function stripLegacyLevelTagLeakFromEvidence(ev: string): string {
  return ev
    .split('|')
    .map((p) => p.trim())
    .filter((p) => !LEVEL_TAG_LEAK_PATTERN.test(p))
    .join(' | ')
    .trim();
}

export function sanitizeScenarioKeyEvidenceRecord(
  keyEvidence: Record<string, string> | undefined | null,
): Record<string, string> {
  if (!keyEvidence || typeof keyEvidence !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [marker, raw] of Object.entries(keyEvidence)) {
    if (typeof raw !== 'string') continue;
    const cleaned = stripLegacyLevelTagLeakFromEvidence(raw);
    if (cleaned) out[marker] = cleaned;
  }
  return out;
}

/** Sanitize scenario score bundle immediately before DB persist. */
export function sanitizeScenarioScoreBundleForPersist(
  bundle: ScenarioAttemptScoreBundle,
): ScenarioAttemptScoreBundle {
  return {
    ...bundle,
    keyEvidence: sanitizeScenarioKeyEvidenceRecord(bundle.keyEvidence),
  };
}

export function storedKeyEvidenceHasLevelTagLeak(keyEvidence: unknown): boolean {
  if (!keyEvidence || typeof keyEvidence !== 'object' || Array.isArray(keyEvidence)) return false;
  return Object.values(keyEvidence as Record<string, unknown>).some(
    (v) => typeof v === 'string' && LEVEL_TAG_LEAK_PATTERN.test(v),
  );
}
