import {
  shouldUseRelationshipValidationNavigator,
  isValidationStandardAppEnrolled,
} from '../validationShellRouting';
import { RELATIONSHIP_VALIDATION_TRACK } from '../constants';
import type { ValidationShellRouting } from '../relationshipValidationRepo';

describe('validationShellRouting', () => {
  const nativeSignup: ValidationShellRouting = {
    track: RELATIONSHIP_VALIDATION_TRACK,
    standardAppEnrolled: false,
    flowActive: false,
  };

  const standardEnrolledIdle: ValidationShellRouting = {
    track: RELATIONSHIP_VALIDATION_TRACK,
    standardAppEnrolled: true,
    flowActive: false,
  };

  const standardEnrolledActive: ValidationShellRouting = {
    track: RELATIONSHIP_VALIDATION_TRACK,
    standardAppEnrolled: true,
    flowActive: true,
  };

  it('routes native RELATIONSHIP signups to the validation navigator', () => {
    expect(shouldUseRelationshipValidationNavigator(nativeSignup)).toBe(true);
  });

  it('keeps standard-app enrollments on the main shell until they opt in', () => {
    expect(shouldUseRelationshipValidationNavigator(standardEnrolledIdle)).toBe(false);
    expect(isValidationStandardAppEnrolled(standardEnrolledIdle)).toBe(true);
  });

  it('switches standard-app enrollments into validation when flow is active', () => {
    expect(shouldUseRelationshipValidationNavigator(standardEnrolledActive)).toBe(true);
  });

  it('ignores users without the relationship track', () => {
    expect(
      shouldUseRelationshipValidationNavigator({
        track: null,
        standardAppEnrolled: false,
        flowActive: false,
      }),
    ).toBe(false);
  });
});
