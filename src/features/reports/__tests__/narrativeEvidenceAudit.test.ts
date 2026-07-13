import {
  buildEvidenceContextFromAttemptPatterns,
  buildPersonalMomentEvidencePromptBlock,
  buildPersonalReportEvidenceInventory,
} from '../narrativeEvidenceAudit';
import {
  PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
  PILLAR_NARRATIVE_BAND_GOOD_MIN,
  PILLAR_NARRATIVE_BAND_STRONG_MIN,
} from '@config/reports/pillarNarrativeBands';

describe('narrativeEvidenceAudit', () => {
  it('builds M5 scorer notes into prompt block', () => {
    const context = buildEvidenceContextFromAttemptPatterns({
      moment_5_scores: {
        pillarScores: { accountability: 7, mentalizing: 5 },
        keyEvidence: {
          accountability: 'Named own contribution without prompting',
        },
      },
    });
    const block = buildPersonalMomentEvidencePromptBlock(context);
    expect(block).toMatch(/M5/);
    expect(block).toMatch(/accountability/);
    expect(block).toMatch(/Named own contribution/);
  });

  it('assigns pillar bands from config thresholds in evidence inventory', () => {
    const inventory = buildPersonalReportEvidenceInventory('personal_full', {
      pillarScores: {
        mentalizing: PILLAR_NARRATIVE_BAND_STRONG_MIN,
        repair: PILLAR_NARRATIVE_BAND_GOOD_MIN,
        regulation: PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
      },
      mentalizingProfile: {
        scenario1: PILLAR_NARRATIVE_BAND_GOOD_MIN,
        scenario2: PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
        scenario3: PILLAR_NARRATIVE_BAND_STRONG_MIN - 0.5,
      },
    });
    const holistic = inventory.slices.find((s) => s.id === 'holistic_pillars');
    const bySlice = inventory.slices.find((s) => s.id === 'mentalizing_slices');

    expect(holistic?.markerBands?.mentalizing).toBe('strong');
    expect(holistic?.markerBands?.repair).toBe('good');
    expect(holistic?.markerBands?.regulation).toBe('developing');
    expect(bySlice?.markerBands?.scenario1).toBe('good');
    expect(bySlice?.markerBands?.scenario2).toBe('developing');
    expect(bySlice?.markerBands?.scenario3).toBe('good');
  });
});
