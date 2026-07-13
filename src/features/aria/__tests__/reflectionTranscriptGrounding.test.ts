import { describe, expect, it } from '@jest/globals';

import { buildMoment4ThresholdProbeWithReflection } from '../moment4ProbeLogic';
import { buildPersonalMomentHandoffReflection } from '../personalMomentHandoffReflection';
import { enrichPersonalMomentClosingForTts } from '../personalMomentClosingEnrichment';
import {
  buildPatternReflectionSentence,
  distillRelationalPatternFromAnswer,
} from '../relationalPatternReflection';
import {
  reflectionIsGroundedInUserAnswer,
  userAnswerHasReflectionAnchor,
  userTurnDescribesRestorativeTurnTowardPartner,
} from '../reflectionTranscriptGrounding';

/** Attempt 89ff041f shape: distance/withdrawal, not repair toward partner experience. */
const MOVED_OUT_UNANSWERED_TEXT =
  'My girlfriend and I had a huge fight. I moved out for a few weeks to let things settle down. I sent her a text that she never answered. She eventually apologized before we met again but I was still hurt.';

const PHILOSOPHICAL_M4 =
  'I think communication is really important in relationships. People need to be honest with each other about how they feel, and you have to know when to walk away from something that is not working.';

describe('reflectionTranscriptGrounding', () => {
  it('does not treat third-party apology + before as restorative turn-toward-partner', () => {
    expect(userTurnDescribesRestorativeTurnTowardPartner(MOVED_OUT_UNANSWERED_TEXT)).toBe(false);
    expect(
      distillRelationalPatternFromAnswer(MOVED_OUT_UNANSWERED_TEXT),
    ).not.toBe('repair, for you, starts by turning toward her experience before explaining yourself');
  });

  it('rejects invented turn-toward-experience reflection for moved-out answer', () => {
    const invented =
      'What I heard was that repair, for you, starts by turning toward her experience before explaining yourself.';
    expect(reflectionIsGroundedInUserAnswer(invented, MOVED_OUT_UNANSWERED_TEXT)).toBe(false);
    expect(buildPatternReflectionSentence(MOVED_OUT_UNANSWERED_TEXT)).not.toMatch(
      /turning toward her experience/i,
    );
  });

  it('still allows explicit restorative repair when user names the move', () => {
    const answer = "I'd apologize first and ask how she's feeling before I explained my side.";
    expect(userTurnDescribesRestorativeTurnTowardPartner(answer)).toBe(true);
    expect(buildPatternReflectionSentence(answer)).toMatch(/turning toward her experience/i);
  });

  it('philosophical M4 answer has no reflection anchor', () => {
    expect(userAnswerHasReflectionAnchor(PHILOSOPHICAL_M4)).toBe(false);
    expect(buildPersonalMomentHandoffReflection(PHILOSOPHICAL_M4)).toBe('');
    expect(buildPatternReflectionSentence(PHILOSOPHICAL_M4)).toBe('');
  });

  it('philosophical M4 closing enrichment stays neutral acknowledgment only', () => {
    const out = enrichPersonalMomentClosingForTts(
      'Good work getting through all of this, Alex. Thank you for being so open with me, Alex.',
      'Alex',
      PHILOSOPHICAL_M4,
    );
    expect(out).toMatch(/thank you for being so open with me/i);
    expect(out.toLowerCase()).not.toMatch(/repair, for you|turning toward|you named/);
  });

  it('M4 threshold probe is canonical question only after grudge answer', () => {
    const michelleGrudge =
      "Yeah, the most recent one was I moved in with a woman, Michelle. She was giving me a lot of advice I didn't ask for. I moved out two weeks ago and sent a text she hasn't responded to.";
    const out = buildMoment4ThresholdProbeWithReflection(michelleGrudge);
    expect(out).toBe(
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    );
    expect(out).not.toMatch(/you named who this was|falling-out/i);
  });

  it('M4 threshold probe omits reflection for moved-out grudge answer', () => {
    const out = buildMoment4ThresholdProbeWithReflection(MOVED_OUT_UNANSWERED_TEXT);
    expect(out).not.toMatch(/turning toward her experience/i);
    expect(out).toContain('work through versus something you need to walk away');
  });
});
