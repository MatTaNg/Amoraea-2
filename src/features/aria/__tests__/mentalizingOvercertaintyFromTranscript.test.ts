import {
  countMentalizingOvercertaintyInMarkerSlices,
  detectMentalizingOvercertaintyInUserText,
} from '../mentalizingOvercertaintyFromTranscript';

describe('mentalizingOvercertaintyFromTranscript', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects Casey-style scenario overcertainty lines', () => {
    expect(
      detectMentalizingOvercertaintyInUserText(
        "Ryan clearly doesn't care about Emma, he's shown through his actions that his mother will always come first.",
      ),
    ).toBe(true);
    expect(
      detectMentalizingOvercertaintyInUserText(
        "James is definitely emotionally unavailable. He's a type of person who processes everything analytically and can't be present emotionally.",
      ),
    ).toBe(true);
    expect(
      detectMentalizingOvercertaintyInUserText(
        "He's conflict avoidant and probably has avoidant attachment from childhood. Sophie is anxiously attached in their dynamic as a classic anxious avoidant trapper.",
      ),
    ).toBe(true);
  });

  it('counts three scenario slices when model flags are false but transcript has signals', () => {
    const transcript = [
      { role: 'assistant', content: 'Q1', scenarioNumber: 1 },
      {
        role: 'user',
        content:
          "Ryan clearly doesn't care about Emma, he's shown through his actions that his mother will always come first.",
        scenarioNumber: 1,
      },
      { role: 'assistant', content: 'Q2', scenarioNumber: 2 },
      {
        role: 'user',
        content:
          "James is definitely emotionally unavailable. He's a type of person who processes everything analytically and can't be present emotionally.",
        scenarioNumber: 2,
      },
      { role: 'assistant', content: 'Q3', scenarioNumber: 3 },
      {
        role: 'user',
        content:
          "He's conflict avoidant and probably has avoidant attachment from childhood. Sophie is anxiously attached in their dynamic as a classic anxious avoidant trapper.",
        scenarioNumber: 3,
      },
    ];
    const slices = [
      { mentalizing_overcertainty: false },
      { mentalizing_overcertainty: false },
      { mentalizing_overcertainty: false },
      { mentalizing_overcertainty: false },
      { mentalizing_overcertainty: false },
    ];
    expect(countMentalizingOvercertaintyInMarkerSlices(slices, transcript)).toBe(3);
  });

  it('does not fire on clearly hedged inference', () => {
    expect(
      detectMentalizingOvercertaintyInUserText(
        'Ryan might be using the call to avoid tension with Emma; I could be wrong.',
      ),
    ).toBe(false);
  });
});
