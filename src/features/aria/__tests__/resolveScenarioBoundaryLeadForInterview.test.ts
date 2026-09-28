import { fetchInterviewScenarioBoundaryLeadFromLlm } from '@features/aria/fetchInterviewScenarioBoundaryLeadFromLlm';
import {
  buildScenarioFictionHandoffBundleWithDynamicLead,
  resolveScenarioBoundaryLeadForInterview,
} from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_1_TO_2_TRANSITION } from '@features/aria/interviewTransitionBundles';

jest.mock('@features/aria/fetchInterviewScenarioBoundaryLeadFromLlm', () => ({
  fetchInterviewScenarioBoundaryLeadFromLlm: jest.fn(),
}));

const fetchMock = fetchInterviewScenarioBoundaryLeadFromLlm as jest.MockedFunction<
  typeof fetchInterviewScenarioBoundaryLeadFromLlm
>;

describe('resolveScenarioBoundaryLeadForInterview', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('uses static short wrap while boundary LLM / reflections are disabled', async () => {
    fetchMock.mockResolvedValue('You noticed the contempt line clearly. On to the next situation.');
    const { lead, source } = await resolveScenarioBoundaryLeadForInterview({
      completedScenario: 1,
      firstName: 'Alex',
      lastUserAnswer: 'Emma was being contemptuous when she said that.',
    });
    expect(source).toBe('static');
    expect(lead).toBe(SCENARIO_1_TO_2_TRANSITION);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to static lead on LLM null', async () => {
    fetchMock.mockResolvedValue(null);
    const { lead, source } = await resolveScenarioBoundaryLeadForInterview({
      completedScenario: 1,
      firstName: 'Alex',
      lastUserAnswer: 'brief',
    });
    expect(source).toBe('static');
    expect(lead).toBe(SCENARIO_1_TO_2_TRANSITION);
  });

  it('falls back to static lead on LLM error', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    const { lead, source } = await resolveScenarioBoundaryLeadForInterview({
      completedScenario: 2,
      firstName: 'Alex',
      lastUserAnswer: 'James needed appreciation.',
    });
    expect(source).toBe('static');
    expect(lead.length).toBeGreaterThan(10);
  });
});

describe('buildScenarioFictionHandoffBundleWithDynamicLead', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('keeps locked vignette body after static short wrap lead', async () => {
    fetchMock.mockResolvedValue('Custom ack. Next situation.');
    const bundle = await buildScenarioFictionHandoffBundleWithDynamicLead({
      completedScenario: 1,
      firstName: 'Alex',
      lastUserAnswer: 'Ryan was dismissive.',
    });
    expect(bundle.startsWith(SCENARIO_1_TO_2_TRANSITION)).toBe(true);
    expect(bundle).toContain(SCENARIO_2_TEXT.slice(0, 40));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
