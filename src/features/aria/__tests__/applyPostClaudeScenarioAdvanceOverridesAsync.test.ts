import { applyPostClaudeScenarioAdvanceOverridesAsync } from '@features/aria/applyPostClaudeScenarioAdvanceOverrides';
import { enrichScenarioBoundaryHandoffBundleWithDynamicLead } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { buildScenario1To2BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';

jest.mock('@features/aria/resolveScenarioBoundaryLeadForInterview', () => {
  const actual = jest.requireActual('@features/aria/resolveScenarioBoundaryLeadForInterview');
  return {
    ...actual,
    enrichScenarioBoundaryHandoffBundleWithDynamicLead: jest.fn(),
  };
});

const enrichMock = enrichScenarioBoundaryHandoffBundleWithDynamicLead as jest.MockedFunction<
  typeof enrichScenarioBoundaryHandoffBundleWithDynamicLead
>;

describe('applyPostClaudeScenarioAdvanceOverridesAsync', () => {
  beforeEach(() => {
    enrichMock.mockReset();
  });

  it('enriches injected scenario-complete bundles', async () => {
    const staticBundle = buildScenario1To2BundleForInterview('Alex', SCENARIO_2_TEXT, 'Emma line');
    const tokenBundle = `[SCENARIO_COMPLETE:1]\n\n${staticBundle}`;
    enrichMock.mockResolvedValue('[SCENARIO_COMPLETE:1]\n\nDynamic lead.\n\nSarah has been job hunting');

    const deps = {
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      interviewSessionIdRef: { current: 'sess-1' },
    } as Parameters<typeof applyPostClaudeScenarioAdvanceOverridesAsync>[2];
    const params = {
      participantFirstNameForSpoken: 'Alex',
      messagesToUse: [
        { role: 'user', content: 'Emma was contemptuous', scenarioNumber: 1 },
        { role: 'assistant', content: 'If you were Ryan…', scenarioNumber: 1 },
        { role: 'user', content: 'I would validate her feelings', scenarioNumber: 1 },
      ],
    } as Parameters<typeof applyPostClaudeScenarioAdvanceOverridesAsync>[1];

    const out = await applyPostClaudeScenarioAdvanceOverridesAsync('Got it.', params, deps, params.messagesToUse);
    expect(enrichMock).toHaveBeenCalled();
    expect(out.text).toContain('Dynamic lead');
  });

  it('skips enrichment when no scenario-complete token is present', async () => {
    const deps = {
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      interviewSessionIdRef: { current: 'sess-1' },
    } as Parameters<typeof applyPostClaudeScenarioAdvanceOverridesAsync>[2];
    const params = {
      participantFirstNameForSpoken: 'Alex',
      messagesToUse: [{ role: 'user', content: 'hello', scenarioNumber: 1 }],
    } as Parameters<typeof applyPostClaudeScenarioAdvanceOverridesAsync>[1];

    const out = await applyPostClaudeScenarioAdvanceOverridesAsync('Thanks.', params, deps, params.messagesToUse);
    expect(enrichMock).not.toHaveBeenCalled();
    expect(out.text).toBe('Thanks.');
  });
});
