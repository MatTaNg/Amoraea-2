import {
  looksLikeDirectResumeAnswer,
  looksLikeRepeatCueInAmbiguousReply,
  shouldBypassResumeRepeatGateForLongAnswer,
} from '../resumeRepeatGate';

const GRUDGE_LAST_ASSISTANT =
  "That's the end of the three described situations. Nice work, Casey. Now we'll shift to something more personal.\n\nHave you ever held a grudge against someone, or had someone in your life you really didn't like?";

const GRUDGE_USER_ANSWER =
  "I had a grudge with my friend when I started being a coach, he said I was a bad coach. That upset me because he never experienced my coaching. So I thought he was out of place for saying that. And on top of that, when, after he said that, he just walked away. So he didn't even continue the conversation and so I was just left with my emotions, which I thought was cowardice and kind of fucked up. And later on, I confronted him, I got loud, and it was during a spiritual retreat too, so it was facilitated by the leader of the group, and I was able to let him speak, he let me speak, we listened to each other. I don't fully agree with where he was coming from still, but I understand it. And right now, we're okay.";

describe('resumeRepeatGate', () => {
  it('treats long grudge narrative as direct answer, not repeat cue', () => {
    expect(looksLikeDirectResumeAnswer(GRUDGE_USER_ANSWER, GRUDGE_LAST_ASSISTANT)).toBe(true);
    expect(looksLikeRepeatCueInAmbiguousReply(GRUDGE_USER_ANSWER)).toBe(false);
    expect(shouldBypassResumeRepeatGateForLongAnswer(144)).toBe(true);
  });

  it('still detects explicit short repeat requests', () => {
    expect(looksLikeRepeatCueInAmbiguousReply('Can you repeat what you said?')).toBe(true);
    expect(looksLikeRepeatCueInAmbiguousReply('Repeat what you see.')).toBe(true);
    expect(looksLikeRepeatCueInAmbiguousReply('What did you say again?')).toBe(true);
  });

  it('allows mid-length scenario answers even when lastQuestionText has no lexical overlap', () => {
    const answer = 'Daniel is very avoidant and he had to leave to regulate his emotions.';
    const repairQ = 'Got it. How do you think this situation could be repaired?';
    const welcome =
      "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.";
    expect(looksLikeDirectResumeAnswer(answer, repairQ)).toBe(true);
    expect(looksLikeDirectResumeAnswer(answer, welcome)).toBe(true);
  });
});
