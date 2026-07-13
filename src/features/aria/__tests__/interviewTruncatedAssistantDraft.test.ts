import {
  coerceInterviewAssistantDraftForSpeak,
  isGenericTruncatedAssistantDraft,
  spokenTextMissesCoercedAssistantDraft,
} from '@features/aria/interviewTruncatedAssistantDraft';
import { MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY, MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { buildClientScenarioBoundaryHandoffBundle } from '@features/aria/interviewTransitionBundles';

describe('interviewTruncatedAssistantDraft', () => {
  it('detects S1 wraps up this situation handoff fragment', () => {
    expect(isGenericTruncatedAssistantDraft('Got it. That wraps up this situation.')).toBe(true);
  });

  it('coerces S1 post-repair wraps up this situation to Sarah vignette bundle', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'From Ryan, I really liked Emma. I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const out = coerceInterviewAssistantDraftForSpeak('Got it. That wraps up this situation.', {
      interviewMoment: 1,
      currentScenario: 1,
      firstName: 'Matt',
      messages,
    });
    expect(out).toMatch(/Sarah has been job hunting/i);
    expect(out).toMatch(/here'?s the next situation/i);
  });

  it('detects M4 threshold paraphrase truncated mid-clause from session logs', () => {
    const truncated = "Got it. When things go sideways with someone — whether it's that";
    expect(isGenericTruncatedAssistantDraft(truncated)).toBe(true);
  });

  it('detects S1 wraps up the first situation handoff fragment', () => {
    expect(isGenericTruncatedAssistantDraft('Got it. That wraps up the first situation.')).toBe(true);
  });

  it('does not flag complete M4 threshold question', () => {
    expect(isGenericTruncatedAssistantDraft(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY)).toBe(
      false,
    );
  });

  it('coerces M4 truncated threshold paraphrase after specificity follow-up answer', () => {
    const messages = [
      { role: 'assistant', content: 'Tell me about someone who got under your skin.' },
      { role: 'user', content: 'Some guy at work.' },
      {
        role: 'assistant',
        content:
          'Can you think of a specific person — even if it is just someone from a while back — and tell me a bit more about what happened?',
      },
      { role: 'user', content: "No, that's the best I got." },
    ];
    const truncated = "Got it. When things go sideways with someone — whether it's that";
    const out = coerceInterviewAssistantDraftForSpeak(truncated, {
      interviewMoment: 4,
      currentScenario: 3,
      firstName: 'Matt',
      messages,
    });
    expect(out).toMatch(/walk away from/i);
    expect(isGenericTruncatedAssistantDraft(out)).toBe(false);
  });

  it('spokenTextMissesCoercedAssistantDraft when stream spoke truncated clause', () => {
    const spoken = "Got it. When things go sideways with someone — whether it's that";
    const coerced =
      'Got it. Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';
    expect(spokenTextMissesCoercedAssistantDraft(spoken, coerced)).toBe(true);
  });

  it('coerces S2 truncated Q1 redirect to canonical Q1 when user has not yet satisfied James repair', () => {
    const truncated =
      "I hear you — and I'll get to that. But first, what do you think caused";
    const messages = [
      {
        role: 'assistant',
        content:
          "Got it — that's actually what I'll ask you about in a moment. First, what do you think is going on between Sarah and James in that situation?",
      },
      {
        role: 'user',
        content:
          'Sarah feels blindsided because James focused on logistics instead of celebrating her emotionally.',
      },
    ];
    const out = coerceInterviewAssistantDraftForSpeak(truncated, {
      interviewMoment: 2,
      currentScenario: 2,
      firstName: 'Matt',
      messages,
    });
    expect(out).toBe("I hear you — and I'll get to that. What do you think is going on here?");
    expect(isGenericTruncatedAssistantDraft(out)).toBe(false);
  });

  it('does not complete Scenario B when jump-ahead James answer follows Q1 and model re-asks Q1 truncated', () => {
    const truncated =
      "I hear you — and I'll get to that. But first, what do you think caused";
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
    const out = coerceInterviewAssistantDraftForSpeak(truncated, {
      interviewMoment: 2,
      currentScenario: 2,
      firstName: 'Matt',
      messages,
    });
    expect(out).not.toMatch(/Sophie and Daniel/i);
    expect(out).not.toMatch(/scenario is complete/i);
    expect(out).toMatch(/what do you think is going on here/i);
  });

  it('coerces satisfied James repair + truncated Q1 redirect to S2→S3 bundle at speak', () => {
    const truncated = "I hear you — and I'll get to that. But first, what do you think caused";
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    const out = coerceInterviewAssistantDraftForSpeak(truncated, {
      interviewMoment: 2,
      currentScenario: 2,
      firstName: 'Matt',
      messages,
    });
    expect(out).toMatch(/Sophie and Daniel/i);
    expect(out).toMatch(/third situation/i);
  });

  it('preserves S3→M4 handoff bundle at moment 4 instead of M4 specificity follow-up', () => {
    const messages = [
      { role: 'assistant', content: 'How do you think this situation could be repaired?' },
      {
        role: 'user',
        content:
          'A sit-down and an honest conversation is the only way this situation can be repaired.',
        scenarioNumber: 3,
      },
    ];
    const bundle = buildClientScenarioBoundaryHandoffBundle(
      3,
      'Matt',
      {
        scenario3:
          'A sit-down and an honest conversation is the only way this situation can be repaired.',
      },
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );
    const out = coerceInterviewAssistantDraftForSpeak(bundle, {
      interviewMoment: 4,
      currentScenario: 3,
      firstName: 'Matt',
      messages,
    });
    expect(out).toMatch(/end of the three described situations/i);
    expect(out).toMatch(/really hard time with/i);
    expect(out).not.toMatch(/specific person — even if/i);
  });

  it('coerces jump-ahead James repair redirect cutoff to mandatory Q2 (not scenario advance)', () => {
    const truncated =
      "Got it — that sounds like you're already thinking as James. Before we";
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
    const out = coerceInterviewAssistantDraftForSpeak(truncated, {
      interviewMoment: 2,
      currentScenario: 2,
      firstName: 'Matt',
      messages,
    });
    expect(out).toMatch(/James could have done differently/i);
    expect(out).not.toMatch(/Sophie and Daniel/i);
    expect(out).not.toMatch(/scenario is complete/i);
    expect(isGenericTruncatedAssistantDraft(out)).toBe(false);
  });
});
