import {
  countInterviewWords,
  coerceMoment4SpecificityFollowUpForTts,
  deriveMoment4PostGrudgeSpecificityResolvedFromMessages,
  evaluateMoment4SpecificityProbe,
  hasMoment4PersonRelationshipOrSituationAnchor,
  isAnsweringMoment4SpecificityFollowUp,
  isIncompleteMoment4SpecificityFollowUpLeadSentence,
  looksLikeMoment4SpecificityFollowUpEcho,
  looksLikeMoment4SpecificityFollowUpPrompt,
  MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
  moment4HasNamedOrReferencedPerson,
  moment4HasSpecificEventDescription,
  needsMoment4SpecificityFollowUp,
  stripMoment4SpecificityFollowUpStreamingEcho,
} from '../moment4SpecificityFollowUp';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '../moment4ProbeLogic';

const VAISHNAVA_PATTERN =
  "I'm generally too nice and don't take offense to many things. So in my life, I've never really had anyone that has ever tried to get under my skin. But there was one time where this one guy who thought I had a crush on his girlfriend tried to get back to me, get back on me in a game and we just talked afterwards and figured out that it was just a misunderstanding and we parted ways amicably after that.";

const EXPLICIT_NO_CURRENT_GRUDGE =
  "Honestly, I don't think I'm holding on to anything right now. I went through a stretch a few years back where I realized I was keeping score with people, replying things, staying annoyed longer than the situation deserved, and I made a conscious effort to let that go because it was making me worse company, not because the other person earned forgiveness. So when I think about it, I genuinely can't point to someone, I'm still carrying something.";

describe('moment4SpecificityFollowUp', () => {
  it('counts words', () => {
    expect(countInterviewWords('one two three')).toBe(3);
    expect(countInterviewWords('  a  b  ')).toBe(2);
  });

  it('detects specificity follow-up assistant line', () => {
    expect(looksLikeMoment4SpecificityFollowUpPrompt(MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT)).toBe(true);
    expect(
      looksLikeMoment4SpecificityFollowUpPrompt(
        "Is there any situation that comes to mind, even something from the past that you've already worked through? It doesn't have to be something you're still carrying.",
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4SpecificityFollowUpPrompt(
        "Can you think of a specific person — even if it's just someone from a while back — and tell me a bit more about what happened?",
      ),
    ).toBe(true);
    expect(looksLikeMoment4SpecificityFollowUpPrompt('Random text')).toBe(false);
  });

  it('does not fire for Vaishnava-style opener when answer names a specific guy and episode', () => {
    const evalResult = evaluateMoment4SpecificityProbe(VAISHNAVA_PATTERN);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.genericOpenerDetected).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(VAISHNAVA_PATTERN)).toBe(false);
  });

  it('does not fire for session-log grudge answer with "this one guy" and game episode', () => {
    const sessionAnswer =
      "I'm generally too nice and don't take offense to many things, so in my life I never really had anyone that has ever tried to get under my skin But there was one time with this one guy who thought I had a crush on his girlfriend Tried to get back to me, get back on me in a game that we had just talked Afterwards and figured out that it was just a misunderstanding and we parted ways and make it bleed after that";
    const evalResult = evaluateMoment4SpecificityProbe(sessionAnswer);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(sessionAnswer)).toBe(false);
  });

  it('does not fire for brief answer with referenced person and specific event', () => {
    const t =
      "Yes, this woman cut me off 20 years ago. I'm still upset at her. Some people should not be driving.";
    expect(countInterviewWords(t)).toBeLessThan(30);
    expect(moment4HasNamedOrReferencedPerson(t)).toBe(true);
    expect(moment4HasSpecificEventDescription(t)).toBe(true);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('does not fire when user points at "the woman driving" with an event (short)', () => {
    const t = 'Yes, I already gave you one. The woman driving cut me off last year.';
    expect(countInterviewWords(t)).toBeLessThan(30);
    expect(moment4HasNamedOrReferencedPerson(t)).toBe(true);
    expect(moment4HasSpecificEventDescription(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('fires for long generic philosophy without named person', () => {
    const generic =
      'I think people should generally try to be nice and communication is important in life overall and one ought to consider many perspectives in society broadly speaking across cultures while staying polite and cooperative in groups and valuing harmony without naming anyone concrete.';
    expect(countInterviewWords(generic)).toBeGreaterThanOrEqual(30);
    expect(moment4HasNamedOrReferencedPerson(generic)).toBe(false);
    expect(needsMoment4SpecificityFollowUp(generic)).toBe(true);
    expect(evaluateMoment4SpecificityProbe(generic).triggerReason).toBe('no_named_person');
  });

  it('does not fire when named person and specific event are both present', () => {
    const t =
      'I felt really hurt when my friend Sarah dismissed what happened — we had argued before but this time I just shut down and I kept replaying it in my head for weeks because it mattered to me and I could not let it go easily at all.';
    expect(countInterviewWords(t)).toBeGreaterThanOrEqual(30);
    expect(moment4HasNamedOrReferencedPerson(t)).toBe(true);
    expect(moment4HasSpecificEventDescription(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('does not fire for session-log grudge answer naming Michelle via appositive (woman, Michelle)', () => {
    const michelleAnswer =
      "Yeah, the most recent one was I moved in with a woman, Michelle, when my other housemates fell through. When I just moved to Austin six weeks ago, and she was not just listening. She was giving me a lot of advice and kind of inserting herself into my life. So when I would say this is the five different jobs that I'm looking for, she then would tell me which one she thought was okay with me and which were not, and I didn't ask her for advice. She just wanted someone to listen and help me sort of through, maybe. So I did just accept the job that she was kind of against, and I don't like that conversation style, or she had a pushier personality and a louder tone of voice than I like. So where I stand now is I kind of just let things settle. I moved out two weeks ago, and I just let things settle in having gotten together with her. She hasn't sent a text, and she hasn't responded, so I guess I will wait to see if she responds to the text or just even send a cute, funny video.";
    const evalResult = evaluateMoment4SpecificityProbe(michelleAnswer);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(michelleAnswer)).toBe(false);
  });

  it('does not fire for close-friend narrative with pronoun reference (session log)', () => {
    const t =
      "I had a close friend about three years ago who I felt completely betrayed by. She shared something I thought was incompetence with a group of mutual friends. I was furious and I pulled back for about six months. What I eventually realized was that I never actually told her explicitly that I needed that kept private. We talked it out, but it's not the same friendship.";
    const evalResult = evaluateMoment4SpecificityProbe(t);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('does not fire for hyphenated co-worker with specific workplace episode (session log)', () => {
    const t =
      "There was a co-worker a while back who used to take credit for things I'd done in meetings and it really bothered me for a few months. I ended up just talking to her directly about it instead of going to our manager and I actually got better after that. We're not close, but we got along fine now.";
    const evalResult = evaluateMoment4SpecificityProbe(t);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('does not fire for trip-individual answer with pronouns but no proper name (session log)', () => {
    const sessionAnswer =
      "But yes, I had a few where I really liked, haven't liked individuals, not quite had a grudge because I don't really do grudges, but when I have done with one individual, this individual I took on a trip and they acted completely inappropriately, disrespectfully to me and others organizing the trip and acted very much like a child and had a tantrum and made the situation way unsafe and were very disrespectful to me and others and we had to kick them out and send them packing back to the airport, but that was over a year ago. When I was seeing them a few times, I've also learned that they have some mental instability, some mental health issues and a few other things which means this is behavior that she has repeatedly done again and again and it's not personal, it's her own personal issues. I learned that I can't hold being mad at her for something that wasn't quite within her ability to control and I let it go and I've forgotten, I haven't forgotten, but I forgive";
    const evalResult = evaluateMoment4SpecificityProbe(sessionAnswer);
    expect(evalResult.hasNamedPerson).toBe(true);
    expect(evalResult.hasSpecificEvent).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(sessionAnswer)).toBe(false);
  });

  it('does not fire for short named-friend rupture (Devanshu/Devon t-shirt session log)', () => {
    for (const t of [
      "And my friend Devon who didn't like my t-shirt. I like my t-shirt, so we don't talk anymore",
      "Yeah, my friend Devanshu didn't like my t-shirt. I like my t-shirt and so we don't talk anymore.",
    ]) {
      const evalResult = evaluateMoment4SpecificityProbe(t);
      expect(evalResult.hasNamedPerson).toBe(true);
      expect(evalResult.hasSpecificEvent).toBe(true);
      expect(evalResult.probeShouldFire).toBe(false);
      expect(evalResult.triggerReason).toBeNull();
      expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
    }
  });

  it('does not fire for cut-off generic opener mid-sentence (session log)', () => {
    const cutOff = "I'm generally too nice and I don't";
    const evalResult = evaluateMoment4SpecificityProbe(cutOff);
    expect(evalResult.genericOpenerDetected).toBe(true);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(evalResult.triggerReason).toBe('cutoff');
    expect(needsMoment4SpecificityFollowUp(cutOff)).toBe(false);
  });

  it('does not fire for bare mentalizing opener cut-offs on grudge question', () => {
    for (const cutOff of ['I think', 'I think that']) {
      const evalResult = evaluateMoment4SpecificityProbe(cutOff);
      expect(evalResult.probeShouldFire).toBe(false);
      expect(evalResult.triggerReason).toBe('cutoff');
      expect(needsMoment4SpecificityFollowUp(cutOff)).toBe(false);
      expect(
        deriveMoment4PostGrudgeSpecificityResolvedFromMessages([
          { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
          { role: 'user', content: cutOff },
        ]),
      ).toBe(false);
    }
  });

  it('fires for long generic habit language without named person', () => {
    const t =
      "I've had grudges before but I work through them generally and try to move on with life overall without dwelling too much on past conflicts in most situations day to day.";
    expect(countInterviewWords(t)).toBeGreaterThanOrEqual(30);
    expect(moment4HasNamedOrReferencedPerson(t)).toBe(false);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(true);
  });

  it('does not fire when user explicitly cannot recall anyone they still hold a grudge against', () => {
    const evalResult = evaluateMoment4SpecificityProbe(EXPLICIT_NO_CURRENT_GRUDGE);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(evalResult.triggerReason).toBeNull();
    expect(needsMoment4SpecificityFollowUp(EXPLICIT_NO_CURRENT_GRUDGE)).toBe(false);
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages([
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: EXPLICIT_NO_CURRENT_GRUDGE },
    ])).toBe(true);
  });

  it('does not fire for session-log forgive-everyone answer without a specific person', () => {
    const sessionAnswer =
      "Yeah, I don't usually hold grudges. I think, in general, you should forgive everyone you've met because holding grudges is like drinking poison and hoping the other person dies.";
    const evalResult = evaluateMoment4SpecificityProbe(sessionAnswer);
    expect(evalResult.probeShouldFire).toBe(false);
    expect(evalResult.triggerReason).toBeNull();
    expect(needsMoment4SpecificityFollowUp(sessionAnswer)).toBe(false);
  });

  it('does not fire when user explicitly says no specific person or none comes to mind', () => {
    for (const answer of [
      "I don't have a specific person in mind.",
      'No one in particular comes to mind for me.',
      "A person doesn't come to mind when I think about that.",
      "I do not have a specific person to point to.",
      "Can't think of anyone specific.",
    ]) {
      const evalResult = evaluateMoment4SpecificityProbe(answer);
      expect(evalResult.probeShouldFire).toBe(false);
      expect(['declined_specific_person', null]).toContain(evalResult.triggerReason);
      expect(needsMoment4SpecificityFollowUp(answer)).toBe(false);
    }
  });

  it('does not fire specificity redirect on valid_non_applicable responses', () => {
    const forgiveBoundaries =
      "I've learned that it really takes a lot of energy to hold a grudge against someone so I tend to just forgive and move on and have boundaries and I don't allow the same bad habits or situations to pop up for me and I just don't include those people in my life.";
    const growthNoGrudge =
      "I don't really think there's anyone that comes to mind when I think of someone I don't really like. I am in a place in my life where I've certainly been evolving and working on myself, doing my inner healing work, and naturally with that, my friendships have shifted. I don't hold grudges. I don't have the energy or capacity for that.";
    expect(evaluateMoment4SpecificityProbe(growthNoGrudge).probeShouldFire).toBe(false);
    expect(evaluateMoment4SpecificityProbe(forgiveBoundaries).probeShouldFire).toBe(false);
    expect(needsMoment4SpecificityFollowUp(forgiveBoundaries)).toBe(false);
  });

  it('fires for very short vague answers', () => {
    expect(needsMoment4SpecificityFollowUp('yes maybe sometimes')).toBe(true);
    expect(evaluateMoment4SpecificityProbe('yes maybe sometimes').triggerReason).toBe('no_named_person');
  });

  it('fires for spiritual deflection without named person', () => {
    const t =
      "I am a spiritual person. I know as the time passes we meet new people. Some people try to commit mistakes. I forgive them because forgiving is so good for the body and for spiritual growth.";
    expect(moment4HasNamedOrReferencedPerson(t)).toBe(false);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(true);
    expect(evaluateMoment4SpecificityProbe(t).genericOpenerDetected).toBe(true);
  });

  it('detects model echo paraphrases of the specificity follow-up', () => {
    expect(looksLikeMoment4SpecificityFollowUpEcho('Is there anything specific you can share?')).toBe(true);
    expect(
      looksLikeMoment4SpecificityFollowUpEcho(
        'Is there a specific person or situation that comes to mind when you think about that?',
      ),
    ).toBe(true);
    expect(
      looksLikeMoment4SpecificityFollowUpEcho(
        "When you think about situations like that — where there's real hurt",
      ),
    ).toBe(true);
    expect(looksLikeMoment4SpecificityFollowUpEcho('How do you think this situation could be repaired?')).toBe(
      false,
    );
  });

  it('detects truncated M4 specificity paraphrase from session logs and coerces to canonical copy', () => {
    const truncated =
      "Got it. When you think about situations like that — where there's real hurt";
    expect(isIncompleteMoment4SpecificityFollowUpLeadSentence(truncated)).toBe(true);
    expect(coerceMoment4SpecificityFollowUpForTts(truncated)).toBe(
      `Got it. ${MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT}`,
    );
  });

  it('strip streaming echo: suppress duplicate sentence, keep threshold tail', () => {
    expect(
      stripMoment4SpecificityFollowUpStreamingEcho(
        'Is there anything specific you remember? At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
        true,
      ),
    ).toContain('walk away');
    expect(stripMoment4SpecificityFollowUpStreamingEcho('Is there anything specific you remember?', true)).toBeNull();
  });

  it('derive gate: resolved after adequate first grudge answer', () => {
    const grudge = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const rich =
      'When my coworker Jim took credit for my project last year I stopped trusting him and we barely speak — it still bothers me sometimes but I keep professional distance.';
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: rich },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs)).toBe(true);
  });

  it('derive gate: resolved after user answers paraphrased specificity probe', () => {
    const grudge = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const vague = 'I try not to hold grudges.';
    const paraphrase = 'Is there anything specific you can share about that?';
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: vague },
      { role: 'assistant' as const, content: paraphrase },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs)).toBe(false);
    const msgs2 = [...msgs, { role: 'user' as const, content: 'My old roommate in college argued with me last year.' }];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs2)).toBe(true);
  });

  it('isAnsweringMoment4SpecificityFollowUp matches model paraphrases', () => {
    const grudge = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const paraphrase = 'Is there a specific person or situation that comes to mind when you think about that?';
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: 'I try not to hold grudges.' },
      { role: 'assistant' as const, content: paraphrase },
      { role: 'user' as const, content: 'My cousin Rita and I fell out last year.' },
    ];
    expect(isAnsweringMoment4SpecificityFollowUp(msgs)).toBe(true);
  });

  it('derive gate: not resolved when user re-answers grudge with a vague second answer', () => {
    const grudge = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const specificEnough =
      "Yeah, I had a close friend about three years ago who I felt completely betrayed by. She shared something I told her in confidence with a group of mutual friends.";
    const vagueRetry = 'I try not to hold grudges much anymore in general.';
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: specificEnough },
      { role: 'user' as const, content: vagueRetry },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs)).toBe(false);
  });

  it('derive gate: not resolved until user answers specificity probe', () => {
    const grudge = MOMENT_4_GRUDGE_QUESTION_TEXT;
    const vague = 'I try not to hold grudges.';
    const spec = MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT;
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: vague },
      { role: 'assistant' as const, content: spec },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs)).toBe(false);
    const msgs2 = [
      ...msgs,
      { role: 'user' as const, content: 'Fine — my cousin Rita and I fell out over the estate thing last year.' },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs2)).toBe(true);
  });
});
