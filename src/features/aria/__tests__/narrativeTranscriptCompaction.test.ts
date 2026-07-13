import {
  compactTranscriptForNarrativePrompt,
  isWorkerResourceLimitError,
  shouldAutoCompactTranscriptForNarrative,
} from '../narrativeTranscriptCompaction';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT } from '../interviewShowScenarioExactCopy';

describe('narrativeTranscriptCompaction', () => {
  it('collapses long scenario card delivery turns', () => {
    const out = compactTranscriptForNarrativePrompt([
      { role: 'assistant', content: `Here's the next situation.\n\n${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\nWhat do you think is going on here?` },
      { role: 'user', content: 'James missed the emotional moment.' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.content).toMatch(/Situation 2 scenario card/);
    expect(out[0]?.content).not.toMatch(/job hunting for four months/);
    expect(out[1]?.content).toContain('James missed');
  });

  it('auto-compacts when raw transcript exceeds budget', () => {
    const longTurns = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'assistant' : 'user',
      content: `${'word '.repeat(120)}turn ${i}`,
    }));
    expect(shouldAutoCompactTranscriptForNarrative(longTurns)).toBe(true);
    const compact = compactTranscriptForNarrativePrompt(longTurns);
    const joined = compact.map((m) => m.content ?? '').join('\n');
    expect(joined.length).toBeLessThan(14_000);
  });

  it('detects WORKER_RESOURCE_LIMIT errors', () => {
    expect(isWorkerResourceLimitError(546, '{"code":"WORKER_RESOURCE_LIMIT"}')).toBe(true);
    expect(isWorkerResourceLimitError(500, 'WORKER_RESOURCE_LIMIT')).toBe(true);
    expect(isWorkerResourceLimitError(429, 'rate limit')).toBe(false);
  });
});
