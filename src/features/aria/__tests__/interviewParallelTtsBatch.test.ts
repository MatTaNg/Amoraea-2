import {
  createInitialParallelStreamingTtsState,
  PARALLEL_TTS_BATCH_MIN_CHARS,
  PARALLEL_TTS_BATCH_PERIOD_FLUSH_MIN_CHARS,
  PARALLEL_TTS_BATCH_SHORT_SENTENCE_MAX_CHARS,
  shouldFlushParallelTtsBatch,
} from '../interviewParallelTtsBatch';

describe('interviewParallelTtsBatch', () => {
  it('createInitialParallelStreamingTtsState returns inactive defaults', () => {
    expect(createInitialParallelStreamingTtsState()).toEqual({
      active: false,
      cancelRequested: false,
      accumulatedFullText: '',
      spokenCompleteText: '',
      s3SophiePerspectiveProbeDeliveredThisStream: false,
    });
  });

  it('shouldFlushParallelTtsBatch flushes questions immediately', () => {
    expect(shouldFlushParallelTtsBatch('How are you?', false)).toBe(true);
  });

  it('shouldFlushParallelTtsBatch flushes short terminal sentences', () => {
    const short = 'OK.';
    expect(short.length).toBeLessThanOrEqual(PARALLEL_TTS_BATCH_SHORT_SENTENCE_MAX_CHARS);
    expect(shouldFlushParallelTtsBatch(short, false)).toBe(true);
    const mid = 'A'.repeat(PARALLEL_TTS_BATCH_MIN_CHARS - 20) + '.';
    expect(shouldFlushParallelTtsBatch(mid, false)).toBe(false);
    const longPeriod = 'A'.repeat(PARALLEL_TTS_BATCH_PERIOD_FLUSH_MIN_CHARS) + '.';
    expect(shouldFlushParallelTtsBatch(longPeriod, false)).toBe(true);
  });

  it('shouldFlushParallelTtsBatch force flushes non-empty text', () => {
    expect(shouldFlushParallelTtsBatch('  hi  ', true)).toBe(true);
    expect(shouldFlushParallelTtsBatch('   ', true)).toBe(false);
  });
});
