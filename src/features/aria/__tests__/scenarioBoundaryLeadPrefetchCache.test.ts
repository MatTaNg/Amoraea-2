import {
  getCachedScenarioBoundaryLead,
  resetScenarioBoundaryLeadPrefetchCacheForTests,
  setCachedScenarioBoundaryLead,
} from '@features/aria/scenarioBoundaryLeadPrefetchCache';
import { resolveScenarioBoundaryLeadForInterview } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { fetchInterviewScenarioBoundaryLeadFromLlm } from '@features/aria/fetchInterviewScenarioBoundaryLeadFromLlm';
import { SCENARIO_1_TO_2_TRANSITION } from '@features/aria/interviewTransitionBundles';

jest.mock('@features/aria/fetchInterviewScenarioBoundaryLeadFromLlm', () => ({
  fetchInterviewScenarioBoundaryLeadFromLlm: jest.fn(),
}));

const fetchMock = fetchInterviewScenarioBoundaryLeadFromLlm as jest.MockedFunction<
  typeof fetchInterviewScenarioBoundaryLeadFromLlm
>;

describe('scenarioBoundaryLeadPrefetchCache', () => {
  beforeEach(() => {
    resetScenarioBoundaryLeadPrefetchCacheForTests();
    fetchMock.mockReset();
  });

  it('ignores cached reflective leads while boundary LLM / reflections are disabled', async () => {
    setCachedScenarioBoundaryLead('sess-a', {
      completedScenario: 1,
      lead: 'Cached dynamic lead. Next situation.',
      source: 'llm',
      userCorpus: 'Emma was sharp.',
      fetchedAtMs: Date.now(),
    });

    const { lead, source } = await resolveScenarioBoundaryLeadForInterview({
      completedScenario: 1,
      firstName: 'Alex',
      lastUserAnswer: 'Emma was sharp.',
      interviewSessionId: 'sess-a',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(source).toBe('static');
    expect(lead).toBe(SCENARIO_1_TO_2_TRANSITION);
  });

  it('returns static wrap without fetch while boundary LLM is disabled', async () => {
    fetchMock.mockResolvedValue(null);
    const { lead } = await resolveScenarioBoundaryLeadForInterview({
      completedScenario: 1,
      firstName: 'Alex',
      lastUserAnswer: 'other corpus',
      interviewSessionId: 'sess-b',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lead).toBe(SCENARIO_1_TO_2_TRANSITION);
    expect(getCachedScenarioBoundaryLead('sess-b', 1, 'other corpus')).toBeNull();
  });
});
