import type { ProfilePromptAnswer } from '@domain/models/Profile';
import {
  getPromptById,
  getPromptCategoryId,
  MAX_PROFILE_PROMPTS,
  PROFILE_PROMPT_ANSWER_MAX_LENGTH,
  REQUIRED_PROFILE_PROMPT_CATEGORY_IDS,
} from '@/features/profile/profilePromptsLibrary';

export {
  MAX_PROFILE_PROMPTS,
  PROFILE_PROMPT_ANSWER_MAX_LENGTH,
  REQUIRED_PROFILE_PROMPT_CATEGORY_IDS,
};

export type ProfilePromptValidationCode =
  | 'too_many_prompts'
  | 'duplicate_prompt'
  | 'unknown_prompt'
  | 'empty_answer'
  | 'answer_too_long'
  | 'missing_required_category'
  | 'no_prompts';

export type ProfilePromptValidationResult =
  | { ok: true; prompts: ProfilePromptAnswer[] }
  | { ok: false; code: ProfilePromptValidationCode; message: string };

function trimAnswer(answer: string): string {
  return String(answer ?? '').trim();
}

/** Normalize raw stored rows; drops invalid ids and enriches categoryId from library. */
export function normalizeProfilePromptAnswer(raw: unknown): ProfilePromptAnswer | null {
  if (raw === null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const promptId = typeof row.promptId === 'string' ? row.promptId.trim() : '';
  if (!promptId || !getPromptById(promptId)) return null;
  const categoryId =
    (typeof row.categoryId === 'string' && row.categoryId.trim()) ||
    getPromptCategoryId(promptId) ||
    '';
  if (!categoryId) return null;
  const answer = trimAnswer(typeof row.answer === 'string' ? row.answer : '');
  return { promptId, categoryId, answer };
}

export function normalizeProfilePromptAnswers(raw: unknown): ProfilePromptAnswer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProfilePromptAnswer[] = [];
  for (const item of raw) {
    const normalized = normalizeProfilePromptAnswer(item);
    if (!normalized || seen.has(normalized.promptId)) continue;
    seen.add(normalized.promptId);
    out.push(normalized);
    if (out.length >= MAX_PROFILE_PROMPTS) break;
  }
  return out;
}

export function hasRequiredCategoryPrompt(prompts: ProfilePromptAnswer[]): boolean {
  const required = new Set<string>(REQUIRED_PROFILE_PROMPT_CATEGORY_IDS);
  return prompts.some(
    (p) =>
      required.has(p.categoryId) &&
      trimAnswer(p.answer).length > 0 &&
      Boolean(getPromptById(p.promptId)),
  );
}

/** Profile setup gate: ≥1 prompt, ≤3, no dupes, ≥1 from required categories, answers ≤150 chars. */
export function validateProfilePromptsForSetup(
  raw: unknown,
): ProfilePromptValidationResult {
  return validateProfilePrompts(raw, { requireSetupFloor: true });
}

/** Save gate for edit profile — same rules when completing setup; allows empty only when not enforcing floor. */
export function validateProfilePromptsForSave(
  raw: unknown,
  options?: { requireSetupFloor?: boolean },
): ProfilePromptValidationResult {
  return validateProfilePrompts(raw, options);
}

function validateProfilePrompts(
  raw: unknown,
  options?: { requireSetupFloor?: boolean },
): ProfilePromptValidationResult {
  if (!Array.isArray(raw)) {
    if (options?.requireSetupFloor) {
      return {
        ok: false,
        code: 'no_prompts',
        message: 'Add at least one prompt answer to continue.',
      };
    }
    return { ok: true, prompts: [] };
  }

  if (raw.length > MAX_PROFILE_PROMPTS) {
    return {
      ok: false,
      code: 'too_many_prompts',
      message: `You can answer at most ${MAX_PROFILE_PROMPTS} prompts.`,
    };
  }

  const seen = new Set<string>();
  const prompts: ProfilePromptAnswer[] = [];

  for (const item of raw) {
    const normalized = normalizeProfilePromptAnswer(item);
    if (!normalized) {
      return {
        ok: false,
        code: 'unknown_prompt',
        message: 'One or more prompts are no longer available. Please re-select.',
      };
    }
    if (seen.has(normalized.promptId)) {
      return {
        ok: false,
        code: 'duplicate_prompt',
        message: 'Each prompt can only be selected once.',
      };
    }
    seen.add(normalized.promptId);

    if (!normalized.answer) {
      return {
        ok: false,
        code: 'empty_answer',
        message: 'Every selected prompt needs an answer.',
      };
    }
    if (normalized.answer.length > PROFILE_PROMPT_ANSWER_MAX_LENGTH) {
      return {
        ok: false,
        code: 'answer_too_long',
        message: `Answers must be ${PROFILE_PROMPT_ANSWER_MAX_LENGTH} characters or fewer.`,
      };
    }

    prompts.push(normalized);
  }

  if (options?.requireSetupFloor) {
    if (prompts.length === 0) {
      return {
        ok: false,
        code: 'no_prompts',
        message: 'Add at least one prompt answer to continue.',
      };
    }
    if (!hasRequiredCategoryPrompt(prompts)) {
      return {
        ok: false,
        code: 'missing_required_category',
        message:
          'Include at least one prompt from "What Matters To Me" or "How I Show Up".',
      };
    }
  } else if (prompts.length > 0 && !hasRequiredCategoryPrompt(prompts)) {
    return {
      ok: false,
      code: 'missing_required_category',
      message:
        'Keep at least one prompt from "What Matters To Me" or "How I Show Up".',
    };
  }

  return { ok: true, prompts };
}

/** Whether removing the prompt at `index` would break the required-category floor. */
export function wouldRemovalBreakRequiredCategoryFloor(
  prompts: ProfilePromptAnswer[],
  index: number,
): boolean {
  if (index < 0 || index >= prompts.length) return false;
  const next = prompts.filter((_, i) => i !== index);
  if (next.length === 0) return true;
  return !hasRequiredCategoryPrompt(next);
}

export function assertValidProfilePromptsForServerSave(
  prompts: ProfilePromptAnswer[],
  options?: { requireSetupFloor?: boolean },
): void {
  const result = validateProfilePrompts(prompts, options);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
