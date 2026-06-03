import { describe, expect, it } from '@jest/globals';
import {
  shouldShowTypologyOnboardingStep,
  typologyHasUnansweredFields,
} from '../typologyOnboardingOptions';

describe('typologyOnboardingOptions', () => {
  it('treats empty typology as having unanswered fields', () => {
    expect(typologyHasUnansweredFields({})).toBe(true);
    expect(shouldShowTypologyOnboardingStep(undefined)).toBe(true);
  });

  it('hides typology step when every optional field is filled', () => {
    const filled = {
      eroticBlueprintType: 'Sensual',
      loveLanguage: 'Quality Time',
      myersBriggs: 'INTJ - The Architect',
      enneagramType: '1 - The Reformer',
      enneagramWing: '2',
      enneagramInstinct: 'Social (SO)',
      sunSign: 'Aries',
      risingSign: 'Taurus',
      moonSign: 'Gemini',
      marsSign: 'Cancer',
      venusSign: 'Leo',
      humanDesignType: 'Generator',
      humanDesignAuthority: 'Sacral',
      humanDesignProfile: '1/3 - The Investigator / Martyr',
      spiralDynamics: 'Green',
    };
    expect(typologyHasUnansweredFields(filled)).toBe(false);
    expect(shouldShowTypologyOnboardingStep(filled)).toBe(false);
  });

  it('shows typology step when any optional field is still blank', () => {
    expect(
      shouldShowTypologyOnboardingStep({
        myersBriggs: 'INTJ - The Architect',
      }),
    ).toBe(true);
  });
});
