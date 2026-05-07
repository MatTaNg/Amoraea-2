import { NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE } from '@features/aria/probeAndScoringUtils';
import {
  fullScenarioReconciliation,
  inferUnassessedMarkerKeysFromTranscript,
} from '@features/aria/reconcileScenarioScoresTranscript';

describe('reconcileScenarioScoresTranscript', () => {
  it('infers S2 repair and accountability when one user turn and no James-differently or repair path', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'Sarah and James... What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user' as const, content: 'A short take on the situation.', scenarioNumber: 2 },
    ];
    const keys = inferUnassessedMarkerKeysFromTranscript(2, msgs);
    expect(keys).toContain('repair');
    expect(keys).toContain('accountability');
  });

  it('does not infer S2 repair unassessed when assistant used silent S2→S3 (complete token + Sophie vignette, no repair line)', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'Sarah and James... What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user' as const, content: 'James should have led with warmth.', scenarioNumber: 2 },
      { role: 'user' as const, content: "If I were James I'd apologize first and name what she needed.", scenarioNumber: 2 },
      {
        role: 'assistant' as const,
        content:
          "[SCENARIO_COMPLETE:2]\n\nGreat work — that's the end of this one, too. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.",
        scenarioNumber: 2,
      },
    ];
    const keys = inferUnassessedMarkerKeysFromTranscript(2, msgs);
    expect(keys).not.toContain('repair');
  });

  it('produces null scores and not_assessed confidence for inferred keys', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'Sarah and James... What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user' as const, content: 'Brief.', scenarioNumber: 2 },
    ];
    const out = fullScenarioReconciliation(
      {
        scenarioNumber: 2,
        pillarScores: { repair: 0, accountability: 0, mentalizing: 5, attunement: 5, appreciation: 5, contempt_expression: 5 },
        pillarConfidence: { repair: 'low', accountability: 'low', mentalizing: 'moderate', attunement: 'moderate', appreciation: 'moderate', contempt_expression: 'moderate' },
        keyEvidence: { repair: '', accountability: '', mentalizing: 'x', attunement: 'x', appreciation: 'x', contempt_expression: 'x' },
      },
      msgs
    );
    expect(out.pillarScores.repair).toBeNull();
    expect(out.pillarScores.accountability).toBeNull();
    expect(out.pillarConfidence.repair).toBe('not_assessed');
    expect(out.keyEvidence.repair).toBe(NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE);
  });
});
