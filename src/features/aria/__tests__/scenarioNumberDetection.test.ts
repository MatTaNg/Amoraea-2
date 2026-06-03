import { describe, expect, it } from 'vitest';
import { detectScenarioFromResponse, getScenarioNumberForNewMessage } from '../scenarioNumberDetection';

describe('detectScenarioFromResponse', () => {
  it('detects scenario 3 on S2→S3 wrap that recaps Sarah and James', () => {
    const transition =
      "That's the end of this scenario — Great work, Matt — you saw that James led with logistics when Sarah needed emotional celebration. Here's the third situation, and after this we'll shift to something more personal: Sophie and Daniel have had the same argument.";
    expect(detectScenarioFromResponse(transition)).toBe(3);
  });

  it('detects scenario 2 on Sarah/James vignette without third-situation markers', () => {
    const s2 =
      "Here's the next situation: Sarah has been job hunting for four months. James says they should celebrate the offer.";
    expect(detectScenarioFromResponse(s2)).toBe(2);
  });

  it('does not match celebration as celebrate for scenario 2 when third situation is present', () => {
    const recap =
      'James led with logistics when Sarah needed emotional celebration. Here\'s the third situation.';
    expect(detectScenarioFromResponse(recap)).toBe(3);
  });

  it('detects scenario 1 on Emma/Ryan opening', () => {
    expect(detectScenarioFromResponse("Here's the first situation: Emma and Ryan are at dinner.")).toBe(1);
  });
});

describe('getScenarioNumberForNewMessage', () => {
  it('inherits last scenario for user turns', () => {
    const prev = [
      { role: 'assistant', content: 'x', scenarioNumber: 3 },
      { role: 'user', content: 'y', scenarioNumber: 3 },
    ];
    expect(getScenarioNumberForNewMessage(prev, 'user')).toBe(3);
  });

  it('detects scenario from assistant content before falling back to last', () => {
    const prev = [{ role: 'assistant', content: 's2', scenarioNumber: 2 }];
    const s3 = "Here's the third situation: Sophie and Daniel have had the same argument.";
    expect(getScenarioNumberForNewMessage(prev, 'assistant', s3)).toBe(3);
  });
});
