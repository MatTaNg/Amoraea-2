import { describe, expect, it } from '@jest/globals';

import {
  resolveResponseTimingsForPersist,
  type InterviewResponseTimingEntry,
} from '@utilities/persistResponseTimingsIncremental';

const entry = (id: string): InterviewResponseTimingEntry => ({
  question_id: id,
  scenario: 1,
  question_text: `Question ${id}`,
  latency_ms: 100,
  duration_ms: 200,
  word_count: 5,
});

describe('resolveResponseTimingsForPersist', () => {
  it('returns null when both client and db are empty', () => {
    expect(resolveResponseTimingsForPersist([], null)).toBeNull();
    expect(resolveResponseTimingsForPersist(undefined, undefined)).toBeNull();
  });

  it('returns client timings when db is empty', () => {
    const client = [entry('q_1'), entry('q_2')];
    expect(resolveResponseTimingsForPersist(client, null)).toEqual(client);
  });

  it('returns db timings when client ref was lost on resume', () => {
    const db = [entry('q_1'), entry('q_2'), entry('q_3')];
    expect(resolveResponseTimingsForPersist([], db)).toEqual(db);
  });

  it('prefers client timings when it has caught up or exceeded db', () => {
    const db = [entry('q_1')];
    const client = [entry('q_1'), entry('q_2')];
    expect(resolveResponseTimingsForPersist(client, db)).toEqual(client);
  });

  it('keeps db timings when client is shorter after partial resume', () => {
    const db = [entry('q_1'), entry('q_2'), entry('q_3')];
    const client = [entry('q_1')];
    expect(resolveResponseTimingsForPersist(client, db)).toEqual(db);
  });
});
