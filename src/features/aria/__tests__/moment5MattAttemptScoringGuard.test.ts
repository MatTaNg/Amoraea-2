import { describe, expect, it } from '@jest/globals';

import {
  moment5ScoringAllowed,
  scoringSliceHasAssessableMoment5UserResponse,
  transcriptEligibleForMoment5Scoring,
} from '../moment5ScoringGuard';
import { inferPersonalMomentSlices, resolveMoment5ScoringSlice, trimMoment5SliceForScoring } from '../personalMomentSlices';

/** Attempt a1b62285-8a01-4f80-b969-6ded86e90c53 — M4 scored, M5 missing. */
const MATT_TRANSCRIPT = [
  { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?", scenarioNumber: 1 },
  { role: 'user', content: 'Matt.', scenarioNumber: 1, interviewMoment: 1 },
  {
    role: 'assistant',
    content:
      "That's the end of the three described situations. Good work, Matt — You framed repair around both of them staying in the room for an honest conversation. There are only two questions left. Now I want to ask you about something a bit more personal.\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now.",
    scenarioNumber: 3,
    interviewMoment: 4,
  },
  {
    role: 'user',
    content:
      "I had a massive cough. I'm generally too nice and don't take offense to many things, so in my life I've never really had anyone that has ever tried to get under my skin, but there was one time where this one guy who thought I had a crush on his girlfriend tried to get back to me, get back on me in a game and we just had talked afterwards and figured out it was just a misunderstanding and he parted ways amicably after that.",
    scenarioNumber: 3,
    interviewMoment: 4,
  },
  {
    role: 'assistant',
    content:
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    scenarioNumber: 3,
    interviewMoment: 4,
  },
  {
    role: 'user',
    content:
      "To me, the point happens is when I switch, I'm looking forward to meeting my partner every day to dreading the next time that I will see them.",
    scenarioNumber: 3,
    interviewMoment: 4,
  },
  {
    role: 'assistant',
    content:
      "What I heard was that you can name the point where anticipation flips into dread, Matt\n\nHere's one more question about you — still personal, and then we'll wrap up.\n\nThink of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?",
    scenarioNumber: 3,
    interviewMoment: 5,
  },
  {
    role: 'user',
    content:
      'I had a massive conflict with my mother regarding when I was going to get married. She understandably was concerned that I was taking too much time, but I was pissed because I thought she was pushing me too hard, but then I realized she lacked some of the context of why I was waiting. Then I explained to her that there was a lot of financial obligations to getting married and I needed to be ready financially and emotionally before I took that step.',
    scenarioNumber: 3,
    interviewMoment: 5,
  },
  { role: 'assistant', content: 'How did it get resolved between you two?', scenarioNumber: 3 },
  {
    role: 'user',
    content:
      'I took time to logically explain to her my rationale and my side of things and assured her that I wanted the same thing as she did, but I just needed time.',
    scenarioNumber: 3,
    interviewMoment: 5,
  },
  {
    role: 'assistant',
    content:
      'I appreciate you getting vulnerable with me. What do you think you did or said that contributed to the conflict?',
    scenarioNumber: 3,
  },
  {
    role: 'user',
    content:
      'I was too emotionally and I was too emotional and terse and was not seeing her side of things.',
    scenarioNumber: 3,
    interviewMoment: 5,
  },
  {
    role: 'assistant',
    content:
      'Good work getting through all of this. You named your mom and filling in the context they were missing before pushing forward. Thank you for being so open with me, Matt.',
    scenarioNumber: 3,
    interviewMoment: 5,
  },
];

describe('Matt attempt a1b62285 M5 scoring guard', () => {
  it('should allow M5 scoring for stored transcript shape', () => {
    const slice = resolveMoment5ScoringSlice(MATT_TRANSCRIPT);
    const trimmed = trimMoment5SliceForScoring(slice);
    const { m4Start, m5Start, moment5 } = inferPersonalMomentSlices(MATT_TRANSCRIPT);

    expect(m4Start).toBeGreaterThanOrEqual(0);
    expect(m5Start).toBeGreaterThan(m4Start);
    expect(moment5.length).toBeGreaterThan(0);
    expect(trimmed.length).toBeGreaterThan(0);
    expect(scoringSliceHasAssessableMoment5UserResponse(slice)).toBe(true);
    expect(scoringSliceHasAssessableMoment5UserResponse(trimmed)).toBe(true);
    expect(transcriptEligibleForMoment5Scoring(MATT_TRANSCRIPT)).toBe(true);
    expect(moment5ScoringAllowed(MATT_TRANSCRIPT, slice)).toBe(true);
  });

  it('should allow M5 scoring when interviewMoment tags are missing (failsafe transcript shape)', () => {
    const untagged = MATT_TRANSCRIPT.map(({ interviewMoment, ...rest }) => rest);
    const slice = resolveMoment5ScoringSlice(untagged);
    expect(moment5ScoringAllowed(untagged, slice)).toBe(true);
  });

  it('should allow M5 scoring when closing assistant is present but trimmed for scoring', () => {
    const slice = resolveMoment5ScoringSlice(MATT_TRANSCRIPT);
    const trimmed = trimMoment5SliceForScoring(slice);
    expect(trimmed.some((t) => /good work getting through all of this/i.test(t.content ?? ''))).toBe(false);
    expect(scoringSliceHasAssessableMoment5UserResponse(trimmed)).toBe(true);
    expect(moment5ScoringAllowed(MATT_TRANSCRIPT, trimmed)).toBe(true);
  });

  it('should NOT allow M5 scoring when transcript stops after M4 threshold (pre-M5 handoff)', () => {
    const preM5 = MATT_TRANSCRIPT.slice(0, 6);
    const slice = resolveMoment5ScoringSlice(preM5);
    expect(transcriptEligibleForMoment5Scoring(preM5)).toBe(false);
    expect(moment5ScoringAllowed(preM5, slice)).toBe(false);
  });

  it('should allow M5 scoring with only primary M5 answer (no accountability probe)', () => {
    const primaryOnly = MATT_TRANSCRIPT.slice(0, 8);
    const slice = resolveMoment5ScoringSlice(primaryOnly);
    expect(moment5ScoringAllowed(primaryOnly, slice)).toBe(true);
  });
});
