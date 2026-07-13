import { describe, expect, it } from '@jest/globals';

import { applyMoment5ConflictValidityScoreAdjustments } from '@features/aria/interviewElaborationAbsenceScoring';
import type { PersonalMomentScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { resolvePreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('resolvePreClaudeScenarioConstructProbeFlags', () => {
  const scenarioAQ1Assistant =
    "What's going on between Emma and Ryan? What would you do if you were Emma?";

  it('forces S1 contempt probe when answering Scenario A Q1 without contempt coverage', () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: false },
      pendingScenarioAContemptProbeStreamMuteRef: { current: false },
    });

    const flags = resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      'I think Ryan should apologize and they should talk it out calmly.',
      [
        { role: 'assistant', content: scenarioAQ1Assistant },
        { role: 'user', content: 'I think Ryan should apologize and they should talk it out calmly.' },
      ],
      scenarioAQ1Assistant,
      scenarioAQ1Assistant,
      false,
    );

    expect(flags.replyingToScenarioAQ1).toBe(true);
    expect(flags.shouldForceScenarioAContemptProbe).toBe(true);
    expect(flags.muteParallelTtsForScenarioAContemptProbeStream).toBe(true);
    expect(deps.pendingScenarioAContemptProbeStreamMuteRef.current).toBe(true);
  });

  it('does not force probes when meta-frustration suppression is active', () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: false },
    });

    const flags = resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      'I think Ryan should apologize.',
      [{ role: 'assistant', content: scenarioAQ1Assistant }],
      scenarioAQ1Assistant,
      scenarioAQ1Assistant,
      true,
    );

    expect(flags.shouldForceScenarioAContemptProbe).toBe(false);
    expect(flags.shouldForceScenarioBFullAppreciationProbe).toBe(false);
  });

  it('forces S2 appreciation probe when BQ1 answer lacks on-topic engagement', () => {
    const scenarioBQ1 =
      'Sarah got a job offer and James reacted oddly. What do you think is going on here?';
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
    });

    const flags = resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      'They both need to calm down and talk later.',
      [{ role: 'assistant', content: scenarioBQ1 }],
      scenarioBQ1,
      scenarioBQ1,
      false,
    );

    expect(flags.replyingToScenarioBQ1).toBe(true);
    expect(flags.scenarioBQ1Engaged).toBe(false);
    expect(flags.shouldForceScenarioBFullAppreciationProbe).toBe(true);
  });

  it('marks contempt satisfied when user answer already includes contempt probe coverage', () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: false },
    });
    const contemptRichAnswer =
      "Emma telling Ryan she already knows he won't change — that's a harsh, contemptuous shutdown.";

    const flags = resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      contemptRichAnswer,
      [
        { role: 'assistant', content: scenarioAQ1Assistant },
        { role: 'user', content: contemptRichAnswer },
      ],
      scenarioAQ1Assistant,
      scenarioAQ1Assistant,
      false,
    );

    expect(flags.specificEmmaLineAlreadyAddressed).toBe(true);
    expect(flags.shouldForceScenarioAContemptProbe).toBe(false);
    expect(deps.scenarioAContemptProbeAskedRef.current).toBe(true);
  });

  it('syncs Scenario C Sophie perspective probe ref from transcript on resume', () => {
    const sophieWithAck = `Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      scenarioCSophiePerspectiveProbeFiredRef: { current: false },
    });

    resolvePreClaudeScenarioConstructProbeFlags(
      deps,
      "She's probably annoyed.",
      [
        { role: 'assistant', content: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?" },
        { role: 'assistant', content: sophieWithAck },
      ],
      sophieWithAck,
      sophieWithAck,
      false,
    );

    expect(deps.scenarioCSophiePerspectiveProbeFiredRef.current).toBe(true);
  });
});

describe('applyMoment5ConflictValidityScoreAdjustments', () => {
  it('caps repair and mentalizing when conflict validity is no_conflict', () => {
    const result: PersonalMomentScoreResult = {
      pillarScores: { repair: 9, mentalizing: 8, accountability: 7 },
      pillarConfidence: {},
      keyEvidence: { repair: 'Strong repair', mentalizing: 'Good perspective-taking' },
      specificity: 'high',
    };

    applyMoment5ConflictValidityScoreAdjustments(result, { conflictValidity: 'no_conflict' });

    expect(result.pillarScores.repair).toBe(6);
    expect(result.pillarScores.mentalizing).toBe(6);
    expect(result.pillarScores.accountability).toBe(6);
    expect(result.keyEvidence.repair).toMatch(/no_conflict/i);
  });
});
