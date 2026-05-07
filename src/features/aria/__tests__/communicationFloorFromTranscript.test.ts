import {
  COMMUNICATION_FLOOR_MIN_AVG_WORDS,
  computeCommunicationFloorMetrics,
  communicationFloorFieldsFromTranscript,
  countWords,
} from '../communicationFloorFromTranscript';

describe('communicationFloorFromTranscript', () => {
  it('counts words', () => {
    expect(countWords('  one two three  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });

  it('treats probe follow-ups as prompted (not counted)', () => {
    const transcript = [
      { role: 'assistant', content: 'Here is the first situation with Emma and Ryan. What stands out?' },
      { role: 'user', content: 'word '.repeat(25).trim() },
      { role: 'assistant', content: 'Can you say more about that?' },
      { role: 'user', content: 'short' },
      { role: 'assistant', content: 'Second scenario James and Sarah — initial reaction?' },
      { role: 'user', content: 'word '.repeat(25).trim() },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(2);
    expect(m.averageUnpromptedWordCount).toBe(25);
    expect(m.flagged).toBe(false);
  });

  it('flags when average unprompted words is below floor', () => {
    const transcript = [
      { role: 'assistant', content: 'Here is the first situation with Emma and Ryan. What stands out?' },
      { role: 'user', content: 'one two three four five' },
      { role: 'assistant', content: 'Scenario two James and Sarah — what lands?' },
      { role: 'user', content: 'six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen' },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(2);
    expect(m.averageUnpromptedWordCount).toBe(8);
    expect(m.flagged).toBe(true);
  });

  it('exempts user lines before Scenario A anchor (name + ready)', () => {
    const transcript = [
      { role: 'assistant', content: 'Hi — what can I call you?' },
      { role: 'user', content: 'Alexandra Montgomery Third' },
      { role: 'assistant', content: 'Ready when you are.' },
      { role: 'user', content: 'yes' },
      { role: 'assistant', content: "Here's the first situation with Emma and Ryan." },
      { role: 'user', content: 'word '.repeat(30).trim() },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(1);
    expect(m.flagged).toBe(false);
  });

  it('exempts user reply immediately after welcome-back assistant', () => {
    const transcript = [
      { role: 'assistant', content: "Here's the first situation with Emma and Ryan." },
      { role: 'user', content: 'word '.repeat(22).trim() },
      { role: 'assistant', content: 'Welcome back — pick up where we left off.', isWelcomeBack: true },
      { role: 'user', content: 'sure' },
      { role: 'assistant', content: 'Going deeper on Emma and Ryan — what else?' },
      { role: 'user', content: 'word '.repeat(22).trim() },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(2);
    expect(m.flagged).toBe(false);
  });

  it('counts scenarios A–C when scenarioNumber is omitted on messages (stored transcript shape)', () => {
    const transcript = [
      { role: 'assistant', content: 'Hi — what can I call you?' },
      { role: 'user', content: 'Alex' },
      { role: 'assistant', content: 'Ready when you are.' },
      { role: 'user', content: 'yes' },
      { role: 'assistant', content: "Here's the first situation with Emma and Ryan." },
      { role: 'user', content: 'word '.repeat(22).trim() },
      { role: 'assistant', content: 'James and Sarah — second scenario.' },
      { role: 'user', content: 'word '.repeat(22).trim() },
      {
        role: 'assistant',
        content: 'Something more personal — think of a real memory where you held a grudge.',
      },
      { role: 'user', content: 'word '.repeat(22).trim() },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(3);
    expect(m.averageUnpromptedWordCount).toBe(22);
    expect(m.flagged).toBe(false);
  });

  it('includes moment 4 and 5 via assistant anchors', () => {
    const transcript = [
      { role: 'assistant', content: 'First situation Emma and Ryan.' },
      { role: 'user', scenarioNumber: 1, content: 'word '.repeat(22).trim() },
      { role: 'assistant', scenarioNumber: 2, content: 'James and Sarah scenario.' },
      { role: 'user', scenarioNumber: 2, content: 'word '.repeat(22).trim() },
      { role: 'assistant', scenarioNumber: 3, content: 'Sophie and Daniel.' },
      { role: 'user', scenarioNumber: 3, content: 'word '.repeat(22).trim() },
      {
        role: 'assistant',
        scenarioNumber: 3,
        content: 'Something a bit more personal — think of a real memory where you held a grudge.',
      },
      { role: 'user', scenarioNumber: 3, content: 'word '.repeat(22).trim() },
      {
        role: 'assistant',
        scenarioNumber: 3,
        content: 'Think of a time you really celebrated someone who matters in your life.',
      },
      { role: 'user', scenarioNumber: 3, content: 'word '.repeat(22).trim() },
    ];
    const m = computeCommunicationFloorMetrics(transcript);
    expect(m.includedUnpromptedCount).toBe(5);
    expect(m.flagged).toBe(false);
  });

  it('communicationFloorFieldsFromTranscript rounds average', () => {
    const transcript = [
      { role: 'assistant', content: 'Emma and Ryan first situation.' },
      { role: 'user', content: 'a b c d e' },
      { role: 'assistant', content: 'James and Sarah second scenario.' },
      { role: 'user', content: 'f g h i j k l m n o' },
    ];
    const f = communicationFloorFieldsFromTranscript(transcript);
    expect(f.communication_floor_flag).toBe(true);
    expect(f.communication_floor_avg_unprompted_words).toBe(7.5);
    expect(COMMUNICATION_FLOOR_MIN_AVG_WORDS).toBe(20);
  });
});
