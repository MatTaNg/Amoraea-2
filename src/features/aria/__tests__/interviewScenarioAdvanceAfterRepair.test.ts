import { describe, expect, it } from '@jest/globals';

import { applyPostClaudeScenarioAdvanceBundleOverride, resolveScenarioUserTextForBoundaryReflection, shouldAdvanceScenarioCAfterSatisfiedDanielRepair } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  scenarioBMinimumEngagementForHandoff,
} from '@features/aria/scenarioBProbeLogic';
import {
  shouldAdvanceScenarioBAfterSatisfiedRepair,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
} from '@features/aria/interviewDisengagementProbes';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { MOMENT_4_HANDOFF_NO_NAME_LEAD } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import {
  buildBoundaryReflectionSentence,
  summarizeUserAnswerForBoundaryReflection,
} from '@features/aria/interviewAcknowledgmentMoveGate';

describe('summarizeUserAnswerForBoundaryReflection', () => {
  it('returns interpretive conclusion instead of verbatim repair clip', () => {
    const user = [
      "I would ask Sarah how she'd like to be celebrated and commit to celebrating her the way she'd like.",
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
    ].join('\n');
    const summary = summarizeUserAnswerForBoundaryReflection(user);
    expect(summary).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(summary).toMatch(/define what support|logistics|dismissed/i);
    expect(summary).not.toContain("ask Sarah how she'd like");
    expect(summary).not.toContain('care shows up');
  });

  it('buildBoundaryReflectionSentence returns conclusion without praise', () => {
    const corpus = [
      'I would apologize and try to understand what she needed from me in that moment.',
      'She must have felt dismissed because he went straight to fixing the plan instead of hearing her out.',
      'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
    ].join('\n');
    const out = buildBoundaryReflectionSentence('Matt', corpus, { openerIndex: 0 });
    expect(out).toMatch(/^You (focused on|named|framed|pointed to|highlighted)/);
    expect(out).not.toMatch(/So your instinct is/i);
    expect(out).not.toMatch(/Great work/i);
    expect(out).not.toMatch(/^Matt/i);
  });
});

describe('applyPostClaudeScenarioAdvanceBundleOverride', () => {
  it('injects S1→S2 bundle when Ryan repair is satisfied but boundary reflection truncates mid-word', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this relationship if you were Ryan?' },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to it.',
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "Got it. That's Situation 1 wrapped up. So your inst",
      'Matt',
      messages,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).toMatch(/that's the end of this scenario|here's the next situation/i);
    expect(out).not.toContain('Nice work, Matt');
    expect(out).not.toMatch(/You (focused on|named|framed|pointed to|highlighted)/i);
  });

  it('injects S1→S2 bundle when Ryan repair uses voicemail/commit phrasing', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this relationship if you were Ryan?' },
      {
        role: 'user',
        content:
          "I always set proper boundaries with my mom, all calls go to voicemail during dates, and I'll commit to it.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'So your INST',
      'Matt',
      messages,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('injects S1→S2 bundle when modal follow-up sits between repair ask and satisfied answer', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      { role: 'assistant', content: 'Just say whatever comes to mind.' },
      {
        role: 'user',
        content:
          'I said I would make sure all calls go to voicemail during dates with my mom and commit to it.',
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride('', 'Matt', messages, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('injects S1→S2 bundle when Ryan repair is satisfied but model re-asks truncated Emma contempt', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this relationship if you were Ryan?' },
      {
        role: 'user',
        content:
          "I always set proper boundaries with my mom, all calls go to voicemail during dates, and I'll commit to it.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "So your instinct is that repair lives in the structure you put in place, not just the intention you express. What do you think Emma",
      'Matt',
      messages,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('does not advance Scenario A after Q1 when model emits premature S1 boundary wrap', () => {
    const q1Answer =
      "Yeah, it sounds like a painful pattern of their, you know, not communication of what's acceptable during time together. I would be hurt too, if someone answered a phone call during a date.";
    const messages = [
      {
        role: 'assistant',
        content:
          "Ryan and Emma are on their third date. Ryan's mom calls during dinner. Emma is upset. What do you think is going on between these two?",
      },
      { role: 'user', content: q1Answer, scenarioNumber: 1 },
    ];
    const handoff =
      "That's a wrap on that one. Nice work, Matt — You focused on putting concrete limits on calls during dates so the same interruption does not repeat. We've got two more situations to get through.";
    expect(applyPostClaudeScenarioAdvanceBundleOverride(handoff, 'Matt', messages, 1, 1)).toBeNull();
  });

  it('injects S1→S2 bundle when Ryan repair is satisfied but model returns only Got it', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd start by acknowledging what Emma lost and commit to being fully present, not just apologizing for the call.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride('Got it.', 'Match', messages, 1, 1);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('injects S1→S2 bundle when Ryan repair is satisfied but model emits premature interview closing', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I'd apologize and have a real conversation about what it means to her when I'm fully present.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'Good work getting through all of this, Match. Thank you for being so open with me, Match.',
      'Match',
      messages,
      1,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('injects S2→S3 bundle when James repair is satisfied but model wrap omits Scenario C vignette', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this as James?' },
      {
        role: 'user',
        content:
          "I would ask Sarah how she'd like to be celebrated and commit to celebrating her the way she'd like.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That's a wrap on that scenario. Nice work, Matt — you'd ask Sarah how she wants to be celebrated and commit to that",
      'Matt',
      messages,
      2,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
    expect(out).toMatch(/one more situation/i);
  });

  it('injects S2→S3 bundle when boundary reflection truncates mid-sentence without vignette', () => {
    const messages = [
      { role: 'assistant', content: 'If you were James, how would you repair this situation?' },
      {
        role: 'user',
        content:
          "I would ask her how she'd like to be celebrated and commit to celebrating her that way.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'That situation is complete. So your read is that repair means meeting',
      'Matt',
      messages,
      2,
      2,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
  });

  it('injects S2→S3 bundle when live scenario is 2 but interview moment is still 1', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this as James?' },
      {
        role: 'user',
        content:
          "I would apologize and ask Sarah how she'd like to be celebrated and commit to celebrating her out she's like",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That's a wrap on Scenario B. Nice work, Matt — you saw that",
      'Matt',
      messages,
      1,
      2,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
  });

  it('injects S1→S2 bundle when model uses "that scenario\'s done" and "what came through was" paraphrase', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "I would make sure that nothing happens and during the date all calls go to voicemail during the dates and I'll commit to it.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That scenario's done — good work on that one. What came through was that you'd address the behavior directly",
      'Matt',
      messages,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
  });

  it('injects S1→S2 bundle when Ryan repair is satisfied but model uses softened reflection opener', () => {
    const messages = [
      { role: 'assistant', content: 'How would you repair this relationship if you were Ryan?' },
      {
        role: 'user',
        content:
          'I would apologize and make sure my calls go to voice mode during dates so I can be present and commit to it.',
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "Got it. That's Situation 1 done. What I got was",
      'Matt',
      messages,
      1,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:1\]/i);
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).not.toMatch(/What I got was\s*$/i);
  });

  it('injects S2→S3 bundle when James repair satisfied but model boundary truncates mid-reflection', () => {
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here between Sarah and James?' },
      {
        role: 'user',
        content:
          'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
        scenarioNumber: 2,
      },
      {
        role: 'assistant',
        content: 'How would James repair this with Sarah after the fight?',
      },
      {
        role: 'user',
        content:
          "Ask her how she'd like to be celebrated and commit to celebrating her the way she'd like.",
        scenarioNumber: 2,
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That's the end of that situation. What I got was that for you, matching someone",
      'Matt',
      messages,
      2,
      2,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
    expect(out).toContain("That's the second one done.");
    expect(out).not.toContain('Nice work, Matt');
    expect(out).not.toMatch(/You (focused on|named|framed|pointed to|highlighted)/i);
    expect(out).not.toMatch(/that for you, matching/i);
  });

  it('injects S3→M4 bundle when boundary reflection truncates without personal card', () => {
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          "I would make sure I come back early and let Sophie know that I don't mean to hurt her and I'll talk about what's going on with me.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'That wraps up the three situations. So your instinct is that showing up and',
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toMatch(/So your instinct is/i);
  });

  it('injects S2→S3 bundle when model jumps to premature M4 handoff after scenario 2', () => {
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content: "I'd let her define what support looks like rather than assuming I know.",
      },
    ];
    const prematureM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    const out = applyPostClaudeScenarioAdvanceBundleOverride(prematureM4, 'Matt', messages, 2, 2);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
    expect(out).not.toContain('two questions left');
  });

  it('injects S3→M4 bundle when Q1 already covers Sophie and repair but model asks Sophie role-play', () => {
    const q1 =
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
    const userAnswer =
      "Sophie reads that as abandonment. Daniel needs to own the pattern and come back consistently. To repair this rupture, Daniel should say he wants to work on it.";
    const messages = [
      { role: 'assistant', content: q1 },
      { role: 'user', content: userAnswer },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'Makes sense. Now, how would you handle it if you were Sophie in this moment',
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/really hard time with|held a grudge/i);
    expect(out).not.toContain('if you were Sophie');
  });

  it('injects S3→M4 bundle for truncated what came through was ending', () => {
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          "Daniel needs to come back sooner and they need to figure out why he's leaving.",
      },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That's the end of the three situations. What came through was that you'd treat Daniel's exits as something",
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/held a grudge|really hard time with/i);
  });

  it('does not inject S3→M4 bundle when Sophie perspective was answered but repair Q2 not yet delivered', () => {
    const sophieWithAck =
      'Got it. What do you think this pattern of leaving has been like for Sophie over time?';
    const messages = [
      { role: 'assistant', content: sophieWithAck },
      { role: 'user', content: "She's probably annoyed." },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "That makes a lot of sense. Good work — you just finished the three situations.",
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toBeNull();
  });

  it('advances to Moment 4 when Sophie perspective answer already includes repair and model asks Sophie-respond misparaphrase', () => {
    const repairRichAnswer =
      "Sophie's experience of abandonment is completely valid. The repair needs Daniel to own the impact while Sophie gives him slightly more time to regulate.";
    const messages = [
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
      { role: 'user', content: repairRichAnswer },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      'Got it. How would you want Sophie to respond when Daniel comes back?',
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/held a grudge|really hard time with/i);
  });

  it('advances to Moment 4 when repair Q2 is answered and model emits truncated S3 boundary wrap', () => {
    const userAnswer =
      "Daniel needs to own the pattern across all times this has happened, not just tonight. And he needs to say explicitly, when I asked for 10 minutes, I'm committing to coming back, not leaving.";
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      { role: 'user', content: userAnswer },
    ];
    const out = applyPostClaudeScenarioAdvanceBundleOverride(
      "Got it. That's the end of situation three. What landed",
      'Matt',
      messages,
      3,
      3,
    );
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toMatch(/What landed\s*$/i);
  });

  it('recognizes session-log James repair answer as satisfying Scenario B repair prompt', () => {
    const userAnswer =
      'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.';
    expect(
      userAnswerSatisfiesScenarioBJamesRepairPrompt(
        userAnswer,
        'And if you were James, how would you repair?',
      ),
    ).toBe(true);
  });

  it('advances Scenario B when James repair is satisfied but model redirects to Q1', () => {
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    const redirect =
      "Got it — that's actually what I'll ask you about in a moment. First, what do you think is going on between Sarah and James in that situation?";
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, redirect, 2)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(redirect, 'Matt', messages, 2, 2);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
  });

  it('advances Scenario B when James repair is satisfied but model returns mandatory Q2', () => {
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    const q2 =
      'What do you think James could have done differently to help Sarah feel appreciated?';
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, q2, 2)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(q2, 'Matt', messages, 2, 2);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:2\]/i);
    expect(out).toMatch(/Sophie and Daniel/i);
  });

  it('does not advance Scenario B when only one Scenario B user turn exists after Q1 jump-ahead', () => {
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
        scenarioNumber: 2,
      },
    ];
    const handoff =
      "That scenario is complete. Here's the third situation — after this we'll move to something more personal. Sophie and Daniel have had the same argument.";
    expect(scenarioBMinimumEngagementForHandoff(messages)).toBe(false);
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, handoff, 2)).toBe(false);
    expect(applyPostClaudeScenarioAdvanceBundleOverride(handoff, 'Matt', messages, 2, 2)).toBeNull();
  });

  it('does not advance Scenario B when user jumps ahead from vignette Q1 with James-style repair', () => {
    const vignette =
      "Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' That evening James leads with questions about the salary, the start date, and the commute. At one point Sarah tears up. James says 'hey don't cry, this is a good thing'. The next day Sarah tells James she never feels appreciated. James is blindsided, he showed up, he celebrated, he asked questions. A fight starts. What do you think is going on here?";
    const messages = [
      { role: 'assistant', content: vignette },
      {
        role: 'user',
        content:
          "If I were James, I would apologize and reflect on my behavior and answer her that I would try to be better in the future and assure her that I'll be better in the future.",
      },
    ];
    const q2 =
      'What do you think James could have done differently to help Sarah feel appreciated?';
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, q2, 2)).toBe(false);
    expect(applyPostClaudeScenarioAdvanceBundleOverride(q2, 'Matt', messages, 2, 2)).toBeNull();
  });

  it('advances Scenario B when repair answer follows Q2 and model re-asks repair Q3', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
      },
      {
        role: 'user',
        content:
          'I would apologize and in the future I will be more mindful to my partner needs me to be more appreciative.',
      },
    ];
    const repairQ3 = 'And if you were James, how would you repair?';
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, repairQ3, 2)).toBe(true);
  });

  it('does not advance Scenario B when user jumped ahead with repair on Q1 and model re-asks repair Q3', () => {
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will be better in the future.',
      },
    ];
    const repairQ3 = 'Got it. And if you were James, how would you repair?';
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, repairQ3, 2)).toBe(false);
  });

  it('does not advance Scenario B when repair jumps ahead from vignette Q1 and model truncates at Before we', () => {
    const vignette =
      "Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' That evening James leads with questions about the salary, the start date, and the commute. At one point Sarah tears up. James says 'hey don't cry, this is a good thing'. The next day Sarah tells James she never feels appreciated. James is blindsided, he showed up, he celebrated, he asked questions. A fight starts. What do you think is going on here?";
    const messages = [
      { role: 'assistant', content: vignette },
      {
        role: 'user',
        content:
          'If I were James, I would apologize for reflecting my behavior and assure her that I would try to be better in the future.',
      },
    ];
    const truncated =
      "Got it — that sounds like you're already thinking as James. Before we";
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, truncated, 2)).toBe(false);
    expect(applyPostClaudeScenarioAdvanceBundleOverride(truncated, 'Matt', messages, 2, 2)).toBeNull();
  });

  it('does not advance Scenario B when James repair answer follows Q1 redirect (Q2 still pending)', () => {
    const messages = [
      {
        role: 'assistant',
        content:
          "Got it — that's actually what I'll ask you about in a moment. First, what do you think is going on between Sarah and James in that situation?",
      },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    const truncated = "I hear you — and I'll get to that. But first, what do you think caused";
    expect(shouldAdvanceScenarioBAfterSatisfiedRepair(messages, truncated, 2)).toBe(false);
    expect(applyPostClaudeScenarioAdvanceBundleOverride(truncated, 'Matt', messages, 2, 2)).toBeNull();
  });

  it('advances Scenario C when repair answer is substantive but model emits modal follow-up probe', () => {
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          'A sit down and honest conversation is the only way the situation can be repaired when this was just a stay as a sticking point for our',
      },
    ];
    const modalFollowUp = 'Makes sense. Just say whatever comes to mind.';
    expect(shouldAdvanceScenarioCAfterSatisfiedDanielRepair(messages, modalFollowUp, 3)).toBe(true);
    const out = applyPostClaudeScenarioAdvanceBundleOverride(modalFollowUp, 'Matt', messages, 3, 3);
    expect(out).toMatch(/\[SCENARIO_COMPLETE:3\]/i);
    expect(out).toMatch(/held a grudge|really hard time with/i);
  });

  it('advances Scenario C after resume welcome sits between repair prompt and user answer', () => {
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'assistant',
        content:
          "Welcome back! Lets continue where we left off. If you'd like me to repeat what I said, let me know.",
        isWelcomeBack: true,
      },
      {
        role: 'user',
        content:
          'They need to figure out why Daniel has to leave. He needs to feel safe before they can discuss what Sophie wants.',
      },
    ];
    expect(shouldAdvanceScenarioCAfterSatisfiedDanielRepair(messages, '', 3)).toBe(true);
  });

  it('does not inject scenario-complete bundles during moment 5 interview close', () => {
    const messages = [
      { role: 'assistant', content: 'How did it get resolved between you two?' },
      {
        role: 'user',
        content:
          'Yeah, the resolution was me later when I was in stress thinking about the conversation and realizing she was actually being kind.',
      },
    ];
    const boundaryParaphrase =
      "That's the end of the three described situations. Good work, Matt — You framed reopening on her terms rather than pushing a timeline. There are only two questions left.";
    expect(applyPostClaudeScenarioAdvanceBundleOverride(boundaryParaphrase, 'Matt', messages, 5, 3)).toBeNull();
    expect(
      applyPostClaudeScenarioAdvanceBundleOverride(
        '[INTERVIEW_COMPLETE]\n\nGood work getting through all of this. Thank you for being so open with me, Matt.',
        'Matt',
        messages,
        5,
        3,
      ),
    ).toBeNull();
  });
});

describe('resolveScenarioUserTextForBoundaryReflection', () => {
  it('aggregates all scenario 3 user turns instead of only the last answer', () => {
    const messages = [
      { role: 'user', content: 'Daniel was scared and did not know how to handle it.', scenarioNumber: 3 },
      { role: 'user', content: 'They probably need time to figure out if they are compatible.', scenarioNumber: 3 },
    ];
    const corpus = resolveScenarioUserTextForBoundaryReflection(messages, 3);
    expect(corpus).toContain('Daniel was scared');
    expect(corpus).toContain('compatible');
  });

  it('aggregates scenario 1 Emma Q1 and Ryan repair turns for boundary reflection', () => {
    const messages = [
      {
        role: 'user',
        content:
          "Emma's line felt contemptuous — like she'd stopped expecting Ryan to show up for her.",
        scenarioNumber: 1,
        interviewMoment: 1,
      },
      {
        role: 'user',
        content:
          'I would make sure all calls go to voicemail during dates and commit to it.',
        scenarioNumber: 1,
      },
      {
        role: 'user',
        content:
          "Daniel felt confused and Sophie felt dismissed when he left — should not pollute S1.",
        scenarioNumber: 3,
      },
    ];
    const corpus = resolveScenarioUserTextForBoundaryReflection(messages, 1);
    expect(corpus).toContain('Emma');
    expect(corpus).toContain('voicemail');
    expect(corpus).not.toContain('Daniel');
    expect(corpus).not.toContain('Sophie');
  });
});
