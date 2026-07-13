import { describe, expect, it } from '@jest/globals';

import {
  extractConstructEvidenceSnippet,
  isQuoteOnlyKeyEvidence,
  isScenarioSliceHomogenizedBackfill,
  stripHomogenizedScenarioSliceBackfill,
} from '../scenarioConstructEvidenceExtraction';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from '../moment4ScoringParse';
import {
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote,
  prepareScenarioKeyEvidenceFromModelOutput,
} from '../scenarioScoringParse';

describe('scenarioConstructEvidenceExtraction', () => {
  const transcript =
    "Matt. Yes. They have a difference in priorities. Ryan should tell his family he will call them back. Emma's frustrated. I would apologize and tell her she matters to me.";

  it('detects quote-only keyEvidence', () => {
    expect(isQuoteOnlyKeyEvidence('User: "Emma felt dismissed."')).toBe(true);
    expect(
      isQuoteOnlyKeyEvidence(
        'Level 2 — User: "Emma\'s frustrated, I\'m assuming she\'s referring to him always taking time."',
      ),
    ).toBe(true);
    expect(
      isQuoteOnlyKeyEvidence(
        'Level 2 — User infers shared-time pattern; Emma\'s frustration signals unmet priority.',
      ),
    ).toBe(false);
  });

  it('detects legacy homogenized scenario-slice backfill', () => {
    expect(isScenarioSliceHomogenizedBackfill('User (scenario slice): "Emma felt dismissed."')).toBe(
      true,
    );
    expect(isScenarioSliceHomogenizedBackfill('User: "Emma felt dismissed."')).toBe(false);
  });

  it('extracts different construct-specific snippets from the same transcript', () => {
    const repair = extractConstructEvidenceSnippet(transcript, 'repair');
    const mentalizing = extractConstructEvidenceSnippet(transcript, 'mentalizing');
    const attunement = extractConstructEvidenceSnippet(transcript, 'attunement');
    expect(repair).toMatch(/apolog/i);
    expect(mentalizing).toMatch(/frustrated|priorities|difference/i);
    expect(attunement).toMatch(/frustrated/i);
    expect(repair).not.toBe(mentalizing);
    expect(mentalizing).not.toBe(attunement);
  });

  it('fillScenarioKeyEvidence assigns recovered line instead of transcript quotes', () => {
    const parsed: {
      pillarScores: Record<string, number | null>;
      keyEvidence: Record<string, string>;
    } = {
      pillarScores: {
        mentalizing: 7,
        attunement: 6,
        repair: 8,
        accountability: 6,
      },
      keyEvidence: {
        mentalizing: 'moderate',
        attunement: 'high',
        repair: 'moderate',
        accountability: 'low',
      },
    };
    fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
      ['mentalizing', 'attunement', 'repair', 'accountability'],
      parsed,
      transcript,
    );
    expect(parsed.keyEvidence.repair).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
    expect(parsed.keyEvidence.mentalizing).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
    expect(parsed.keyEvidence.attunement).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
    expect(parsed.keyEvidence.accountability).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
  });

  it('stripHomogenizedScenarioSliceBackfill clears identical legacy blobs', () => {
    const homogenized =
      'User (scenario slice): "Matt. Yes. They have a difference in priorities. Ryan should be able to tell their family…"';
    const keyEvidence = {
      repair: homogenized,
      attunement: homogenized,
      mentalizing: homogenized,
    };
    stripHomogenizedScenarioSliceBackfill(keyEvidence, ['repair', 'attunement', 'mentalizing']);
    expect(keyEvidence.repair).toBeUndefined();
    expect(keyEvidence.attunement).toBeUndefined();
    expect(keyEvidence.mentalizing).toBeUndefined();
  });

  it('prepareScenarioKeyEvidenceFromModelOutput prefers per-marker quotes from raw JSON', () => {
    const rawModelText = JSON.stringify({
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: {
        mentalizing: 'moderate',
        attunement: 'high',
        repair: 'User named the rupture and apologized for the impact.',
      },
    });
    const parsed: {
      pillarScores: Record<string, number | null>;
      keyEvidence: Record<string, string>;
    } = {
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: { mentalizing: 'moderate', attunement: 'high', repair: 'moderate' },
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'attunement', 'repair'],
      parsed,
      transcript,
      rawModelText,
    );
    expect(parsed.keyEvidence.repair).toBe('User named the rupture and apologized for the impact.');
    expect(parsed.keyEvidence.mentalizing).toBeUndefined();
    expect(parsed.keyEvidence.attunement).toBeUndefined();
  });
});
