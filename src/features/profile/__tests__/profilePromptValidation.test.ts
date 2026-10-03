import { describe, expect, it } from '@jest/globals';
import {
  hasRequiredCategoryPrompt,
  normalizeProfilePromptAnswers,
  validateProfilePromptsForSave,
  validateProfilePromptsForSetup,
  wouldRemovalBreakRequiredCategoryFloor,
  assertValidProfilePromptsForServerSave,
} from '@/features/profile/profilePromptValidation';
import type { ProfilePromptAnswer } from '@domain/models/Profile';

const REQUIRED_ANSWER = 'Honesty, warmth, and showing up when things get hard.';
const HIS_ANSWER = 'Space and a calm check-in when I am stressed.';

const requiredPrompt = (
  promptId: string,
  categoryId: 'what_matters_to_me' | 'how_i_show_up',
  answer: string,
): ProfilePromptAnswer => ({ promptId, categoryId, answer });

const funPrompt = (promptId: string, answer: string): ProfilePromptAnswer => ({
  promptId,
  categoryId: 'fun_chemistry',
  answer,
});

describe('profilePromptValidation', () => {
  it('rejects setup with zero prompts', () => {
    const result = validateProfilePromptsForSetup([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('no_prompts');
  });

  it('rejects setup when only non-required categories are answered', () => {
    const result = validateProfilePromptsForSetup([
      funPrompt('fun_date', 'Coffee and a walk.'),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('missing_required_category');
  });

  it('allows setup with exactly one required-category prompt', () => {
    const result = validateProfilePromptsForSetup([
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', REQUIRED_ANSWER),
    ]);
    expect(result.ok).toBe(true);
  });

  it('validates required category when that prompt is second, not first', () => {
    const prompts = [
      funPrompt('fun_date', 'Coffee shop.'),
      requiredPrompt('his_stress', 'how_i_show_up', HIS_ANSWER),
    ];
    expect(hasRequiredCategoryPrompt(prompts)).toBe(true);
    expect(validateProfilePromptsForSetup(prompts).ok).toBe(true);
  });

  it('validates required category when that prompt is third', () => {
    const prompts = [
      funPrompt('fun_date', 'Coffee shop.'),
      funPrompt('fun_flirt', 'Bad puns.'),
      requiredPrompt('wmtm_trust', 'what_matters_to_me', REQUIRED_ANSWER),
    ];
    expect(validateProfilePromptsForSetup(prompts).ok).toBe(true);
  });

  it('rejects more than three prompts', () => {
    const result = validateProfilePromptsForSetup([
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', REQUIRED_ANSWER),
      funPrompt('fun_date', 'Walks.'),
      funPrompt('fun_flirt', 'Teasing.'),
      funPrompt('fun_food', 'Tacos.'),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('too_many_prompts');
  });

  it('rejects duplicate prompt ids', () => {
    const result = validateProfilePromptsForSetup([
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', REQUIRED_ANSWER),
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', HIS_ANSWER),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('duplicate_prompt');
  });

  it('allows short required-category answers', () => {
    const result = validateProfilePromptsForSetup([
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', 'Hi'),
    ]);
    expect(result.ok).toBe(true);
  });

  it('does not require a minimum on optional-category answers', () => {
    const result = validateProfilePromptsForSetup([
      requiredPrompt('wmtm_partnership', 'what_matters_to_me', REQUIRED_ANSWER),
      funPrompt('fun_date', 'Hi.'),
    ]);
    expect(result.ok).toBe(true);
  });

  it('server save assertion allows short required answers', () => {
    expect(() =>
      assertValidProfilePromptsForServerSave([
        requiredPrompt('wmtm_partnership', 'what_matters_to_me', 'Hi'),
      ]),
    ).not.toThrow();
  });

  it('server save assertion allows long required and optional answers', () => {
    expect(() =>
      assertValidProfilePromptsForServerSave([
        requiredPrompt('wmtm_partnership', 'what_matters_to_me', 'x'.repeat(400)),
        funPrompt('fun_date', 'x'.repeat(400)),
      ]),
    ).not.toThrow();
  });

  it('blocks removal that would drop below required-category floor', () => {
    const prompts = [
      funPrompt('fun_date', 'Coffee.'),
      requiredPrompt('his_stress', 'how_i_show_up', 'Space please.'),
    ];
    expect(wouldRemovalBreakRequiredCategoryFloor(prompts, 1)).toBe(true);
    expect(wouldRemovalBreakRequiredCategoryFloor(prompts, 0)).toBe(false);
  });

  it('normalizes legacy rows without categoryId using prompt library lookup', () => {
    const normalized = normalizeProfilePromptAnswers([
      { promptId: 'wmtm_partnership', answer: 'Honesty.' },
    ]);
    expect(normalized).toEqual([
      {
        promptId: 'wmtm_partnership',
        categoryId: 'what_matters_to_me',
        answer: 'Honesty.',
      },
    ]);
  });

  it('save validation keeps required floor when editing existing prompts', () => {
    const result = validateProfilePromptsForSave([
      funPrompt('fun_date', 'Coffee.'),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('missing_required_category');
  });
});
