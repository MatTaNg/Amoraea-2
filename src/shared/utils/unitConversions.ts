/** Canonical onboarding / profile bounds (metric). */
export const HEIGHT_CM_MIN = 91;
export const HEIGHT_CM_MAX = 244;
export const WEIGHT_KG_MIN = 27;
export const WEIGHT_KG_MAX = 318;

export const WEIGHT_LB_MIN = 60;
export const WEIGHT_LB_MAX = 700;

export type FtIn = { feet: number; inches: number };

export function cmToFtIn(cm: number): FtIn {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

export function ftInToCm(feet: number, inches: number): number {
  const totalInches = Math.max(0, feet) * 12 + Math.max(0, inches);
  return Math.round(totalInches * 2.54);
}

export function lbToKg(lb: number): number {
  return Math.round(lb * 0.453592 * 10) / 10;
}

export function kgToLb(kg: number): number {
  return Math.round((kg / 0.453592) * 10) / 10;
}

export function normalizeFtInParts(
  feetRaw: string,
  inchesRaw: string,
): { feet: number; inches: number; feetText: string; inchesText: string } {
  const feetDigits = feetRaw.replace(/\D/g, '');
  const inchesDigits = inchesRaw.replace(/\D/g, '');
  let feet = feetDigits ? parseInt(feetDigits, 10) : 0;
  let inches = inchesDigits ? parseInt(inchesDigits, 10) : 0;
  if (!Number.isFinite(feet)) feet = 0;
  if (!Number.isFinite(inches)) inches = 0;
  if (inches >= 12) {
    feet += Math.floor(inches / 12);
    inches %= 12;
  }
  return {
    feet,
    inches,
    feetText: feetDigits ? String(feet) : '',
    inchesText: inchesDigits ? String(inches) : '',
  };
}

export function validateHeightCm(cm: number | undefined | null): string | undefined {
  if (cm == null || !Number.isFinite(cm)) return undefined;
  if (cm < HEIGHT_CM_MIN || cm > HEIGHT_CM_MAX) {
    return `Enter a height between ${HEIGHT_CM_MIN} cm (3'0") and ${HEIGHT_CM_MAX} cm (8'0").`;
  }
  return undefined;
}

export function validateWeightKg(kg: number | undefined | null): string | undefined {
  if (kg == null || !Number.isFinite(kg)) return undefined;
  if (kg < WEIGHT_KG_MIN || kg > WEIGHT_KG_MAX) {
    return `Enter a weight between ${WEIGHT_KG_MIN} kg (${WEIGHT_LB_MIN} lb) and ${WEIGHT_KG_MAX} kg (${WEIGHT_LB_MAX} lb).`;
  }
  return undefined;
}

export function formatWeightLbDisplay(kg: number): string {
  const lb = kgToLb(kg);
  return Number.isInteger(lb) ? String(lb) : String(lb);
}

export function formatWeightKgDisplay(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(kg);
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = parseFloat(value.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseCmFromLabel(label: string): number | undefined {
  const m = label.trim().match(/(\d+)\s*cm/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseKgFromLabel(label: string): number | undefined {
  const m = label.trim().match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parseLbFromLabel(label: string): number | undefined {
  const m = label.trim().match(/(\d+(?:\.\d+)?)\s*lb/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Resolve canonical cm from profile / onboarding draft shapes. */
export function parseStoredHeightCm(source: Record<string, unknown>): number | undefined {
  const fromCm = parseFiniteNumber(source.height_cm);
  if (fromCm != null) return Math.round(fromCm);

  const heightNum = parseFiniteNumber(source.height);
  if (heightNum != null && heightNum >= HEIGHT_CM_MIN && heightNum <= HEIGHT_CM_MAX) {
    return Math.round(heightNum);
  }

  for (const key of ['heightLabel', 'height_label'] as const) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) {
      const cm = parseCmFromLabel(raw);
      if (cm != null) return cm;
    }
  }

  const heightStr = source.height;
  if (typeof heightStr === 'string' && heightStr.trim()) {
    const cm = parseCmFromLabel(heightStr);
    if (cm != null) return cm;
  }

  return undefined;
}

/** Resolve canonical kg from profile / onboarding draft shapes. */
export function parseStoredWeightKg(source: Record<string, unknown>): number | undefined {
  const fromKg = parseFiniteNumber(source.weight_kg ?? source.weightKg);
  if (fromKg != null) return Math.round(fromKg * 10) / 10;

  const weightNum = parseFiniteNumber(source.weight);
  if (weightNum != null && weightNum >= WEIGHT_KG_MIN && weightNum <= WEIGHT_KG_MAX) {
    return Math.round(weightNum * 10) / 10;
  }

  for (const key of ['weightLabel', 'weight_label'] as const) {
    const raw = source[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const kg = parseKgFromLabel(raw);
    if (kg != null) return Math.round(kg * 10) / 10;
    const lb = parseLbFromLabel(raw);
    if (lb != null) return lbToKg(lb);
    const bare = parseFiniteNumber(raw);
    if (bare != null && bare > WEIGHT_LB_MIN && bare < WEIGHT_LB_MAX) return lbToKg(bare);
  }

  return undefined;
}
