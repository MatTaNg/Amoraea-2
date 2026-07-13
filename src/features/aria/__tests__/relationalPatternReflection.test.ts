import { describe, expect, it } from '@jest/globals';

import {
  buildBoundaryReflectionFromUserCorpus,
  buildMinimalGroundedBoundaryReflectionFromCorpus,
  buildPatternReflectionSentence,
  buildScenarioBoundaryConclusionSentence,
  boundaryConclusionPassesQualityBar,
  distillRelationalPatternFromAnswer,
  extractScenarioBoundaryReflectionFromHandoff,
  extractedBoundaryReflectionIsUnsafeForUserCorpus,
  reflectionLooksLikeKnownCannedBoundaryTemplate,
  distillScenarioConclusionFromAnswer,
  MIN_SCENARIO_CORPUS_WORDS_FOR_REFLECTION,
  reflectionLooksLikeAnswerStructure,
  reflectionConclusionMatchesScenario,
  reflectionLooksLikeGenericScenarioTheme,
  reflectionLooksLikeSurfaceParaphrase,
  reflectionLooksLikeVerbatimInferenceEcho,
  reflectionLooksScenarioGenerated,
} from '@features/aria/relationalPatternReflection';
import { buildBoundaryReflectionSentence } from '@features/aria/interviewAcknowledgmentMoveGate';

describe('distillRelationalPatternFromAnswer', () => {
  it('distills deference orientation when user asks how partner wants to be celebrated', () => {
    expect(
      distillRelationalPatternFromAnswer(
        "I'll tell her that I'll celebrate her how she'd like and ask her how she'd like to be celebrated.",
      ),
    ).toBe("you'd let her define what support looks like rather than assuming you know");
  });

  it('distills preventive repair orientation for voicemail/commit answer', () => {
    expect(
      distillRelationalPatternFromAnswer(
        'I would make sure all calls go to voicemail during dates and commit to it.',
      ),
    ).toMatch(/structural limits|date time|voicemail/i);
  });

  it('distills restorative repair orientation for apologize + feelings answer', () => {
    expect(
      distillRelationalPatternFromAnswer("I'd apologize and ask her how she's feeling."),
    ).toBe('repair, for you, starts by turning toward her experience before explaining yourself');
  });

  it('does not assign generic care insight to celebrate/practical answer', () => {
    const answer =
      "I'll tell her that I'll celebrate her how she'd like and ask her how she'd like to be celebrated.";
    const core = distillRelationalPatternFromAnswer(answer);
    expect(core).not.toContain('care shows up');
    expect(reflectionLooksScenarioGenerated(answer, core ?? '')).toBe(false);
    expect(reflectionLooksLikeAnswerStructure(core ?? '')).toBe(false);
  });

  it('distills emotional-before-practical orientation when user names that contrast', () => {
    expect(
      distillRelationalPatternFromAnswer(
        'James should have listened more instead of jumping to logistics.',
      ),
    ).toBe("when someone's hurt, you'd reach for emotional acknowledgment before any practical fix");
  });

  it('distills thin communication orientation without inflating', () => {
    expect(distillRelationalPatternFromAnswer('He just needs to communicate better.')).toBe(
      'when things stall between you, clearer communication is the move you reach for first',
    );
  });

  it('distills Daniel fear read from user inference', () => {
    expect(
      distillRelationalPatternFromAnswer(
        "I think Daniel was scared and didn't know how to handle it.",
      ),
    ).toBe("you're reading his silence as fear rather than avoidance");
  });

  it('distills restorative orientation for apologize + understand', () => {
    expect(
      distillRelationalPatternFromAnswer('I would apologize and try to understand what she needed.'),
    ).toBe('repair, for you, starts by turning toward her experience before explaining yourself');
  });

  it('distills deferral orientation when user waits for partner to reopen', () => {
    expect(
      distillRelationalPatternFromAnswer(
        "Just wait until she brings it up again when she's ready.",
      ),
    ).toBe("you'd let her choose when to reopen it rather than pushing it now");
  });
});

describe('reflectionLooksLikeKnownCannedBoundaryTemplate', () => {
  it('flags legacy per-scenario model templates', () => {
    expect(
      reflectionLooksLikeKnownCannedBoundaryTemplate(
        'You focused on putting concrete limits on calls during dates so the same interruption does not repeat',
      ),
    ).toBe(true);
    expect(
      reflectionLooksLikeKnownCannedBoundaryTemplate(
        'You focused on James listening to Sarah instead of jumping to logistics when she was upset',
      ),
    ).toBe(true);
  });
});

describe('extractedBoundaryReflectionIsUnsafeForUserCorpus', () => {
  it('rejects byte-stable canned templates even when corpus mentions boundaries', () => {
    const corpus =
      'They need clearer communication and mutual agreement on what is okay between them.';
    const canned =
      'You focused on putting concrete limits on calls during dates so the same interruption does not repeat';
    expect(extractedBoundaryReflectionIsUnsafeForUserCorpus(corpus, canned, 1)).toBe(true);
  });

  it('accepts grounded client synthesis for the same corpus', () => {
    const corpus =
      'They need clearer communication and mutual agreement on what is okay between them.';
    const grounded =
      'You named unclear expectations and pointed toward teamwork instead of side comments';
    expect(extractedBoundaryReflectionIsUnsafeForUserCorpus(corpus, grounded, 1)).toBe(false);
  });
});

describe('distillScenarioConclusionFromAnswer', () => {
  it('observes James logistics vs emotional presence from user framing', () => {
    const out = buildScenarioBoundaryConclusionSentence(
      'James should have listened more instead of jumping to logistics when Sarah was upset.',
      { scenario: 2 },
    );
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).toMatch(/emotional acknowledgment|hurt|practical|logistics/i);
    expect(out).not.toMatch(/James listening to Sarah instead of jumping to logistics/i);
  });

  it('observes Daniel and Sophie from what the user named', () => {
    expect(
      distillScenarioConclusionFromAnswer(
        "Daniel felt at a loss and didn't know what to say while Sophie felt dismissed when he left.",
      ),
    ).toContain('named Daniel not knowing what to say');
  });

  it('observes Emma resignation from user framing', () => {
    expect(
      distillScenarioConclusionFromAnswer(
        "Emma has stopped expecting things to change — she's resigned, not just frustrated about tonight.",
      ),
    ).toContain("named Emma's resignation");
  });

  it('observes honest conversation repair from user framing', () => {
    expect(
      distillScenarioConclusionFromAnswer(
        'Daniel and Sophie need a sit down and an honest conversation to repair this or it will stay a sticking point forever.',
        3,
      ),
    ).toContain('framed repair around both of them staying in the room');
  });

  it('does not map S1 Ryan/Emma repair language to S3 Daniel/Sophie reflection', () => {
    const s1Repair =
      "He didn't know how to communicate with her and she felt dismissed when he walked away.";
    const out = distillScenarioConclusionFromAnswer(s1Repair, 1);
    expect(out).not.toMatch(/Daniel|Sophie/i);
    if (out) {
      expect(reflectionConclusionMatchesScenario(out, 1)).toBe(true);
    }
  });

  it('buildBoundaryReflectionFromUserCorpus scopes scenario 1 away from S3 character names', () => {
    const mixed =
      "Emma felt dismissed when he went silent. He didn't know what to say or how to communicate.";
    const out = buildBoundaryReflectionFromUserCorpus(mixed, { scenario: 1, openerIndex: 0 });
    expect(out).not.toMatch(/Daniel|Sophie/i);
  });

  it('does not invent voicemail structural limits without explicit call/voicemail language', () => {
    const apologyOnly =
      'If I were Ryan I would apologize to Emma and assure her this will not happen again with his family.';
    expect(distillRelationalPatternFromAnswer(apologyOnly) ?? '').not.toMatch(
      /structural limits on calls/i,
    );
    expect(
      buildBoundaryReflectionFromUserCorpus(apologyOnly, { scenario: 1, openerIndex: 0 }),
    ).not.toMatch(/structural limits on calls/i);
  });

  it('buildMinimalGroundedBoundaryReflectionFromCorpus synthesizes instead-of contrast', () => {
    const answer =
      'He should have been just happy for her and appreciated her efforts instead of jumping to logistics about the job.';
    const out = buildMinimalGroundedBoundaryReflectionFromCorpus(answer, { scenario: 2 });
    expect(out).toMatch(/^You (?:focused on|named|framed|pointed to|highlighted)/);
    expect(out).toMatch(/celebrat|appreciat|logistic|emotional acknowledgment/i);
    expect(out).not.toMatch(/James listening to Sarah/i);
  });

  it('extractScenarioBoundaryReflectionFromHandoff pulls model reflection sentence', () => {
    const handoff =
      "That's the second one done. Nice work, Matt — you focused on James asking how Sarah wanted to be celebrated. One more situation and then we'll get personal.";
    expect(extractScenarioBoundaryReflectionFromHandoff(handoff)).toBe(
      'You focused on James asking how Sarah wanted to be celebrated',
    );
  });

  it('does not produce preventive-repair paraphrase without user voicemail cues', () => {
    const conclusion = buildScenarioBoundaryConclusionSentence(
      'I would make sure all calls go to voicemail during dates and commit to it.',
      { scenario: 1 },
    );
    expect(conclusion).not.toContain("doesn't happen again");
    expect(conclusion).toMatch(/voicemail|date time|structural limits|calls/i);
    expect(conclusion).not.toMatch(/concrete limits on calls during dates/i);
  });

  it('matches Melissa reference-run S2 celebration + accountability framing', () => {
    expect(
      distillScenarioConclusionFromAnswer(
        'James could check in about what celebration looked like and took accountability for the mismatch.',
        2,
      ),
    ).toContain('check in about what celebration looked like');
  });
});

describe('structurally similar answers produce different orientations', () => {
  it('differentiates preventive vs restorative concrete repair answers', () => {
    const preventive =
      'I would make sure all calls go to voicemail during dates and commit to it.';
    const restorative = "I'd apologize and ask her how she's feeling.";

    const preventiveCore = distillRelationalPatternFromAnswer(preventive);
    const restorativeCore = distillRelationalPatternFromAnswer(restorative);

    expect(preventiveCore).toMatch(/structural limits|date time|voicemail/i);
    expect(restorativeCore).toContain('turning toward her experience');
    expect(preventiveCore).not.toBe(restorativeCore);
    expect(reflectionLooksLikeAnswerStructure(preventiveCore ?? '')).toBe(false);
    expect(reflectionLooksLikeAnswerStructure(restorativeCore ?? '')).toBe(false);
  });

  it('distills compatibility deferral at Scenario C close', () => {
    expect(
      distillRelationalPatternFromAnswer(
        "They probably need some time spent to figure out if they're actually compatible.",
      ),
    ).toContain('room to see whether the fit is real');
  });
});

describe('reflectionLooksLikeGenericScenarioTheme', () => {
  it('flags vignette-theme family/boundaries summaries', () => {
    expect(
      reflectionLooksLikeGenericScenarioTheme(
        'You picked up on the tension between staying connected and maintaining boundaries with family.',
      ),
    ).toBe(true);
    expect(
      reflectionLooksLikeGenericScenarioTheme(
        'You saw that communication is important in relationships.',
      ),
    ).toBe(true);
    expect(
      reflectionLooksLikeGenericScenarioTheme(
        "You saw Daniel's need for emotional regulation tools and Sophie's experience of abandonment in that pattern.",
      ),
    ).toBe(true);
  });

  it('allows user-grounded James logistics observations', () => {
    expect(
      reflectionLooksLikeGenericScenarioTheme(
        'You focused on James appreciating her celebration instead of jumping straight to logistics.',
      ),
    ).toBe(false);
  });
});

describe('user-specific scenario conclusions', () => {
  it('grounds S1 shared-time answers differently from thin surface answers', () => {
    const rich =
      "Emma's frustrated. I'm assuming she's referring to him always taking shared time they were supposed to spend together to spend it with his family. If I'm Ryan I would assure her this will not happen again.";
    const thin = 'Ryan should apologize and they need to talk.';
    const richOut = buildBoundaryReflectionFromUserCorpus(rich, { openerIndex: 0 });
    const thinOut = buildBoundaryReflectionFromUserCorpus(thin, { openerIndex: 0 });
    expect(richOut).toMatch(/shared time|family/i);
    expect(richOut).not.toMatch(/staying connected and maintaining boundaries/i);
    expect(thinOut).not.toBe(richOut);
  });

  it('grounds S2 celebration/presence answers in user framing', () => {
    const answer =
      'He should have been just happy for her and appreciated her efforts instead of jumping to logistics about the job.';
    const out = buildBoundaryReflectionFromUserCorpus(answer, { openerIndex: 0 });
    expect(out).toMatch(/celebration|practical|logistics/i);
    expect(out).not.toMatch(/staying connected|maintaining boundaries/i);
    expect(out).not.toMatch(/James appreciating her celebration instead of jumping straight to logistics/i);
  });

  it('omits reflection for theme-only text that is not grounded in user words', () => {
    expect(
      buildBoundaryReflectionFromUserCorpus(
        'There is tension between staying connected and maintaining boundaries with family.',
        { openerIndex: 0 },
      ),
    ).toBe('');
  });

  it('differentiates S1 preventive-call limits from S2 celebration framing', () => {
    const s1 =
      'I would make sure all calls go to voicemail during dates, set proper boundaries with my mom, and commit to it.';
    const s2 =
      'He should have been just happy for her and appreciated her efforts instead of jumping to logistics about the job.';
    const a = buildBoundaryReflectionFromUserCorpus(s1, { openerIndex: 0 });
    const b = buildBoundaryReflectionFromUserCorpus(s2, { openerIndex: 0 });
    expect(a).toMatch(/voicemail|date time|structural limits|calls/i);
    expect(b).toMatch(/celebration|practical|logistics/i);
    expect(a).not.toBe(b);
  });
});

describe('buildPatternReflectionSentence', () => {
  it('still serves personal-moment handoffs with approved opener', () => {
    const out = buildPatternReflectionSentence(
      'I would make sure all calls go to voicemail during dates and commit to it.',
      { openerIndex: 1 },
    );
    expect(out).toMatch(/^What I heard was that/);
    expect(out).toMatch(/structural limits|date time|voicemail/i);
  });
});

describe('buildScenarioBoundaryConclusionSentence', () => {
  it('uses second-person observation and does not paraphrase surface wording', () => {
    const out = buildScenarioBoundaryConclusionSentence(
      'James should have asked how she was feeling instead of jumping to the practical stuff.',
    );
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).not.toMatch(/James should have asked/i);
    expect(out).not.toMatch(/Great work/i);
    expect(out).not.toMatch(/What I got was/i);
    expect(out).toMatch(/emotional acknowledgment|hurt|practical/i);
    expect(out).not.toMatch(/James should have asked/i);
  });

  it('returns deferral observation for wait-until-ready repair answer', () => {
    const out = buildScenarioBoundaryConclusionSentence(
      "Just wait until she brings it up again when she's ready.",
    );
    expect(out).toMatch(/^You framed/);
    expect(out).toContain('on her terms');
    expect(out).not.toMatch(/brings it up again/i);
  });
});

describe('buildBoundaryReflectionSentence', () => {
  it('returns conclusion without praise or first name in reflection body', () => {
    const corpus = [
      'James should have listened more instead of jumping to logistics when Sarah was upset.',
      "She must have felt dismissed because he went straight to fixing the plan instead of hearing her.",
      "Just wait until she brings it up again when she's ready.",
    ].join('\n');
    const out = buildBoundaryReflectionSentence('Matt', corpus, { openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).not.toMatch(/Great work/i);
    expect(out).not.toMatch(/^Matt/i);
  });

  it('does not treat reassurance that Daniel need not leave as naming leaving on the table', () => {
    const repair =
      "I think if Sophie has the skills to guide the conversation, that would be helpful, and to make it known that he's safe, he doesn't have to leave, she's not going to attack him, but it is important to finish conversations and to be able to be with each other and support each other, and if he's having super high emotions, it is okay to step away, but it sounds like this happens a lot, so he might need help with emotion regulation, which can happen through all sorts of different practices, yoga, breathwork therapy, and just practicing tools and techniques on their relationship.";
    const out = buildBoundaryReflectionSentence('Matt', repair, { scenario: 3, openerIndex: 0 });
    expect(out).toMatch(/safety|finishing hard conversations|regulation/i);
    expect(out).not.toMatch(/Sophie creating safety so Daniel would not feel the need to leave/i);
    expect(out).not.toMatch(/leaving as on the table/i);
  });
});

describe('reflectionLooksLikeAnswerStructure', () => {
  it('flags structure-describing reflection cores', () => {
    expect(
      reflectionLooksLikeAnswerStructure(
        "you'd put a concrete structure in place, not just good intentions",
      ),
    ).toBe(true);
    expect(reflectionLooksLikeAnswerStructure("clearer communication is where you'd start")).toBe(
      true,
    );
  });

  it('accepts orientation-describing reflection cores', () => {
    expect(
      reflectionLooksLikeAnswerStructure(
        "repair, for you, starts with making sure it doesn't happen again",
      ),
    ).toBe(false);
    expect(
      reflectionLooksLikeAnswerStructure(
        'repair, for you, starts by turning toward her experience before explaining yourself',
      ),
    ).toBe(false);
  });
});

describe('reflectionLooksLikeSurfaceParaphrase', () => {
  it('flags near-verbatim paraphrase', () => {
    const user =
      'James should have asked how she was feeling instead of jumping to the practical stuff.';
    const bad = 'So you think James should have focused on her feelings rather than logistics.';
    expect(reflectionLooksLikeSurfaceParaphrase(user, bad)).toBe(true);
  });

  it('accepts pattern-level reflection', () => {
    const user =
      'James should have asked how she was feeling instead of jumping to the practical stuff.';
    const good =
      'You focused on emotional acknowledgment coming before any practical fix when someone is hurt.';
    expect(reflectionLooksLikeSurfaceParaphrase(user, good)).toBe(false);
  });
});

describe('reflectionLooksScenarioGenerated', () => {
  it('flags generic care insight when user gave no deference/celebration language', () => {
    const user = 'Ryan should apologize and talk to her about the dinner.';
    expect(
      reflectionLooksScenarioGenerated(
        user,
        'care shows up in how someone wants to be received',
      ),
    ).toBe(true);
  });

  it('allows emotional-before-practical when user named feelings vs logistics', () => {
    const user = 'James should have asked how she was feeling instead of jumping to logistics.';
    expect(
      reflectionLooksScenarioGenerated(
        user,
        "when someone's hurt, you'd reach for emotional acknowledgment before any practical fix",
      ),
    ).toBe(false);
  });
});

describe('scenario reflection coverage (thin vs rich)', () => {
  const richScenarioBCorpus = [
    'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
    'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
    "Just wait until she brings it up again when she's ready to talk about it.",
  ].join('\n');

  it('rich scenario B corpus gets interpretive conclusion', () => {
    const out = buildBoundaryReflectionFromUserCorpus(richScenarioBCorpus, { openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).toMatch(/logistics|on her terms|dismissed|emotional acknowledgment/i);
  });

  it('thin corpus below word threshold omits reflection', () => {
    const out = buildBoundaryReflectionFromUserCorpus('He just needs to communicate better.', {
      openerIndex: 0,
    });
    expect(out).toBe('');
    expect(MIN_SCENARIO_CORPUS_WORDS_FOR_REFLECTION).toBeGreaterThan(6);
  });

  it('allows substantive single-turn repair below full-corpus word minimum', () => {
    const repair =
      'I would make sure all calls go to voicemail during dates and commit to it.';
    const out = buildBoundaryReflectionFromUserCorpus(repair, { openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
  });
});

describe('buildBoundaryReflectionFromUserCorpus', () => {
  it('uses full scenario corpus rather than only the final turn when they differ', () => {
    const corpus = [
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
      "Just wait until she brings it up again when she's ready to talk about it.",
    ].join('\n');
    const fromCorpus = buildBoundaryReflectionFromUserCorpus(corpus, { openerIndex: 0 });
    const fromLastOnly = buildScenarioBoundaryConclusionSentence(corpus.split('\n')[2]!, {
      openerIndex: 0,
    });
    expect(fromCorpus).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(fromCorpus).toMatch(/logistics|on her terms|dismissed|emotional acknowledgment/i);
    expect(fromLastOnly).toMatch(/on her terms|reopen/i);
    if (fromCorpus === fromLastOnly) {
      expect(fromCorpus).toMatch(/logistics|dismissed|emotional acknowledgment/i);
    } else {
      expect(fromCorpus).not.toBe(fromLastOnly);
    }
  });
});

describe('Bug 4 — scenario wrap-up synthesis (not canned or echo)', () => {
  const CANNED_S1 =
    'You focused on putting concrete limits on calls during dates so the same interruption does not repeat';
  const CANNED_S2 =
    'You focused on James listening to Sarah instead of jumping to logistics when she was upset';
  const CANNED_S3 =
    'You pointed to Sophie creating safety so Daniel would not feel the need to leave';

  it('rejects byte-identical canned scenario templates (4a)', () => {
    const s1 = buildScenarioBoundaryConclusionSentence(
      'I would send calls to voicemail on date nights and commit to that boundary with my mom.',
      { scenario: 1 },
    );
    const s2 = buildScenarioBoundaryConclusionSentence(
      'James should have heard her feelings before talking about travel plans.',
      { scenario: 2 },
    );
    const s3 = buildScenarioBoundaryConclusionSentence(
      "I'd tell him he's safe and doesn't have to leave, and they need to finish conversations together.",
      { scenario: 3 },
    );
    expect(s1).not.toBe(CANNED_S1);
    expect(s2).not.toBe(CANNED_S2);
    expect(s3).not.toBe(CANNED_S3);
    expect(s3).not.toMatch(/creating safety so Daniel would not feel the need to leave/i);
  });

  it('varies wording when the same scenario content is phrased differently (4a)', () => {
    const phrasingA = buildScenarioBoundaryConclusionSentence(
      'I would make sure all calls go to voicemail during dates and commit to it.',
      { scenario: 1 },
    );
    const phrasingB = buildScenarioBoundaryConclusionSentence(
      'Ryan needs to set a hard rule: no mom calls during dinner dates, period.',
      { scenario: 1 },
    );
    expect(phrasingA).toBeTruthy();
    expect(phrasingB).toBeTruthy();
    expect(phrasingA).not.toBe(phrasingB);
  });

  it('synthesizes an underlying pattern instead of echoing surface nouns (4b)', () => {
    const user =
      "I think Sophie should make it known that he's safe, he doesn't have to leave, and they need to finish conversations and get support for emotion regulation.";
    const out = buildScenarioBoundaryConclusionSentence(user, { scenario: 3 });
    expect(out).toMatch(/safety|finishing|regulation|shutdown/i);
    expect(out).not.toMatch(/doesn'?t have to leave/i);
    expect(out).not.toMatch(/creating safety so Daniel would not feel the need to leave/i);
  });

  it('synthesizes teamwork vs side-comments contrast instead of echoing verbatim (4b)', () => {
    const user =
      'They need clearer expectations and to work as a team instead of making side comments about each other.';
    const out = buildBoundaryReflectionFromUserCorpus(user, { openerIndex: 0 });
    expect(out).toMatch(/teamwork|expectations/i);
    expect(out).not.toMatch(/side comments about each other/i);
    expect(reflectionLooksLikeSurfaceParaphrase(user, out)).toBe(false);
  });

  it('rejects verbatim echo when reflection core copies the user clause', () => {
    const user =
      'Ryan should apologize and commit to sending calls to voicemail during date nights with Emma.';
    const echo =
      'You focused on apologize and commit to sending calls to voicemail during date nights with Emma';
    expect(boundaryConclusionPassesQualityBar(user, echo)).toBe(false);
  });

  it('rejects You read it as verbatim inference echo', () => {
    const user =
      "I think that she wanted a different type of celebration and didn't express that.";
    const echo =
      "You read it as that she wanted a different type of celebration and didn't express that";
    expect(reflectionLooksLikeVerbatimInferenceEcho(user, echo)).toBe(true);
    expect(boundaryConclusionPassesQualityBar(user, echo)).toBe(false);
  });
});

describe('Melissa reference-run boundary reflections', () => {
  const s1Corpus = [
    "Yeah, it sounds like a painful pattern of the, you know, not communication of what's acceptable during time together. I would be hurt too if someone answered a phone call during a date. It's just not okay. If there is an emergency situation, that would be the only time it's okay. And not like a fake emergency that someone's created, but a real one. So yeah, communicating what's okay, what's not, and agreement on that, instead of just being mad and saying snide comments.",
    "That feels like a snide comment and a reaction instead of a conversation, but this is what's okay with me and this is not, and kind of working through it as a team, as a couple.",
    "If I were Ryan, I would say, ooh, I see you're upset. Let's talk about what we both need so that this situation doesn't repeat.",
  ].join('\n');

  const s2Corpus = [
    "I think that she wanted a different type of celebration and didn't express that. So James thought that he was celebrating with her by engaging and showing up in the present moment and asking questions, but it sounds like she wanted something different.",
    'James could have asked Sarah how she wanted to celebrate, and they could have come up with a plan together that worked for both of them that evening.',
    "Yeah, if I were James, I would say, I'm so sorry. I thought that that was a celebration, but really you might have wanted to go out for a drink or go out for dinner or go dancing for an hour. And instead I just asked you questions and I hear you, you didn't feel appreciated. So can we talk about what you might need and how you could express that in a moment next time?",
  ].join('\n');

  it('synthesizes S1 unclear expectations + teamwork instead of echoing user clause', () => {
    const out = buildBoundaryReflectionFromUserCorpus(s1Corpus, { scenario: 1, openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).toMatch(/unclear expectations|teamwork|side comment|working together/i);
    expect(out).not.toMatch(/^You read it as/i);
    expect(out).not.toMatch(/painful pattern of the, you know/i);
    expect(reflectionLooksLikeVerbatimInferenceEcho(s1Corpus, out)).toBe(false);
  });

  it('synthesizes S2 celebration mismatch + accountability instead of echoing Q1 clause', () => {
    const out = buildBoundaryReflectionFromUserCorpus(s2Corpus, { scenario: 2, openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).toMatch(/celebration|check in|accountability|mismatch/i);
    expect(out).not.toMatch(/^You read it as/i);
    expect(out).not.toMatch(/different type of celebration and didn't express that/i);
    expect(reflectionLooksLikeVerbatimInferenceEcho(s2Corpus, out)).toBe(false);
  });

  it('buildMinimalGroundedBoundaryReflectionFromCorpus does not emit You read it as echo', () => {
    const q1 =
      "I think that she wanted a different type of celebration and didn't express that.";
    expect(buildMinimalGroundedBoundaryReflectionFromCorpus(q1, { scenario: 2 })).not.toMatch(
      /^You read it as/i,
    );
  });
});
