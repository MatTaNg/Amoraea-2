import {
  isPartnerAlignmentHardBlock,
  parsePartnerAlignmentImportance,
  partnerAlignmentImportancePickerValue,
  partnerAlignmentRankingWeight,
} from '../partnerAlignmentImportance';

describe('parsePartnerAlignmentImportance', () => {
  it('maps current slugs and labels', () => {
    expect(parsePartnerAlignmentImportance('non_negotiable')).toBe('non_negotiable');
    expect(
      parsePartnerAlignmentImportance(
        'Non-negotiable — do not match me with someone who differs here',
      ),
    ).toBe('non_negotiable');
    expect(parsePartnerAlignmentImportance('very_important')).toBe('very_important');
    expect(parsePartnerAlignmentImportance('preference')).toBe('preference');
    expect(parsePartnerAlignmentImportance('doesnt_matter')).toBe('doesnt_matter');
  });

  it('maps legacy Yes/No and Dealbreaker answers', () => {
    expect(parsePartnerAlignmentImportance('Yes')).toBe('non_negotiable');
    expect(parsePartnerAlignmentImportance('Dealbreaker')).toBe('non_negotiable');
    expect(parsePartnerAlignmentImportance('No')).toBe('doesnt_matter');
    expect(parsePartnerAlignmentImportance('No preference')).toBe('doesnt_matter');
    expect(parsePartnerAlignmentImportance('Not important')).toBe('doesnt_matter');
    expect(parsePartnerAlignmentImportance('Somewhat important')).toBe('preference');
    expect(parsePartnerAlignmentImportance('Important')).toBe('very_important');
  });

  it('returns null for empty or unknown values', () => {
    expect(parsePartnerAlignmentImportance('')).toBeNull();
    expect(parsePartnerAlignmentImportance('   ')).toBeNull();
    expect(parsePartnerAlignmentImportance('Austin')).toBeNull();
  });
});

describe('partner alignment matching helpers', () => {
  it('treats non-negotiable / Yes as a hard block', () => {
    expect(isPartnerAlignmentHardBlock('non_negotiable')).toBe(true);
    expect(isPartnerAlignmentHardBlock('Yes')).toBe(true);
    expect(isPartnerAlignmentHardBlock('very_important')).toBe(false);
    expect(isPartnerAlignmentHardBlock('preference')).toBe(false);
    expect(isPartnerAlignmentHardBlock('doesnt_matter')).toBe(false);
  });

  it('exposes ranking weight only for strong preference and preference', () => {
    expect(partnerAlignmentRankingWeight('very_important')).toBe('very_important');
    expect(partnerAlignmentRankingWeight('preference')).toBe('preference');
    expect(partnerAlignmentRankingWeight('non_negotiable')).toBeNull();
    expect(partnerAlignmentRankingWeight('doesnt_matter')).toBeNull();
  });

  it('normalizes picker value to the slug', () => {
    expect(partnerAlignmentImportancePickerValue('Yes')).toBe('non_negotiable');
    expect(partnerAlignmentImportancePickerValue('')).toBe('');
  });
});
