import { describe, expect, it } from 'vitest';
import { computePersonalMomentConcretenessModifier } from '../personalMomentConcreteness';
import {
  inferMoment4ConcretenessFromText,
  moment4Moment5ConcretenessDepthSignalDelta,
  moment4QualifiesAsValidNonApplicable,
} from '../moment4ConcretenessClassification';
import { evaluateMoment4SpecificityProbe } from '../moment4SpecificityFollowUp';

const RESPONSE_2840C8DE =
  "I don't really think there's anyone that comes to mind when I think of someone I don't really like. I am in a place in my life where I've certainly been evolving and working on myself, doing my inner healing work, and naturally with that, my friendships have shifted. And so it's just been by way of growth and transformation. I don't hold grudges. I mean, I don't have the energy or capacity for that. That takes away too much energy. But my friendships have shifted, and that's just because I've been on a path of personal growth and development, like, you know, spiritual growth. And so I'm conscious and intentional about the people that I surround myself with now. So there's no one that comes to mind in terms of just, oh, I just don't like them. I would say that I certainly believe in quality over quantity now. And so it's just about being intentional about the people that I align with and want in my space.";

const RESPONSE_4C79C7F2 =
  "I have had people in my life that I have not liked, I have also had people in my life that I have held grudges against. At this point in my life, holding grudges doesn't work. If you don't like a person, unless you're forced to work with them and you have to maintain a working relationship, that's a different story. If you don't like them, you just choose not to spend time with those people. As for holding grudges, any of the grudges that I've held in the past have been resolved and those relationships are in excellent places right now.";

const RESPONSE_EA8005BC =
  "Yes, I held grudges when I was younger and I learned to reflect and look into that, forgive and move on because mostly the grudges were not based on reality but based on perceived filter through childhood traumas and when I was way younger I wasn't able to trust people, I thought they just want to hurt me.";

const RESPONSE_2FAAF48B =
  "No, I haven't. I'm a firm believer. Life is too short to hold grudges or, you know, almost hate anybody. Nobody can make me that mad to, you know, hate them or do anything enough to me to hold a grudge. Like I said, life is too short for that.";

const RESPONSE_DB8EFC65 = 'you';

const RESPONSE_AF88B820 = 'Happens all the time and still hard to get rid of.';

/** Session 6c9e8271 — user explicitly cannot recall anyone they still hold a grudge against. */
const RESPONSE_EXPLICIT_NO_CURRENT_GRUDGE =
  "Honestly, I don't think I'm holding on to anything right now. I went through a stretch a few years back where I realized I was keeping score with people, replying things, staying annoyed longer than the situation deserved, and I made a conscious effort to let that go because it was making me worse company, not because the other person earned forgiveness. So when I think about it, I genuinely can't point to someone, I'm still carrying something.";

describe('moment4ConcretenessClassification', () => {
  it('classifies coherent personal-growth no-grudge answers as valid_non_applicable', () => {
    expect(moment4QualifiesAsValidNonApplicable(RESPONSE_2840C8DE)).toBe(true);
    expect(inferMoment4ConcretenessFromText(RESPONSE_2840C8DE)).toBe('valid_non_applicable');
    expect(moment4QualifiesAsValidNonApplicable(RESPONSE_4C79C7F2)).toBe(true);
    expect(inferMoment4ConcretenessFromText(RESPONSE_4C79C7F2)).toBe('valid_non_applicable');
    expect(moment4QualifiesAsValidNonApplicable(RESPONSE_EA8005BC)).toBe(true);
    expect(inferMoment4ConcretenessFromText(RESPONSE_EA8005BC)).toBe('valid_non_applicable');
  });

  it('keeps genuine bypass answers as absent', () => {
    expect(inferMoment4ConcretenessFromText(RESPONSE_DB8EFC65)).toBe('absent');
    expect(inferMoment4ConcretenessFromText(RESPONSE_2FAAF48B)).toBe('absent');
    expect(inferMoment4ConcretenessFromText(RESPONSE_AF88B820)).toBe('absent');
  });

  it('exempts valid_non_applicable from depth signal penalties', () => {
    expect(moment4Moment5ConcretenessDepthSignalDelta('valid_non_applicable', 'absent')).toBe(0);
    expect(moment4Moment5ConcretenessDepthSignalDelta('valid_non_applicable', 'low')).toBe(0);
    expect(computePersonalMomentConcretenessModifier('valid_non_applicable', 'absent')).toBe(0);
    expect(computePersonalMomentConcretenessModifier('valid_non_applicable', 'low')).toBe(0);
    expect(moment4Moment5ConcretenessDepthSignalDelta('absent', 'absent')).toBe(-0.5);
  });

  it('classifies explicit cannot-recall-current-grudge answers as valid_non_applicable', () => {
    expect(moment4QualifiesAsValidNonApplicable(RESPONSE_EXPLICIT_NO_CURRENT_GRUDGE)).toBe(true);
    expect(inferMoment4ConcretenessFromText(RESPONSE_EXPLICIT_NO_CURRENT_GRUDGE)).toBe('valid_non_applicable');
    expect(evaluateMoment4SpecificityProbe(RESPONSE_EXPLICIT_NO_CURRENT_GRUDGE).probeShouldFire).toBe(false);
  });

  it('keeps generic spiritual philosophy without personal reflection as absent', () => {
    const t =
      "I am a spiritual person. I know as the time passes we meet new people. Some people try to commit mistakes. I forgive them because forgiving is so good for the body and for spiritual growth. I have had grudges in the past but I don't remember any at this point of time because I have a habit of forgiving everyone.";
    expect(inferMoment4ConcretenessFromText(t)).toBe('absent');
    expect(moment4QualifiesAsValidNonApplicable(t)).toBe(false);
  });
});
