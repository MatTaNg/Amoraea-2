import {
  inferCompletedScenarioFromHandoffBundle,
  parseScenarioCompleteAdvanceBundle,
  replaceScenarioBoundaryLeadInBundle,
} from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { buildScenario1To2BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';

describe('scenario boundary bundle helpers', () => {
  it('parseScenarioCompleteAdvanceBundle extracts token and body', () => {
    const parsed = parseScenarioCompleteAdvanceBundle(
      '[SCENARIO_COMPLETE:2]\n\nLead line.\n\nSophie and Daniel have had the same argument.',
    );
    expect(parsed?.completedScenario).toBe(2);
    expect(parsed?.body).toContain('Sophie and Daniel');
  });

  it('replaceScenarioBoundaryLeadInBundle keeps vignette body', () => {
    const staticBundle = buildScenario1To2BundleForInterview('Alex', SCENARIO_2_TEXT, 'Ryan was cold.');
    const out = replaceScenarioBoundaryLeadInBundle(staticBundle, 'Custom ack. Next situation.');
    expect(out.startsWith('Custom ack. Next situation.')).toBe(true);
    expect(out).toContain(SCENARIO_2_TEXT.slice(0, 30));
  });

  it('inferCompletedScenarioFromHandoffBundle detects S1 complete from S2 vignette', () => {
    const bundle = buildScenario1To2BundleForInterview('Alex', SCENARIO_2_TEXT, 'answer');
    expect(inferCompletedScenarioFromHandoffBundle(bundle)).toBe(1);
  });
});
