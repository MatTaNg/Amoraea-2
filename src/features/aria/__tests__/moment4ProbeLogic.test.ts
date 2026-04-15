import {
  evaluateMoment4RelationshipType,
  looksLikeMisplacedNonGrudgeMoment4Answer,
  shouldForceMoment4ThresholdProbe,
} from '../moment4ProbeLogic';

const M4_GRUDGE_CARD =
  "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?";

const M4_THRESHOLD =
  '"At what point do you decide when a relationship is something to work through versus something you need to walk away from?"';

describe('moment4ProbeLogic', () => {
  it('classifies coworker answers as non_close', () => {
    const answer = 'It was a coworker I worked with closely, and I distanced myself from them.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    expect(evalResult.relationshipType).toBe('non_close');
    expect(evalResult.nonCloseSignals).toContain('coworker');
  });

  it('triggers commitment follow-up eligibility in Moment 4 regardless of relationship classification', () => {
    const answer = 'A colleague at work kept taking credit and I stepped back.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    expect(evalResult.relationshipType).toBe('non_close');
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: answer,
      })
    ).toBe(true);
  });

  it('triggers threshold probe when Moment 4 and probe not yet asked; stops after probe ref is set', () => {
    const okAnswer = 'I held a grudge against my roommate for a year; we worked through it slowly.';
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(true);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: true,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(false);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: false,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: okAnswer,
      })
    ).toBe(false);
  });

  it('does not force threshold when last assistant was the threshold question (user answering follow-up)', () => {
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_THRESHOLD,
        userAnswerText: 'I would leave when trust was gone for good.',
      })
    ).toBe(false);
  });

  it('does not force threshold when user answers Scenario C fiction instead of the grudge prompt (attempt 153)', () => {
    const misplaced =
      "I think they'd need to genuinely try everything first — probably including couples therapy — before calling it. One recurring argument isn't enough. But if Daniel kept leaving and never came back, or if Sophie kept escalating every time Daniel needed space and neither of them could shift their pattern even with help, that's when I'd say it's not working.";
    expect(looksLikeMisplacedNonGrudgeMoment4Answer(misplaced)).toBe(true);
    expect(
      shouldForceMoment4ThresholdProbe({
        isMoment4: true,
        probeAlreadyAsked: false,
        lastAssistantContent: M4_GRUDGE_CARD,
        userAnswerText: misplaced,
      })
    ).toBe(false);
  });
});

