export const SD3_NARCISSISM_FLOOR_THRESHOLD = 4.0;
export const SD3_NARCISSISM_STRAIGHT_LINE_FLAG = 'sd3_narcissism_straight_line';
export const SD3_NARCISSISM_FLOOR_FAIL_CODE = 'sd3_narcissism_floor';
export const SD3_NARCISSISM_ITEM_COUNT = 9;

export function isSd3NarcissismStraightLineFlagActive(
  straightLineFlags: string[] | null | undefined,
): boolean {
  return (straightLineFlags ?? []).includes(SD3_NARCISSISM_STRAIGHT_LINE_FLAG);
}

export function wouldTriggerSd3NarcissismFloor(
  sd3Score: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (sd3Score === null || !Number.isFinite(sd3Score)) return false;
  if (sd3Score < SD3_NARCISSISM_FLOOR_THRESHOLD) return false;
  return true;
}

export function formatSd3NarcissismFloorAdminDescription(sd3Score: number): string {
  return `SD3 narcissism score of ${sd3Score.toFixed(2)} meets or exceeds the automatic fail threshold of ${SD3_NARCISSISM_FLOOR_THRESHOLD.toFixed(1)}. User self-reported grandiose entitlement, self-enhancement, and special treatment expectations at a level that poses significant risk for intimate partnership dynamics.`;
}

export function isRetroactiveSd3NarcissismFloorReview(
  attempt: { gate_fail_reasons?: unknown } | null | undefined,
  sd3Score: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (!attempt || !wouldTriggerSd3NarcissismFloor(sd3Score, straightLineFlags)) return false;
  const raw = attempt.gate_fail_reasons;
  if (!Array.isArray(raw)) return true;
  const codes = raw.filter((x): x is string => typeof x === 'string');
  return !codes.includes(SD3_NARCISSISM_FLOOR_FAIL_CODE);
}

export function detectSd3NarcissismStraightLineFromResponses(
  responses: Record<number, number> | undefined,
): boolean {
  if (!responses) return false;
  const values = Object.values(responses);
  return values.length === SD3_NARCISSISM_ITEM_COUNT && new Set(values).size === 1;
}
