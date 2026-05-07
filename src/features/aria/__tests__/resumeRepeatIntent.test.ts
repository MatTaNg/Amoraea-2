import { classifyResumeRepeatIntent } from '../resumeRepeatIntent';

describe('classifyResumeRepeatIntent', () => {
  it('treats explicit repeat phrasing as repeat', () => {
    expect(classifyResumeRepeatIntent('Yes, please repeat what you said.')).toBe('repeat');
    expect(classifyResumeRepeatIntent('Can you say that again?')).toBe('repeat');
    expect(classifyResumeRepeatIntent('What you just said')).toBe('repeat');
  });

  it('treats one- or two-word affirmatives as repeat (resume consent)', () => {
    expect(classifyResumeRepeatIntent('yes')).toBe('repeat');
    expect(classifyResumeRepeatIntent('yeah')).toBe('repeat');
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
