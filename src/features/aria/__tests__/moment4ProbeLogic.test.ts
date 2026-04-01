import { evaluateMoment4RelationshipType, shouldForceMoment4ThresholdProbe } from '../moment4ProbeLogic';

describe('moment4ProbeLogic', () => {
  it('classifies coworker answers as non_close', () => {
    const answer = 'It was a coworker I worked with closely, and I distanced myself from them.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    expect(evalResult.relationshipType).toBe('non_close');
    expect(evalResult.nonCloseSignals).toContain('coworker');
  });

  it('does not trigger threshold probe for coworker relationships', () => {
    const answer = 'A colleague at work kept taking credit and I stepped back.';
    const evalResult = evaluateMoment4RelationshipType(answer);
    const shouldFire = shouldForceMoment4ThresholdProbe({
      isMoment4: true,
      relationshipType: evalResult.relationshipType,
      thresholdAlreadyProvided: false,
      probeAlreadyAsked: false,
    });
    expect(shouldFire).toBe(false);
  });
});

