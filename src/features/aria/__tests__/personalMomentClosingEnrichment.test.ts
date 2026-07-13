import { describe, expect, it } from '@jest/globals';

import { coerceIncompleteInterviewClosingForTts } from '../elongatingProbe';
import {
  enrichPersonalMomentClosingForTts,
  personalMomentClosingLacksConcreteAnchor,
  closingReflectionEchoesUngroundedUserWord,
} from '../personalMomentClosingEnrichment';
import { extractMoment5AnswerForClosingReflection } from '../moment5TranscriptHelpers';
import { buildMoment4ThresholdProbeWithReflection } from '../moment4ProbeLogic';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '../interviewTransitionBundles';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '../probeAndScoringUtils';

const REFLECTION_ANCHOR =
  /(?:what (?:i heard|i got|came through)|landed for me|stuck with me|staying is conditional|you (?:focused on|named|framed|pointed to|highlighted|spelled out))/i;

describe('personalMomentClosingLacksConcreteAnchor', () => {
  it('flags truncated what-you cutoff without substantive middle', () => {
    expect(
      personalMomentClosingLacksConcreteAnchor(
        'Good work getting through all of this. What you. Thank you for being so open with me, Matt.',
      ),
    ).toBe(true);
  });

  it('accepts closings with a concrete reflection anchor', () => {
    expect(
      personalMomentClosingLacksConcreteAnchor(
        'Good work getting through all of this. What landed for me was how you name what you own in it. Thank you for being so open with me, Matt.',
      ),
    ).toBe(false);
  });
});

describe('enrichPersonalMomentClosingForTts', () => {
  it('strips vague model closing with remember-what-happened filler', () => {
    const vagueClosing =
      'Good work getting through all of this. What came through was that you remember what happened between you and how it felt. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(vagueClosing, 'Matt', 'We had a fight.');
    expect(out).toBe('Good work getting through all of this. Thank you for being so open with me, Matt.');
    expect(out.toLowerCase()).not.toContain('remember what happened');
  });

  it('omits observation on low-scoring runs even when model includes one', () => {
    const modelClosing =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt.';
    const owned =
      'We had a fight about dishes and I owned that I escalated when I was already stressed.';
    const out = enrichPersonalMomentClosingForTts(modelClosing, 'Matt', owned, {
      mentalizing: 3,
      accountability: 3,
      repair: 3,
      averagePillar: 3.5,
    });
    expect(out).toBe('Good work getting through all of this. Thank you for being so open with me, Matt.');
  });

  it('injects grounded client reflection when distillRelationalPatternFromAnswer finds an anchor', () => {
    const grudgeAnswer =
      'My ex and I had a falling out over money and I still hold a grudge because he never apologized.';
    const ackOnly =
      'Good work getting through all of this, Matt. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(ackOnly, 'Matt', grudgeAnswer);
    expect(out).toMatch(REFLECTION_ANCHOR);
    expect(out).toMatch(/thank you for being so open with me, matt/i);
    expect(out.toLowerCase().match(/\bmatt\b/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('injects grounded reflection for substantive Moment 5 conflict narratives', () => {
    const conflictAnswer =
      "I had a conflict with my best friend last year where I'd been pulling away and not showing up for her the way I normally would. She called me out on it directly. We didn't speak for a few days. It was really uncomfortable.";
    const ackOnly =
      'Good work getting through all of this, Matt. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(ackOnly, 'Matt', conflictAnswer);
    expect(out).toMatch(REFLECTION_ANCHOR);
    expect(out).toMatch(/best friend|pulling away|called you out/i);
    expect(out).toMatch(/thank you for being so open with me, matt/i);
  });

  it('injects reflection for family conflict with context-gap realization (M5 closing)', () => {
    const momConflict =
      "I had a massive conflict with my mom regarding when I was going to get married. She understandably was concerned that I was taking too much time, but I was pissed because I thought she was pushing me too hard. But then I realized she lacked some of the context of why I was waiting. Then I explained to her that there was a lot of financial obligation to getting married and I needed to be financially ready and emotionally before I took the step.";
    const resolutionFollowUp =
      'I took time to logically explain to her my rationale and my side of things, and assured her that I wanted the same things as she did, but I just needed time.';
    const ackOnly =
      'Good work getting through all of this. Thank you for being so open with me, Matt.';
    const corpus = extractMoment5AnswerForClosingReflection([
      { role: 'user', interviewMoment: 5, content: momConflict },
      { role: 'user', interviewMoment: 5, content: resolutionFollowUp },
    ]);
    expect(corpus).toContain('realized she lacked');
    expect(corpus).toContain('explain to her my rationale');
    const out = enrichPersonalMomentClosingForTts(ackOnly, 'Matt', corpus);
    expect(out).toMatch(REFLECTION_ANCHOR);
    expect(out).toMatch(/missing|legible|intentions|context/i);
    expect(out).toMatch(/thank you for being so open with me, matt/i);
    expect(out).not.toBe('Good work getting through all of this. Thank you for being so open with me, Matt.');
  });

  it('injects reflection for Christy triggered-moment conflict narratives instead of threshold fallback', () => {
    const christyAnswer =
      'I had a conflict with my roommate Christy when I snapped in the moment about dishes. After a few days of space I could see her kindness instead of judgment.';
    const ackOnly =
      'Good work getting through all of this, Matt. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(ackOnly, 'Matt', christyAnswer);
    expect(out.toLowerCase()).not.toContain('walking away');
    expect(out.toLowerCase()).not.toContain('work through');
    expect(out).toMatch(/triggered|kindness|space/i);
  });

  it('dedupes participant name when the model uses it in both ack and thanks', () => {
    const doubled =
      'Good work getting through all of this, Matt. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(doubled, 'Matt', 'We talked it through.');
    expect(out).toBe('Good work getting through all of this. Thank you for being so open with me, Matt.');
  });

  it('replaces malformed M5 closing from session logs with neutral thanks when reflection is not grounded', () => {
    const malformed =
      'Good work getting through all of this. What you. Thank you for being so open with me, Matt.';
    const userAnswer =
      'I did raise my voice at him, but I was angry at him, and I think that needs to be expressed.';
    const out = enrichPersonalMomentClosingForTts(malformed, 'Matt', userAnswer);
    expect(out).not.toContain('What you.');
    expect(out).toMatch(/good work getting through all of this/i);
    expect(out).toMatch(/thank you for being so open with me, matt/i);
    expect(out).not.toMatch(/what you own in it/i);
  });

  it('uses neutral closing for blame-only M5 answer instead of inventing accountability', () => {
    const roommateAnswer =
      'My roommate started a fight over dishes. It was ridiculous. She blew it completely out of proportion. She was being unreasonable and she needed to calm down. She eventually apologized after I told her how unreasonable she was being.';
    const malformed =
      'Good work getting through all of this, Matt. What you. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(malformed, 'Matt', roommateAnswer);
    expect(out).toBe(
      'Good work getting through all of this. Thank you for being so open with me, Matt.',
    );
    expect(out.toLowerCase()).not.toContain('own in it');
    expect(out.toLowerCase()).not.toContain('accountab');
  });

  it('strips model closing that falsely attributes accountability to a blame-only answer', () => {
    const roommateAnswer =
      'My roommate started a fight over dishes. It was ridiculous. She blew it completely out of proportion. She was being unreasonable and she needed to calm down. She eventually apologized after I told her how unreasonable she was being.';
    const modelClosing =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(modelClosing, 'Matt', roommateAnswer);
    expect(out).toBe(
      'Good work getting through all of this. Thank you for being so open with me, Matt.',
    );
  });

  it('leaves well-formed reflective closings unchanged', () => {
    const good =
      'Good work getting through all of this — what you shared about listening really stuck with me. Thank you for being so open with me, Matt.';
    const out = enrichPersonalMomentClosingForTts(good, 'Matt', 'We talked it through.');
    expect(out).toBe(coerceIncompleteInterviewClosingForTts(good, 'Matt'));
  });

  it('replaces model closing that echoes ungrounded words like catching with grounded reflection', () => {
    const userAnswer =
      "The clearest one is a conflict with my partner when I had been checked out for weeks. I took a breath and owned my part.";
    const modelClosing =
      'Good work getting through all of this, Matt. What landed for me was catching that you owned your part. Thank you for being so open with me, Matt.';
    expect(closingReflectionEchoesUngroundedUserWord(modelClosing, userAnswer)).toBe(true);
    const out = enrichPersonalMomentClosingForTts(modelClosing, 'Matt', userAnswer);
    expect(out.toLowerCase()).not.toContain('catching');
    expect(out).toMatch(/partner|pulling away|owned your part/i);
    expect(out).toMatch(/thank you for being so open with me, matt/i);
  });

  it('extractMoment5AnswerForClosingReflection prefers substantive conflict narrative', () => {
    const narrative =
      'The clearest one is a conflict with my partner when I had been checked out for weeks because of work stress. I took a breath and owned my part.';
    const picked = extractMoment5AnswerForClosingReflection([
      { role: 'user', interviewMoment: 5, content: narrative },
      { role: 'user', interviewMoment: 5, content: 'Yeah, it felt complete.' },
    ]);
    expect(picked).toBe(narrative);
  });

  it('extractMoment5AnswerForClosingReflection joins substantive resolution follow-up with main narrative', () => {
    const main =
      'I had a massive conflict with my mom about marriage timing and realized she lacked context on why I was waiting.';
    const resolution = 'I explained my rationale and assured her we wanted the same things.';
    const picked = extractMoment5AnswerForClosingReflection([
      { role: 'user', interviewMoment: 5, content: main },
      { role: 'user', interviewMoment: 5, content: resolution },
    ]);
    expect(picked).toContain(main);
    expect(picked).toContain(resolution);
  });
});

describe('Moment 4 handoff reflections', () => {
  it('does not prepend reflection before threshold probe after grudge answer', () => {
    const grudge =
      'My ex and I had a falling out over money and I still hold a grudge because he never apologized.';
    const out = buildMoment4ThresholdProbeWithReflection(grudge);
    expect(out).toBe(
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    );
    expect(out).not.toMatch(/you named|what i heard|falling-out\./i);
  });

  it('includes dynamic threshold reflection in M4→M5 bundle when pattern builder is thin', () => {
    const out = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Matt',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'I would keep trying unless there is no path forward then I walk away.',
    );
    expect(out).toMatch(REFLECTION_ANCHOR);
    expect(out).not.toContain(
      'You spelled out what has to shift for you to keep working at it versus when walking away is right.',
    );
    expect(out).toContain('one more question about you');
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('includes reflection for looking-forward-to-dreading tipping-point threshold answers', () => {
    const out = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Matt',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'To me, the point that happens is when I switch from looking forward to meeting my partner every day to dreading the next time that I will have to see them.',
    );
    expect(out).toMatch(REFLECTION_ANCHOR);
    expect(out.toLowerCase()).toMatch(/dread|tipping|line|anticipation/);
    expect(out).toContain('one more question about you');
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(out.indexOf('What')).toBeLessThan(out.indexOf('one more question about you'));
  });
});
