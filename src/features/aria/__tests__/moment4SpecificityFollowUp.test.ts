import { describe, expect, it } from 'vitest';
import {
  countInterviewWords,
  deriveMoment4PostGrudgeSpecificityResolvedFromMessages,
  hasMoment4PersonRelationshipOrSituationAnchor,
  looksLikeMoment4SpecificityFollowUpPrompt,
  MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
  needsMoment4SpecificityFollowUp,
} from '../moment4SpecificityFollowUp';

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
    expect(looksLikeMoment4SpecificityFollowUpPrompt('Random text')).toBe(false);
  });

  it('needs follow-up when very short', () => {
    expect(needsMoment4SpecificityFollowUp('yes maybe sometimes')).toBe(true);
  });

  it('does not need follow-up for short concrete grudge (years ago + demonstrative)', () => {
    const t =
      "Yes, this woman cut me off 20 years ago. I'm still upset at her. Some people should not be driving.";
    expect(countInterviewWords(t)).toBeLessThan(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('does not need follow-up when user points at "the woman driving" (short)', () => {
    const t = 'Yes, I already gave you one. The woman driving.';
    expect(countInterviewWords(t)).toBeLessThan(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('needs follow-up when long but no person/relationship/situation anchors', () => {
    const generic =
      'I think people should generally try to be nice and communication is important in life overall and one ought to consider many perspectives in society broadly speaking across cultures while staying polite and cooperative in groups and valuing harmony without naming anyone concrete.';
    expect(countInterviewWords(generic)).toBeGreaterThanOrEqual(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(generic)).toBe(false);
    expect(needsMoment4SpecificityFollowUp(generic)).toBe(true);
  });

  it('does not need follow-up when adequate length and person/situation anchors', () => {
    const t =
      'I felt really hurt when my friend Sarah dismissed what happened — we had argued before but this time I just shut down and I kept replaying it in my head for weeks because it mattered to me and I could not let it go easily at all.';
    expect(countInterviewWords(t)).toBeGreaterThanOrEqual(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('needs follow-up when long but only generic habit language (no anchor)', () => {
    const t =
      "I've had grudges before but I work through them generally and try to move on with life overall without dwelling too much on past conflicts in most situations day to day.";
    expect(countInterviewWords(t)).toBeGreaterThanOrEqual(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(false);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(true);
  });

  it('does not need follow-up for long grudge + forgive + boundaries answer (grudge against someone / people in my life)', () => {
    const t =
      "I've learned that it really takes a lot of energy to hold a grudge against someone so I tend to just forgive and move on and have boundaries and I don't allow the same bad habits or situations to pop up for me and I just don't include those people in my life.";
    expect(countInterviewWords(t)).toBeGreaterThanOrEqual(30);
    expect(hasMoment4PersonRelationshipOrSituationAnchor(t)).toBe(true);
    expect(needsMoment4SpecificityFollowUp(t)).toBe(false);
  });

  it('derive gate: resolved after adequate first grudge answer', () => {
    const grudge =
      'Have you ever held a grudge against someone, or had someone in your life you really did not like? How did that happen, and where are you with it now?';
    const rich =
      'When my coworker Jim took credit for my project last year I stopped trusting him and we barely speak — it still bothers me sometimes but I keep professional distance.';
    const msgs = [
      { role: 'assistant' as const, content: grudge },
      { role: 'user' as const, content: rich },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs)).toBe(true);
  });

  it('derive gate: not resolved until user answers specificity probe', () => {
    const grudge =
      'Have you ever held a grudge against someone, or had someone in your life you really did not like? How did that happen, and where are you with it now?';
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
      { role: 'user' as const, content: 'Fine — my cousin Rita and I fell out over the estate thing.' },
    ];
    expect(deriveMoment4PostGrudgeSpecificityResolvedFromMessages(msgs2)).toBe(true);
  });
});
