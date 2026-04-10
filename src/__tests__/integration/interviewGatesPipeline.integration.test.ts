/**
 * Integration: two independent gate systems on the same pillar snapshot —
 * Gate1 (interview average + repair/accountability floors) vs weighted research gate.
 */
import { computeGateResultCore } from '@features/aria/computeGateResultCore';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';
import { evaluateGate1 } from '@features/onboarding/evaluateGate1';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    if (typeof msg === 'string' && msg.includes('[WEIGHTED_SCORE_BREAKDOWN]')) return;
  });
});
afterAll(() => {
  jest.restoreAllMocks();
});

const allSeven = () =>
  Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;

describe('interview gates pipeline', () => {
  it('strong uniform profile passes both Gate1 and weighted gate', () => {
    const pillarScores = allSeven();
    const gate1 = evaluateGate1({ pillarScores });
    const weighted = computeGateResultCore(pillarScores);
    expect(gate1.passed).toBe(true);
    expect(weighted.pass).toBe(true);
  });

  it('documents divergence: high weighted average can still fail Gate1 average', () => {
    const pillarScores = allSeven();
    pillarScores.mentalizing = 4;
    pillarScores.accountability = 4;
    pillarScores.repair = 4;
    pillarScores.contempt = 9;
    pillarScores.regulation = 9;
    pillarScores.attunement = 9;
    pillarScores.appreciation = 9;
    pillarScores.commitment_threshold = 9;
    const gate1 = evaluateGate1({ pillarScores });
    const weighted = computeGateResultCore(pillarScores);
    expect(gate1.passed).toBe(false);
    expect(weighted.pass).toBe(false);
  });
});
