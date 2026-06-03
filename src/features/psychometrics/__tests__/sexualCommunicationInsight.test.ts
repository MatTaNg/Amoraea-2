import {
  buildSexualCommunicationDetailRows,
  buildSexualCommunicationInsightCopy,
  buildSexualCommunicationScores,
  sexualCommunicationComfortLabel,
} from '../sexualCommunicationInsight';

describe('sexualCommunicationInsight', () => {
  const sampleResponses: Record<number, number> = {
    1: 5,
    2: 4,
    3: 3,
    4: 2,
    5: 2,
    6: 3,
    7: 4,
    8: 5,
    9: 3,
    10: 1,
  };

  it('builds total and per-item scores', () => {
    const scores = buildSexualCommunicationScores(sampleResponses);
    expect(scores.total).toBeCloseTo(3.2, 1);
    expect(scores.item_1).toBe(5);
    expect(scores.item_10).toBe(1);
  });

  it('labels comfort from the 1–5 scale', () => {
    expect(sexualCommunicationComfortLabel(1)).toBe('Very Uncomfortable');
    expect(sexualCommunicationComfortLabel(5)).toBe('Very Comfortable');
  });

  it('produces narrative copy referencing strongest and hardest topics', () => {
    const scores = buildSexualCommunicationScores(sampleResponses);
    const copy = buildSexualCommunicationInsightCopy(scores);
    expect(copy.headline).toMatch(/strongest/i);
    expect(copy.body).toMatch(/most at ease/i);
    expect(copy.body).toMatch(/hardest/i);
  });

  it('lists overall plus each topic in detail rows', () => {
    const scores = buildSexualCommunicationScores(sampleResponses);
    const rows = buildSexualCommunicationDetailRows(scores);
    expect(rows[0]?.label).toBe('Overall comfort');
    expect(rows.length).toBe(11);
    expect(rows.some((r) => r.label.includes('enjoy sexually'))).toBe(true);
  });
});
