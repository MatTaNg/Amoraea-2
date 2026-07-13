import { describe, expect, it } from '@jest/globals';
import {
  inferPersonalMomentSlices,
  findMoment4AssistantStartIndex,
  resolveMoment5ScoringSlice,
  trimMoment5SliceForScoring,
} from '../personalMomentSlices';
import { MOMENT_4_HANDOFF_NO_NAME_LEAD } from '../interviewTransitionBundles';
import { isMoment5AssistantAnchor, MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '../probeAndScoringUtils';

const M4_COMMITMENT_THRESHOLD_INJECT =
  'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';

describe('isMoment5AssistantAnchor vs Moment 4 threshold', () => {
  it('does not treat the scripted M4 commitment-threshold inject as the Moment 5 anchor', () => {
    expect(isMoment5AssistantAnchor(M4_COMMITMENT_THRESHOLD_INJECT)).toBe(false);
  });
});

describe('findMoment4AssistantStartIndex', () => {
  it('uses interviewMoment 4 when tagged', () => {
    const t = [
      { role: 'assistant' as const, content: 'x' },
      { role: 'assistant' as const, content: 'm4', interviewMoment: 4 },
    ];
    expect(findMoment4AssistantStartIndex(t)).toBe(1);
  });

  it('detects canonical handoff lead without the literal phrase "held a grudge"', () => {
    const transcript = [
      { role: 'user' as const, content: 'scenario c wrap' },
      { role: 'assistant' as const, content: MOMENT_4_HANDOFF_NO_NAME_LEAD },
      { role: 'user' as const, content: 'my personal answer' },
    ];
    expect(findMoment4AssistantStartIndex(transcript)).toBe(1);
  });
});

describe('inferPersonalMomentSlices', () => {
  it('includes Moment 4 user turns when handoff uses canonical lead only in the opening bubble', () => {
    const transcript = [
      { role: 'assistant' as const, content: 'Scenario C last beat' },
      { role: 'user' as const, content: 'user s3' },
      { role: 'assistant' as const, content: MOMENT_4_HANDOFF_NO_NAME_LEAD },
      { role: 'user' as const, content: 'grudge narrative' },
      {
        role: 'assistant' as const,
        content: `Pivot to M5.\n\n${MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT}`,
      },
    ];
    const { moment4, m4Start, m5Start } = inferPersonalMomentSlices(transcript);
    expect(m4Start).toBe(2);
    expect(m5Start).toBeGreaterThan(m4Start);
    expect(moment4.filter((m) => m.role === 'user').length).toBeGreaterThanOrEqual(1);
    expect(moment4.some((m) => m.content === 'grudge narrative')).toBe(true);
  });

  it('keeps grudge + commitment-threshold user turns in moment4 before the real M5 anchor', () => {
    const transcript = [
      { role: 'assistant' as const, content: 'Scenario C wrap' },
      { role: 'user' as const, content: 'scenario c user' },
      { role: 'assistant' as const, content: MOMENT_4_HANDOFF_NO_NAME_LEAD },
      { role: 'user' as const, content: 'grudge story about someone' },
      { role: 'assistant' as const, content: M4_COMMITMENT_THRESHOLD_INJECT },
      { role: 'user' as const, content: 'threshold answer about when to work on it vs leave' },
      {
        role: 'assistant' as const,
        content: `Great work — here's the next question.\n\n${MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT}`,
      },
    ];
    const { moment4, m4Start, m5Start } = inferPersonalMomentSlices(transcript);
    const m4Users = moment4.filter((m) => m.role === 'user').map((m) => m.content);
    expect(m4Start).toBeGreaterThanOrEqual(0);
    expect(m5Start).toBeGreaterThan(m4Start);
    expect(m4Users).toContain('grudge story about someone');
    expect(m4Users).toContain('threshold answer about when to work on it vs leave');
    expect(m4Users.length).toBe(2);
  });
});

describe('trimMoment5SliceForScoring', () => {
  it('drops mic-retry and closing assistant lines and ends on last user turn', () => {
    const slice = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'assistant' as const, content: "I didn't catch any speech on that try. Tap the mic when you're ready." },
      { role: 'user' as const, content: 'Yes, I had a conflict with my friend and we talked it through.' },
      { role: 'assistant' as const, content: 'Good work getting through all of this — thank you for being open.' },
    ];
    const trimmed = trimMoment5SliceForScoring(slice);
    expect(trimmed.some((m) => /didn'?t catch any speech/i.test(m.content ?? ''))).toBe(false);
    expect(trimmed.some((m) => /good work getting through/i.test(m.content ?? ''))).toBe(false);
    expect(trimmed[trimmed.length - 1].role).toBe('user');
    expect(trimmed[trimmed.length - 1].content).toContain('conflict with my friend');
  });

  it('returns an empty slice when no user turn exists', () => {
    const slice = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'assistant' as const, content: 'How did it get resolved between you two?' },
    ];
    expect(trimMoment5SliceForScoring(slice)).toEqual([]);
  });
});

describe('resolveMoment5ScoringSlice', () => {
  const substantiveM5 =
    'I had a serious conflict with my close friend Alex after missing her wedding rehearsal. We stopped talking for weeks until I called to apologize and explained how ashamed I felt.';

  it('falls back to interviewMoment: 5 user turns when anchor inference yields an empty slice', () => {
    const transcript = [
      { role: 'assistant' as const, content: 'Paraphrased conflict question without canonical anchor strings.' },
      { role: 'user' as const, content: substantiveM5, interviewMoment: 5 },
      { role: 'assistant' as const, content: 'Good work getting through all of this — thank you for being open.' },
    ];
    const slice = resolveMoment5ScoringSlice(transcript);
    expect(slice.some((m) => m.role === 'user' && m.content === substantiveM5)).toBe(true);
    expect(slice.some((m) => /good work getting through/i.test(m.content ?? ''))).toBe(false);
  });

  it('finds paraphrased primary conflict question without interviewMoment tags', () => {
    const paraphrase =
      'Think of a time when you had a conflict with someone important in your life. What happened, and how did things get resolved?';
    const transcript = [
      { role: 'assistant' as const, content: paraphrase },
      { role: 'user' as const, content: substantiveM5 },
      {
        role: 'assistant' as const,
        content: 'What do you think you did or said that contributed to the conflict?',
      },
      {
        role: 'user' as const,
        content: 'I got defensive and shut down instead of listening when she raised the issue.',
      },
    ];
    const slice = resolveMoment5ScoringSlice(transcript);
    expect(slice.some((m) => m.content === substantiveM5)).toBe(true);
    expect(slice.some((m) => /got defensive and shut down/i.test(m.content ?? ''))).toBe(true);
  });

  it('includes all three interview_moment: 5 user turns with resolution and probe assistants', () => {
    const primary =
      'My mother and I fought about her criticizing my marriage and I shut down instead of explaining how hurt I felt.';
    const resolution =
      'We eventually sat down and I walked her through why her comments landed so harshly for me.';
    const probe =
      'I was too emotional and terse when she first brought it up instead of staying curious about her worry.';
    const transcript = [
      { role: 'assistant' as const, content: 'Paraphrased conflict question without canonical anchor strings.' },
      { role: 'user' as const, content: primary, interview_moment: 5 },
      { role: 'assistant' as const, content: 'How did things get resolved between you and your mother?' },
      { role: 'user' as const, content: resolution, interview_moment: 5 },
      { role: 'assistant' as const, content: 'What do you think you did or said that contributed to the conflict?' },
      { role: 'user' as const, content: probe, interview_moment: 5 },
    ];
    const slice = resolveMoment5ScoringSlice(transcript);
    expect(slice.filter((m) => m.role === 'user')).toHaveLength(3);
    expect(slice.some((m) => m.content === primary)).toBe(true);
    expect(slice.some((m) => m.content === resolution)).toBe(true);
    expect(slice.some((m) => m.content === probe)).toBe(true);
    expect(slice.some((m) => /contributed to the conflict/i.test(m.content ?? ''))).toBe(true);
  });
});
