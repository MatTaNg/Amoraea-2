import { describe, expect, it } from '@jest/globals';

import {
  ensureAcknowledgmentBeforeMove,
  prependBriefAckIfMissingBeforeMove,
  stripBriefAckWhenUserTurnIsNonSubstantive,
} from '../interviewAcknowledgmentMoveGate';
import { chooseBriefScenarioAck } from '../interviewReflectionAckVariation';

describe('prependBriefAckIfMissingBeforeMove', () => {
  it('does not prepend Makes sense before approved elongating probe', () => {
    const draft = 'Can you say more about that?';
    const user =
      'If I really liked Emma, I would assure her that this would not happen again and actually...';
    const out = prependBriefAckIfMissingBeforeMove(draft, user, []);
    expect(out).toBe('Can you say more about that?');
  });

  it('prepends a brief ack when the model jumps straight to the next question', () => {
    const draft = 'What do you think James could have done differently to help Sarah feel appreciated?';
    const user = 'I think he should have listened before offering solutions.';
    const out = prependBriefAckIfMissingBeforeMove(draft, user, []);
    expect(out).toMatch(/^(Got it\.|Makes sense\.|That makes a lot of sense\.|I'm with you\.)/);
    expect(out).toContain('What do you think James');
  });

  it('does not double-ack when the model already opened with a receipt', () => {
    const draft = "Makes sense. What if you were Ryan — how would you repair this situation?";
    const out = prependBriefAckIfMissingBeforeMove(draft, 'I would apologize first.', []);
    expect(out).toBe(draft);
  });

  it('does not prepend on scenario boundary closure turns', () => {
    const draft =
      "That's all for that situation. What I heard was that staying in the conversation matters to you more than walking away. Here's the second situation.";
    const out = prependBriefAckIfMissingBeforeMove(draft, 'I would stay and talk it through.', []);
    expect(out).toBe(draft);
  });

  it('does not skip ack when user answer only shares common filler words with the next question', () => {
    const draft = 'How would you repair this relationship if you were Ryan?';
    const out = prependBriefAckIfMissingBeforeMove(
      draft,
      'I would apologize and listen to how Emma feels.',
      [],
    );
    expect(out).toMatch(/^(Got it\.|Makes sense\.|That makes a lot of sense\.|I'm with you\.)/);
  });

  it('does not prepend ack for off-topic non-English replies', () => {
    const draft = 'I only work in English for now — just say whatever comes to mind.';
    const out = prependBriefAckIfMissingBeforeMove(draft, 'Hablo Espanol', []);
    expect(out).toBe(draft);
  });
});

describe('stripBriefAckWhenUserTurnIsNonSubstantive', () => {
  it('strips leading ack when user turn did not answer the question', () => {
    const draft =
      'That makes a lot of sense. I only work in English for now — just say whatever comes to mind.';
    const out = stripBriefAckWhenUserTurnIsNonSubstantive(draft, 'Hablo Espanol');
    expect(out).toBe('I only work in English for now — just say whatever comes to mind.');
  });

  it('preserves ack when user gave a substantive answer', () => {
    const draft = "That makes a lot of sense. What if you were Ryan — how would you repair this?";
    const out = stripBriefAckWhenUserTurnIsNonSubstantive(
      draft,
      'I would apologize and listen to how Emma feels.',
    );
    expect(out).toBe(draft);
  });
});

describe('chooseBriefScenarioAck', () => {
  it('never repeats the same ack as the immediately prior assistant turn', () => {
    const recent = [{ role: 'assistant', content: 'Got it. How would you repair this?' }];
    for (let i = 0; i < 12; i++) {
      const pick = chooseBriefScenarioAck(recent);
      expect(pick).not.toBe('Got it.');
    }
  });
});
