import { describe, expect, it } from '@jest/globals';

import { coerceScenarioBoundaryHandoffDisplayText } from '@features/aria/coerceScenarioBoundaryHandoffDisplayText';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionModalTransitionOrchestration';
import { MOMENT_4_HANDOFF_NO_NAME_LEAD } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';

const WRAP_LEAD_ANCHOR =
  /that's the end of this scenario|That's a wrap on that one|That's the second one done|finished the three situations|two questions left/i;

const SCENARIO_B_CORPUS_MESSAGES = [
  {
    role: 'user' as const,
    content:
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
    scenarioNumber: 2,
  },
  {
    role: 'user' as const,
    content:
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
    scenarioNumber: 2,
  },
];

describe('coerceScenarioBoundaryHandoffDisplayText', () => {
  it('does not coerce M5 final closing into S3→M4 grudge handoff', () => {
    const closing =
      'Good work getting through all of this. What came through was that you remember what happened between you and how it felt. Thank you for being so open with me, Matt.';
    const messages = [
      { role: 'assistant', content: 'How did it get resolved between you two?' },
      {
        role: 'user',
        content:
          'I took time to logically explain to her my rationale and assure her that I wanted the same things as she did.',
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(closing, 'Matt', messages, 3, 5);
    expect(out).toBe(closing);
    expect(out).not.toMatch(/two questions left|really hard time with/i);
  });

  it('coerces truncated S3→M4 reflection into full bundle with personal card afterModal', () => {
    const truncated =
      "That's the end of the three situations. What came through was that you'd treat Daniel's exits as something";
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          "Daniel needs to come back sooner and they need to figure out why he's leaving.",
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(truncated, 'Matt', messages, 3, 3);
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.afterModal).toMatch(/held a grudge|really hard time with/i);
    expect(split.beforeModal).toMatch(/three situations|more personal/i);
    expect(out).not.toContain('as something');
  });

  it('does not coerce James repair Q3 into S2→S3 boundary bundle', () => {
    const repairQ =
      'Got it. And if you were James in that moment when Sarah tears up, how would you actually repair it — what would you say to her?';
    const messages = [
      ...SCENARIO_B_CORPUS_MESSAGES,
      {
        role: 'assistant',
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
      },
      {
        role: 'user',
        content:
          'He should have met her right after she got the offer and celebrated with her instead of leading with logistics questions.',
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(repairQ, 'Matt', messages, 2, 2);
    expect(out).toBe(repairQ);
    expect(out).not.toMatch(/third situation/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
  });

  it('coerces S2→S3 handoff into short wrap without content reflection', () => {
    const bareHandoff =
      "That scenario is complete. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.";
    const messages = [
      ...SCENARIO_B_CORPUS_MESSAGES,
      {
        role: 'assistant',
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'He should have celebrated her before asking about salary and commute.',
        scenarioNumber: 2,
      },
      { role: 'assistant', content: 'And if you were James, how would you repair?', scenarioNumber: 2 },
      {
        role: 'user',
        content:
          "I'd apologize for leading with logistics, ask how she'd like to be celebrated, and commit to doing that next time.",
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(bareHandoff, 'Matt', messages, 2, 2);
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.beforeModal).toMatch(WRAP_LEAD_ANCHOR);
    expect(split.beforeModal).not.toMatch(/Nice work|You (focused on|named|framed)/i);
    expect(split.afterModal).toMatch(/Sophie and Daniel/i);
  });

  it('blocks premature S2→S3 when James differently / repair never asked (handoff cue alone)', () => {
    const premature =
      "That's the second one done. One more situation and then we'll get personal.\n\nSophie and Daniel have had the same argument for the third time.";
    const messages = [
      {
        role: 'assistant',
        content: 'What do you think is going on here?',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content:
          'James focused on logistics instead of celebrating Sarah emotionally, so she felt unappreciated.',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'He should have noticed she was tearing up.',
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(premature, 'Matt', messages, 2, 2);
    expect(out).toBe(
      'What do you think James could have done differently to help Sarah feel appreciated?',
    );
    expect(out).not.toMatch(/Sophie and Daniel/i);
  });

  it('blocks premature S2→S3 after refs already advanced to 3 without James repair satisfied', () => {
    const premature =
      "That's the second one done. One more situation and then we'll get personal. Sophie and Daniel have had the same argument for the third time.";
    const messages = [
      {
        role: 'assistant',
        content: 'What do you think is going on here?',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'Sarah feels unappreciated because James led with logistics.',
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(premature, 'Matt', messages, 3, 3);
    expect(out).toMatch(/James could have done differently|if you were James, how would you repair/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
  });

  it('blocks premature S2→S3 after James differently but before repair Q3', () => {
    const premature =
      "Here's the third situation.\n\nSophie and Daniel have had the same argument for the third time.";
    const messages = [
      {
        role: 'assistant',
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'He should have led with celebration before asking about salary.',
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(premature, 'Matt', messages, 2, 2);
    expect(out).toBe('And if you were James, how would you repair?');
    expect(out).not.toMatch(/Sophie and Daniel/i);
  });

  it('coerces S2→S3 handoff when Sophie vignette present into short wrap', () => {
    const bareHandoff =
      "Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.";
    const messages = [
      ...SCENARIO_B_CORPUS_MESSAGES,
      { role: 'assistant', content: 'How would you repair this as James?' },
      {
        role: 'user',
        content: "I'd ask how she'd like to be celebrated and commit to celebrating her the way she'd like.",
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(bareHandoff, 'Matt', messages, 2, 2);
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.beforeModal).toMatch(WRAP_LEAD_ANCHOR);
    expect(split.beforeModal).not.toMatch(/Nice work|You (focused on|named|framed)/i);
    expect(split.afterModal).toMatch(/Sophie and Daniel/i);
  });

  it('redirects premature M4 handoff after scenario 2 to S2→S3 bundle', () => {
    const prematureM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content: "I'd let her define what support looks like rather than assuming I know.",
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(prematureM4, 'Matt', messages, 3, 3);
    expect(out).toMatch(/second one done|one more situation and then we'?ll get personal/i);
    expect(out).toMatch(/Sophie and Daniel/i);
    expect(out).not.toContain('two questions left');
    expect(out).not.toContain('really hard time with');
  });

  it('coerces S1→S2 handoff with Sarah vignette but missing reflection', () => {
    const s1ToS2Bare =
      "That's the end of that scenario. Here's the next situation. Sarah has been job hunting for four months. She gets an offer and calls James from the street.";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here?' },
      {
        role: 'user',
        content: 'Emma was dismissive — she was telling Ryan she already knows he will not change.',
        scenarioNumber: 1,
      },
      {
        role: 'assistant',
        content: 'If you were Ryan, how would you repair this?',
      },
      {
        role: 'user',
        content:
          'I would say proper boundaries with my mom and commit to not taking calls during dates unless it is an emergency.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(s1ToS2Bare, 'Matt', messages, 1, 1);
    expect(out).toMatch(WRAP_LEAD_ANCHOR);
    expect(out).not.toContain('Nice work, Matt');
    expect(out).not.toMatch(/You (focused on|named|framed)/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
  });

  it('blocks premature S1→S2 wrap after Q1 only and redirects to contempt probe', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      {
        role: 'user',
        content:
          'They need clearer boundaries about phone use on dates and agreement on what is okay.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 1, 1);
    expect(out).toMatch(/you'?ve made that very clear|what do you make of that/i);
    expect(out).not.toMatch(/Sarah has been job hunting/i);
  });

  it('blocks premature S1→S2 when scenario ref drifted to 2 before repair satisfied', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    const messages = [
      {
        role: 'user',
        content:
          'Ryan needs a hard rule: no mom calls during dinner dates, period.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 2, 2);
    expect(out).toMatch(/you'?ve made that very clear|what do you make of that/i);
    expect(out).not.toContain('Sarah has been job hunting');
  });

  it('does not redirect to Ryan repair after Situation 2 card already played (emotion handoff must finish)', () => {
    const modelCanned =
      "Here's the next situation. Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait.";
    const messages = [
      {
        role: 'user',
        content: 'Emma feels secondary to his mother.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 2, 2, {
      situation2PlaybackConfirmed: true,
    });
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/if you were ryan|how would you repair/i);
  });

  it('does not redirect to Ryan repair when stream already spoke Situation 2 vignette', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt. Here's the next situation. Sarah has been job hunting for four months.";
    const messages = [
      {
        role: 'user',
        content: 'Emma feels secondary to his mother.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 2, 2, {
      situation2AlreadySpoken: true,
    });
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/if you were ryan|how would you repair/i);
  });

  it('coerces S1→S2 when model streams client segment-close + canned reflection without Sarah vignette', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to not taking mom calls unless it is an emergency.',
        scenarioNumber: 1,
      },
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to not taking mom calls unless it is an emergency.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 1, 1);
    expect(out).toMatch(WRAP_LEAD_ANCHOR);
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/putting concrete limits on calls during dates so the same interruption does not repeat/i);
    expect(out).not.toContain('Nice work, Matt');
  });

  it('coerces S1→S2 when scenario ref already advanced to 2 after repair satisfied', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    const messages = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'That sounds dismissive and contemptuous to me.', scenarioNumber: 1 },
      { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
      {
        role: 'user',
        content:
          'I would set boundaries so all calls go to voicemail during dates and commit to that with Emma.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 2, 2);
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/putting concrete limits on calls during dates so the same interruption does not repeat/i);
  });

  it('rebuilds S1→S2 when model canned reflection mismatches communication-only corpus', () => {
    const modelCanned =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      { role: 'user', content: 'Emma sounds resigned — Ryan keeps choosing family over their time.', scenarioNumber: 1 },
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'That line felt contemptuous and dismissive.', scenarioNumber: 1 },
      { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
      {
        role: 'user',
        content:
          'They need clearer communication and mutual agreement on what is okay — not just reacting in the moment.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(modelCanned, 'Matt', messages, 1, 1);
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/putting concrete limits on calls during dates so the same interruption does not repeat/i);
  });

  it('coerces S1→S2 handoff with wrong birthday-dinner vignette into canonical bundle', () => {
    const garbled =
      "Got it. That's a wrap on this situation. Nice work, Matt — you read Emma's line as accumulated frustration over a repeated pattern, not just a reaction to tonight. Here's the next situation. Sarah has been planning a birthday dinner for herself. She tells James about it two weeks in advance. James texts he can't make it. They get into a bigger fight. --- Sarah and James have been together for two years. Sarah has been working late most nights. James says 'Must be nice to finally have good news for once.' What do you think Sarah felt when James made that comment?";
    const messages = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to not taking mom calls unless it is an emergency.',
        scenarioNumber: 1,
      },
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to not taking mom calls unless it is an emergency.',
        scenarioNumber: 1,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(garbled, 'Matt', messages, 1, 1);
    expect(out).toMatch(WRAP_LEAD_ANCHOR);
    expect(out).not.toContain('Nice work, Matt');
    expect(out).toContain('Sarah has been job hunting for four months');
    expect(out).toContain('What do you think is going on here?');
    expect(out).not.toMatch(/birthday dinner/i);
    expect(out).not.toMatch(/working late/i);
    expect(out).not.toMatch(/Must be nice/i);
  });

  it('does not coerce S1→S2 handoff with Sarah vignette into S2→S3', () => {
    const s1ToS2 =
      "That's the end of that scenario. What I heard was that repair, for you, starts with making sure it doesn't happen again Here's the next situation. Sarah has been job hunting for four months. She gets an offer and calls James from the street.";
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'I would say proper boundaries with my mom and commit to not taking calls during dates unless it is an emergency.',
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(s1ToS2, 'Matt', messages, 1, 1);
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
    expect(out).not.toMatch(/third situation/i);
  });

  it('injects short S2→S3 wrap when scenario ref already advanced to 3', () => {
    const bareHandoff =
      "That scenario is complete. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.";
    const messages = [
      ...SCENARIO_B_CORPUS_MESSAGES,
      {
        role: 'assistant',
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'He should have celebrated her before asking about salary and commute.',
        scenarioNumber: 2,
      },
      { role: 'assistant', content: 'And if you were James, how would you repair?', scenarioNumber: 2 },
      {
        role: 'user',
        content:
          "I'd apologize for leading with logistics, ask how she'd like to be celebrated, and commit to doing that next time.",
        scenarioNumber: 2,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(bareHandoff, 'Matt', messages, 3, 3);
    expect(out).toMatch(WRAP_LEAD_ANCHOR);
    expect(out).not.toContain('Nice work, Matt');
    expect(out).toContain('Sophie');
  });

  it('does not coerce valid S3→M4 handoff with reflection back to S2→S3 Sophie vignette', () => {
    const m4Handoff =
      "That's the end of the three described situations. What I heard was that you're reading his silence as fear rather than avoidance There are only two questions left. Now I want to ask you about something a bit more personal.\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          'A sit down and an honest conversation is the only way the situation can be repaired or this would just stand as a sticking point forever.',
        scenarioNumber: 3,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(m4Handoff, 'Matt', messages, 3, 3);
    expect(out).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
    expect(out).not.toMatch(/here'?s the third situation/i);
    expect(out).toMatch(/two questions left/i);
    expect(out).toContain(MOMENT_4_GRUDGE_QUESTION_TEXT);
  });

  it('coerces S3→M4 handoff into short wrap without content reflection', () => {
    const bareHandoff =
      "That makes a lot of sense. Good work — you just finished the three situations. There are only two questions left. Now I want to ask you about something a bit more personal. Think of someone you've had a really hard time with";
    const messages = [
      {
        role: 'user',
        content:
          "Daniel felt at a loss and didn't know what to say while Sophie felt dismissed when he left.",
        scenarioNumber: 3,
      },
      {
        role: 'user',
        content:
          'She must have felt dismissed and left hanging and did not know what Daniel was for.',
        scenarioNumber: 3,
      },
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          "They probably need some time spent to figure out if they're actually compatible.",
        scenarioNumber: 3,
      },
    ];
    const out = coerceScenarioBoundaryHandoffDisplayText(bareHandoff, 'Matt', messages, 3, 4);
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.beforeModal).toMatch(WRAP_LEAD_ANCHOR);
    expect(split.beforeModal).not.toMatch(/You (focused on|named|framed)|Nice work, Matt/i);
    expect(split.afterModal).toMatch(/really hard time with|held a grudge/i);
  });
});
