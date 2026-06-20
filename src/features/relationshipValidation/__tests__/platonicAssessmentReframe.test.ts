import { reframePlatonicAssessmentStem } from '../platonicAssessmentReframe';
import {
  filterValidationCohortRows,
  parseIncludePlatonicTestDataFlag,
} from '../validationCohortFilters';

describe('reframePlatonicAssessmentStem', () => {
  it('leaves romantic-mode stems unchanged', () => {
    const stem = "I'm afraid that I will lose my partner's love.";
    expect(reframePlatonicAssessmentStem(stem, 'romantic')).toBe(stem);
    expect(reframePlatonicAssessmentStem(stem, null)).toBe(stem);
  });

  it('reframes partner language for platonic mode', () => {
    expect(reframePlatonicAssessmentStem("I'm afraid that I will lose my partner's love.", 'platonic')).toBe(
      "I'm afraid that I will lose my past partner's love.",
    );
    expect(
      reframePlatonicAssessmentStem('Telling a partner what you enjoy sexually.', 'platonic'),
    ).toBe('Telling a past partner what you enjoy sexually.');
    expect(
      reframePlatonicAssessmentStem(
        'Initiating a conversation about changing something in your sexual relationship.',
        'platonic',
      ),
    ).toContain('that past sexual relationship');
  });

  it('reframes conflict-style partner prompts', () => {
    expect(
      reframePlatonicAssessmentStem('When my partner is upset with me:', 'platonic'),
    ).toBe('When my past partner was upset with me:');
  });
});

describe('validationCohortFilters', () => {
  const rows = [
    { user_id: 'a', relationship_test_mode: 'romantic' as const },
    { user_id: 'b', relationship_test_mode: 'platonic' as const },
    { user_id: 'c', relationship_test_mode: null },
  ];

  it('excludes platonic rows by default', () => {
    expect(filterValidationCohortRows(rows, false).map((r) => r.user_id)).toEqual(['a', 'c']);
  });

  it('includes platonic rows when flag set', () => {
    expect(filterValidationCohortRows(rows, true)).toHaveLength(3);
  });

  it('parses CLI flag', () => {
    expect(parseIncludePlatonicTestDataFlag(['--include-platonic-test-data'])).toBe(true);
    expect(parseIncludePlatonicTestDataFlag([])).toBe(false);
  });
});
