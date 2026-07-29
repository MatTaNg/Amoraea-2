import { describe, expect, it } from '@jest/globals';

import {
  classifyResumeWelcomeBackRepeatIntent,
  looksLikeResumeWelcomeQuestionOnlyRepeatRequest,
} from '../resumeWelcomeBackRepeat';

describe('resumeWelcomeBackRepeat', () => {
  it('classifies bare yes as repeat_scenario', () => {
    expect(classifyResumeWelcomeBackRepeatIntent('yes')).toBe('repeat_scenario');
    expect(classifyResumeWelcomeBackRepeatIntent('Yeah.')).toBe('repeat_scenario');
  });

  it('classifies repeat it as repeat_scenario', () => {
    expect(classifyResumeWelcomeBackRepeatIntent('repeat it')).toBe('repeat_scenario');
    expect(classifyResumeWelcomeBackRepeatIntent('Can you say it again?')).toBe('repeat_scenario');
  });

  it('classifies explicit question-only repeat requests', () => {
    expect(classifyResumeWelcomeBackRepeatIntent('repeat the question')).toBe('repeat_question');
    expect(classifyResumeWelcomeBackRepeatIntent('just the question please')).toBe('repeat_question');
    expect(looksLikeResumeWelcomeQuestionOnlyRepeatRequest('repeat the question')).toBe(true);
  });

  it('classifies continue intents without repeating', () => {
    expect(classifyResumeWelcomeBackRepeatIntent("I'm ready to continue")).toBe('continue');
    expect(classifyResumeWelcomeBackRepeatIntent('no thanks')).toBe('continue');
  });
});
