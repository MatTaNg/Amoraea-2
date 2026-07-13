import {
  isClosingQuestion,
  isDecline,
  isExplicitPassForMoment4CommitmentFollowUp,
  normalizeTtsTextForConsecutiveDedup,
  stripControlTokens,
} from '../interviewControlTokens';

describe('interviewControlTokens', () => {
  it('stripControlTokens removes scenario and interview completion markers', () => {
    expect(stripControlTokens('Done. [SCENARIO_COMPLETE:2] Thanks.')).toBe('Done.  Thanks.');
    expect(stripControlTokens('[INTERVIEW_COMPLETE] Thank you.')).toBe('Thank you.');
    expect(stripControlTokens('Nice work. [SCENARIO')).toBe('Nice work.');
    expect(
      stripControlTokens("Got it. That's all for that situation. On to the next one. ["),
    ).toBe("Got it. That's all for that situation. On to the next one.");
  });

  it('isClosingQuestion detects closing prompts', () => {
    expect(isClosingQuestion('Is there anything about that situation you would want me to know?')).toBe(true);
    expect(isClosingQuestion('What do you make of Emma?')).toBe(false);
  });

  it('normalizeTtsTextForConsecutiveDedup collapses punctuation for dedup keys', () => {
    const a = normalizeTtsTextForConsecutiveDedup('Hello — world!');
    const b = normalizeTtsTextForConsecutiveDedup('Hello, world.');
    expect(a).toBe(b);
  });

  it('isDecline treats short passes and explicit decline phrases as decline', () => {
    expect(isDecline('no')).toBe(true);
    expect(isDecline("I don't know")).toBe(true);
    expect(isDecline('Emma felt dismissed because Ryan prioritized his mother over their plans together.')).toBe(false);
  });

  it('isDecline does not treat substantive grudge answers with "no active bitterness" as decline', () => {
    const grudgeAnswer =
      "Yeah, I had a close friend about three years ago who I felt completely betrayed by. She shared something I told her in confidence with a group of mutual friends. I was furious and I pulled back for about six months. What I eventually realized was I never actually told her explicitly that I needed that kept private. I assumed it was obvious she didn't handle it well, but I was crying, carrying some responsibility for the gap in expectations too. We talked it out, but it's not the same friendship it was, but there's no active bitterness.";
    expect(isDecline(grudgeAnswer)).toBe(false);
    expect(isExplicitPassForMoment4CommitmentFollowUp(grudgeAnswer)).toBe(false);
  });

  it('isExplicitPassForMoment4CommitmentFollowUp only skips empty or decline-like answers', () => {
    expect(isExplicitPassForMoment4CommitmentFollowUp('')).toBe(true);
    expect(isExplicitPassForMoment4CommitmentFollowUp('not really')).toBe(true);
    expect(isExplicitPassForMoment4CommitmentFollowUp('After the third time I would leave.')).toBe(false);
  });

  it('does not treat substantive grudge answers with "don\'t have to" as explicit pass', () => {
    const mattStyleAnswer =
      "I'm generally too nice and don't have to take offense to many things so in my life I've never really had anyone that has ever tried to get under my skin But there was one time when this one guy who thought I had a crush on his girlfriend Tried to get back to me Get back on me in a game And we just talked afterwards and figured out that it was a misunderstanding and we parted ways and make it believe after that";
    expect(isExplicitPassForMoment4CommitmentFollowUp(mattStyleAnswer)).toBe(false);
  });
});
