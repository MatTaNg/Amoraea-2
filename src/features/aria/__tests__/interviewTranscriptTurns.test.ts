import { describe, expect, it, vi } from 'vitest';
import {
  appendAssistantTurn,
  appendAssistantTurnMergingConcurrentUsers,
  assistantTurnHasPersistableContent,
  formatTranscriptTurnContentForDisplay,
} from '../interviewTranscriptTurns';
import {
  evaluateMoment5AccountabilityProbe,
  shouldInjectMoment5SpecificityRedirect,
} from '../probeAndScoringUtils';

describe('interviewTranscriptTurns', () => {
  it('appendAssistantTurn skips empty and whitespace-only content', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = [{ role: 'user', content: 'hi' }];
    expect(appendAssistantTurn(base, '')).toBe(base);
    expect(appendAssistantTurn(base, '   ')).toBe(base);
    expect(appendAssistantTurn(base, 'Hello', { scenarioNumber: 3 })).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello', scenarioNumber: 3 },
    ]);
    warn.mockRestore();
  });

  it('assistantTurnHasPersistableContent', () => {
    expect(assistantTurnHasPersistableContent('')).toBe(false);
    expect(assistantTurnHasPersistableContent('  ')).toBe(false);
    expect(assistantTurnHasPersistableContent('ok')).toBe(true);
  });

  it('formatTranscriptTurnContentForDisplay labels empty assistant rows', () => {
    expect(formatTranscriptTurnContentForDisplay('assistant', '')).toBe('(empty assistant turn)');
    expect(formatTranscriptTurnContentForDisplay('user', '')).toBe('');
    expect(formatTranscriptTurnContentForDisplay('assistant', 'Hi')).toBe('Hi');
  });

  it('appendAssistantTurnMergingConcurrentUsers keeps concurrent user turns', () => {
    const snapshot = [
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Max' },
    ];
    const live = [
      ...snapshot,
      { role: 'user', content: 'Yes' },
    ];
    expect(
      appendAssistantTurnMergingConcurrentUsers(live, snapshot, 'Briefing. Are you ready?', {
        scenarioNumber: 1,
      }),
    ).toEqual([
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Max' },
      { role: 'user', content: 'Yes' },
      { role: 'assistant', content: 'Briefing. Are you ready?', scenarioNumber: 1 },
    ]);
  });
});

describe('shouldInjectMoment5SpecificityRedirect', () => {
  const base = {
    narrativeConcrete: false,
    answeringAfterSpecificityRedirect: false,
    specificityRedirectIssued: false,
    specificityRedirectInTranscript: false,
  };

  it('fires for thin answers even when accountability shouldProbe is false', () => {
    const thin = 'Yeah I guess conflict happens sometimes.';
    expect(evaluateMoment5AccountabilityProbe(thin).shouldProbe).toBe(false);
    expect(
      shouldInjectMoment5SpecificityRedirect({
        ...base,
        userText: thin,
      }),
    ).toBe(true);
  });

  it('does not fire when transcript already has a concrete anchor', () => {
    expect(
      shouldInjectMoment5SpecificityRedirect({
        ...base,
        narrativeConcrete: true,
        userText: 'With my friend Alex we argued last week and I walked away.',
      }),
    ).toBe(false);
  });

  it('does not fire after specificity redirect was already issued', () => {
    expect(
      shouldInjectMoment5SpecificityRedirect({
        ...base,
        answeringAfterSpecificityRedirect: true,
        userText: 'Still vague I guess.',
      }),
    ).toBe(false);
  });
});
