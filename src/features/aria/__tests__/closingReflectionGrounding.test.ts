import { describe, expect, it } from '@jest/globals';

import {
  closingAttributesUnsupportedAccountability,
  closingObservationFailsPillarGate,
  deriveClosingPillarContextFromScenarioScores,
  isVagueOrWeakClosingObservation,
  userAnswerIsExternallyBlamingOnly,
  userAnswerSupportsAccountabilityClaim,
} from '../closingReflectionGrounding';
import { buildPersonalMomentHandoffReflection } from '../personalMomentHandoffReflection';

const ROOMMATE_BLAME_ONLY =
  'My roommate started a fight over dishes. It was ridiculous. She blew it completely out of proportion. She was being unreasonable and she needed to calm down. She eventually apologized after I told her how unreasonable she was being.';

describe('closingReflectionGrounding', () => {
  it('detects blame-only conflict answers without self-accountability', () => {
    expect(userAnswerIsExternallyBlamingOnly(ROOMMATE_BLAME_ONLY)).toBe(true);
    expect(userAnswerSupportsAccountabilityClaim(ROOMMATE_BLAME_ONLY)).toBe(false);
  });

  it('detects unsupported accountability claims in closing copy', () => {
    expect(
      closingAttributesUnsupportedAccountability(
        'What landed for me was how you name what happened between you and what you own in it.',
        ROOMMATE_BLAME_ONLY,
      ),
    ).toBe(true);
  });

  it('allows accountability closing when the user actually owned their part', () => {
    const owned =
      'We had a fight about dishes and I owned that I escalated when I was already stressed.';
    expect(userAnswerSupportsAccountabilityClaim(owned)).toBe(true);
    expect(
      closingAttributesUnsupportedAccountability(
        'What landed for me was how you name what happened between you and what you own in it.',
        owned,
      ),
    ).toBe(false);
  });
});

describe('buildPersonalMomentHandoffReflection', () => {
  it('does not invent accountability reflection for blame-only M5 answers', () => {
    expect(buildPersonalMomentHandoffReflection(ROOMMATE_BLAME_ONLY)).toBe('');
  });

  it('builds grounded reflection when distillRelationalPatternFromAnswer finds an anchor', () => {
    const answer =
      'My ex and I had a falling out over money and I still hold a grudge because he never apologized.';
    const reflection = buildPersonalMomentHandoffReflection(answer);
    expect(reflection).toMatch(/you named your ex/i);
    expect(reflection.toLowerCase()).not.toContain('you remember what happened between you');
  });

  it('does not emit vague remember-what-happened filler for generic conflict answers', () => {
    const answer =
      'We had a fight last year. It was uncomfortable and we did not speak for a few days.';
    const reflection = buildPersonalMomentHandoffReflection(answer);
    expect(reflection).toMatch(/what (?:i heard|i got|came through|landed for me) was that/i);
    expect(reflection.toLowerCase()).not.toContain('you remember what happened between you');
  });

  it('reflects looking-forward-to-dreading tipping-point threshold answers', () => {
    const answer =
      'To me, the point that happens is when I switch from looking forward to meeting my partner every day to dreading the next time that I will have to see them.';
    const reflection = buildPersonalMomentHandoffReflection(answer);
    expect(reflection).toMatch(/what (?:i heard|i got|came through|landed for me) was that/i);
    expect(reflection.toLowerCase()).toMatch(/dread|anticipation|tipping|line/);
  });
});

describe('isVagueOrWeakClosingObservation', () => {
  it('flags the reported vague remember-what-happened closing fragment', () => {
    expect(
      isVagueOrWeakClosingObservation(
        'Good work getting through all of this. What came through was that you remember what happened between you and how it felt. Thank you for being so open with me, Matt.',
      ),
    ).toBe(true);
  });

  it('allows a specific grounded observation', () => {
    expect(
      isVagueOrWeakClosingObservation(
        'Good work getting through all of this. What came through was how quickly you named what you had missed once you could see it. Thank you for being so open with me, Matt.',
      ),
    ).toBe(false);
  });
});

describe('deriveClosingPillarContextFromScenarioScores', () => {
  it('averages pillar scores across scenario bundles', () => {
    const ctx = deriveClosingPillarContextFromScenarioScores({
      1: { pillarScores: { mentalizing: 3, accountability: 3, repair: 3, attunement: 3 } },
      2: { pillarScores: { mentalizing: 5, accountability: 5, repair: 5, attunement: 5 } },
      3: { pillarScores: { mentalizing: 4, accountability: 4, repair: 4, attunement: 4 } },
    });
    expect(ctx?.averagePillar).toBeCloseTo(4);
    expect(ctx?.mentalizing).toBe(4);
  });
});

describe('closingObservationFailsPillarGate', () => {
  it('requires omitting observations on low average pillar runs', () => {
    expect(
      closingObservationFailsPillarGate(
        'What landed for me was how you name what you own in it.',
        { mentalizing: 3, accountability: 3, repair: 3, averagePillar: 3.5 },
      ),
    ).toBe(true);
  });
});
