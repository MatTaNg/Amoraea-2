export const NPI_ENTITLEMENT_FLOOR_THRESHOLD = 5;
export const NPI_ENTITLEMENT_FLOOR_FAIL_CODE = 'npi_entitlement_floor';

export function wouldTriggerNpiEntitlementFloor(npiScore: number | null): boolean {
  if (npiScore === null || !Number.isFinite(npiScore)) return false;
  return npiScore >= NPI_ENTITLEMENT_FLOOR_THRESHOLD;
}

export function formatNpiEntitlementFloorAdminDescription(npiScore: number): string {
  return `NPI Entitlement score of ${Math.round(npiScore)}/7 meets or exceeds the automatic fail threshold of ${NPI_ENTITLEMENT_FLOOR_THRESHOLD}. User selected entitlement and exploitativeness responses on the majority of forced-choice pairs, indicating a pattern of expecting special treatment and willingness to use others to get it. This pattern is incompatible with the mutual respect and reciprocity standards of this community.`;
}

export function isRetroactiveNpiEntitlementFloorReview(
  attempt: { gate_fail_reasons?: unknown } | null | undefined,
  npiScore: number | null,
): boolean {
  if (!attempt || !wouldTriggerNpiEntitlementFloor(npiScore)) return false;
  const raw = attempt.gate_fail_reasons;
  if (!Array.isArray(raw)) return true;
  const codes = raw.filter((x): x is string => typeof x === 'string');
  return !codes.includes(NPI_ENTITLEMENT_FLOOR_FAIL_CODE);
}
