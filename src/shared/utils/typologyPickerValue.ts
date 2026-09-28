import type { TypologyPickerValue } from '@/shared/components/profileFields/TypologyPickerFields';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';

export const TYPOLOGY_ONBOARDING_ROW_KEYS = TYPOLOGY_ONBOARDING_SECTIONS.flatMap((section) =>
  section.rows.map((row) => row.key),
);

export function parseQuestionAnswersRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore malformed JSON */
    }
  }
  return {};
}

/** Read optional typology dropdown answers stored on the profile blob. */
export function readTypologyValuesFromProfile(
  profile: Record<string, unknown>,
): TypologyPickerValue {
  const qa = parseQuestionAnswersRecord(profile.questionAnswers);
  const out: TypologyPickerValue = {};

  for (const key of TYPOLOGY_ONBOARDING_ROW_KEYS) {
    const v = qa[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }

  const myersBriggs = profile.myersBriggs;
  if (!out.myersBriggs && typeof myersBriggs === 'string' && myersBriggs.trim()) {
    out.myersBriggs = myersBriggs.trim();
  }

  return out;
}

/**
 * Merge persisted typology answers with live edit-profile state.
 * Explicit clears in `state` (undefined) override stored profile values.
 */
export function resolveEditProfileTypologyValues(
  profile: Record<string, unknown>,
  state: TypologyPickerValue,
): TypologyPickerValue {
  const merged: TypologyPickerValue = { ...readTypologyValuesFromProfile(profile) };

  for (const key of TYPOLOGY_ONBOARDING_ROW_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
    const v = state[key];
    if (v == null || String(v).trim() === '') delete merged[key];
    else merged[key] = String(v).trim();
  }

  return merged;
}

export function isTypologyOnboardingFieldFilled(
  values: TypologyPickerValue | undefined,
  key: string,
): boolean {
  const v = values?.[key];
  return typeof v === 'string' && v.trim() !== '';
}
