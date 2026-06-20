import type { RelationshipValidationTestMode } from './constants';

export type ValidationCohortRowForFilter = {
  relationship_test_mode?: RelationshipValidationTestMode | null;
};

// Platonic-mode test data uses a different reference frame (past relationship,
// hypothetical pairing) than romantic-mode data (current real relationship).
// These should never be pooled when validating whether the compatibility
// algorithm predicts real relational outcomes — only romantic-mode data
// constitutes genuine validation evidence. Platonic-mode data is useful only
// for stress-testing instrument-level psychometrics at higher volume.

export function filterValidationCohortRows<T extends ValidationCohortRowForFilter>(
  rows: T[],
  includePlatonicTestData: boolean,
): T[] {
  if (includePlatonicTestData) return rows;
  return rows.filter((row) => row.relationship_test_mode !== 'platonic');
}

export function parseIncludePlatonicTestDataFlag(argv: string[]): boolean {
  return argv.includes('--include-platonic-test-data');
}
