/**
 * Integration: weighted research gate on pillar snapshots.
 */
import { computeGateResultCore } from '@features/aria/computeGateResultCore';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';

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
  it('strong uniform profile passes weighted gate', () => {
    const pillarScores = allSeven();
    const weighted = computeGateResultCore(pillarScores);
    expect(weighted.pass).toBe(true);
  });

  it('weighted gate fails when floors or average are violated', () => {
    const pillarScores = allSeven();
    pillarScores.mentalizing = 4;
    pillarScores.accountability = 4;
    pillarScores.repair = 4;
    pillarScores.contempt = 9;
    pillarScores.regulation = 9;
    pillarScores.attunement = 9;
    pillarScores.appreciation = 9;
    pillarScores.commitment_threshold = 9;
    const weighted = computeGateResultCore(pillarScores);
    expect(weighted.pass).toBe(false);
  });
});
