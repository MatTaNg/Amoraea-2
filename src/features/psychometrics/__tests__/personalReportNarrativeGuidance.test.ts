import {
  buildMentalizingAsymmetryNote,
  parseKeyEvidenceFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  parsePillarScoresFromStoredSlice,
  resolveUnderdisclosureNarrativeTier,
} from '../personalReportNarrativeGuidance';

describe('personalReportNarrativeGuidance', () => {
  it('softens underdisclosure when either personal moment is substantive', () => {
    expect(
      resolveUnderdisclosureNarrativeTier({
        disclosureCalibration: 'underdisclosure',
        moment4Concreteness: 'valid_non_applicable',
        moment5Concreteness: 'high',
      }),
    ).toBe('mild');
  });

  it('allows strong underdisclosure narrative when both moments are thin', () => {
    expect(
      resolveUnderdisclosureNarrativeTier({
        disclosureCalibration: 'underdisclosure',
        moment4Concreteness: 'absent',
        moment5Concreteness: 'low',
      }),
    ).toBe('strong');
  });

  it('builds mentalizing asymmetry note when scenario avg exceeds M4 by 2+', () => {
    const note = buildMentalizingAsymmetryNote({
      scenario1: 8,
      scenario2: 9,
      scenario3: 7,
      moment4: 6,
      holisticPillar: 8,
      scenarioAverage: 8,
      moment4GapFromScenarioAverage: 2,
      keyEvidence: {
        scenario1: null,
        scenario2: null,
        scenario3: null,
        moment4: 'Competent but thin self-mentalizing.',
      },
    });
    expect(note).toContain('gap of 2+');
    expect(note).toContain('Competent but thin self-mentalizing');
  });

  it('parseMoment5ProfileFromStoredPatterns returns null when absent', () => {
    expect(parseMoment5ProfileFromStoredPatterns(null)).toBeNull();
    expect(parseMoment5ProfileFromStoredPatterns({})).toBeNull();
  });

  it('parseMoment5ProfileFromStoredPatterns extracts pillarScores and keyEvidence', () => {
    const profile = parseMoment5ProfileFromStoredPatterns({
      moment_5_scores: {
        pillarScores: { accountability: 7, mentalizing: 6 },
        keyEvidence: { accountability: 'Owned letting things build' },
      },
    });
    expect(profile?.pillarScores?.accountability).toBe(7);
    expect(profile?.keyEvidence?.accountability).toBe('Owned letting things build');
  });

  it('parseKeyEvidenceFromStoredSlice returns null for empty input', () => {
    expect(parseKeyEvidenceFromStoredSlice(null)).toBeNull();
    expect(parseKeyEvidenceFromStoredSlice({ keyEvidence: {} })).toBeNull();
  });

  it('parsePillarScoresFromStoredSlice preserves explicit nulls', () => {
    const scores = parsePillarScoresFromStoredSlice({
      pillarScores: { accountability: 7, repair: null },
    });
    expect(scores?.accountability).toBe(7);
    expect(scores?.repair).toBeNull();
  });
});
