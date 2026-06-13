import { classifyResumeRepeatIntent } from '../resumeRepeatIntent';

describe('classifyResumeRepeatIntent', () => {
  it('treats explicit repeat phrasing as repeat', () => {
    expect(classifyResumeRepeatIntent('Yes, please repeat what you said.')).toBe('repeat');
    expect(classifyResumeRepeatIntent('Can you say that again?')).toBe('repeat');
    expect(classifyResumeRepeatIntent('What you just said')).toBe('repeat');
    expect(classifyResumeRepeatIntent('Yes, repeat')).toBe('repeat');
  });

  it('treats short affirmatives as continue (ready to proceed after welcome)', () => {
    expect(classifyResumeRepeatIntent('yes')).toBe('continue');
    expect(classifyResumeRepeatIntent('yeah')).toBe('continue');
    expect(classifyResumeRepeatIntent('yes please')).toBe('repeat');
  });

  it('does not treat yes + substantive short answer as repeat', () => {
    expect(classifyResumeRepeatIntent('Yes, three fights.')).toBe('ambiguous');
    expect(classifyResumeRepeatIntent('Yes, I think Daniel was wrong.')).toBe('ambiguous');
  });

  it('treats continue hints', () => {
    expect(classifyResumeRepeatIntent('No thanks, continue')).toBe('continue');
    expect(classifyResumeRepeatIntent('Continue')).toBe('continue');
  });
});
