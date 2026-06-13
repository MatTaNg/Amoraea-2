import { mapMatchmakingUserToCompatibilityInputs } from '../mapMatchmakingUserToCompatibilityInputs';
import {
  blockedKidsUserA,
  blockedKidsUserB,
  fixtureMappingExtras,
  idealPairUserA,
  idealPairUserB,
  sparseDataUser,
} from './fixtures/matchmakingUserFixtures';

describe('mapMatchmakingUserToCompatibilityInputs', () => {
  it('maps finance fields from life-domain answers and compatibility_data', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);

    expect(mapped.finance.financesPooled).toBe('Pooled');
    expect(mapped.finance.yearlyIncome).toBe('$100,000 – $149,999');
    expect(mapped.finance.financialRiskComfort).toBe(5);
  });

  it('maps ECR attachment and PVQ value dimensions', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);

    expect(mapped.attachment).toEqual({ anxiety: 2.5, avoidance: 2.5 });
    expect(mapped.values?.self_direction).toBe(0.5);
    expect(mapped.values?.universalism).toBe(0.6);
  });

  it('maps CONFLICT-30 percentages and interview pillars', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);

    expect(mapped.conflictStyle).toEqual({
      competing: 15,
      collaborating: 45,
      compromising: 25,
      avoiding: 10,
      accommodating: 5,
    });
    expect(mapped.interviewProcess).toEqual({
      repair: 7.5,
      accountability: 7,
      contempt: 6,
    });
    expect(mapped.interviewWeightedScore).toBe(7);
  });

  it('maps dealbreaker profile from snapshot and extras', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);

    expect(mapped.dealbreaker.wantKids).toBe('Want kids');
    expect(mapped.dealbreaker.relationshipStyle).toBe('monogamy');
    expect(mapped.dealbreaker.location).toEqual({ lat: 30.27, lng: -97.74 });
    expect(mapped.dealbreaker.substance?.alcoholFrequency).toBe('socially');
    expect(mapped.psychometricSoft.npiEntitlementScore).toBe(2);
    expect(mapped.relationalCapacity.anxietyTraitScore).toBe(3);
  });

  it('handles sparse snapshot with null typology gracefully', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(sparseDataUser);

    expect(mapped.attachment).toBeNull();
    expect(mapped.values).toBeNull();
    expect(mapped.conflictStyle).toBeNull();
    expect(mapped.interviewProcess).not.toBeNull();
    expect(mapped.relationalCapacity.rfqScore).toBeNull();
  });

  it('maps distinct kids preferences for blocked pair fixtures', () => {
    const a = mapMatchmakingUserToCompatibilityInputs(blockedKidsUserA);
    const b = mapMatchmakingUserToCompatibilityInputs(blockedKidsUserB);

    expect(a.dealbreaker.wantKids).toBe('Want kids');
    expect(b.dealbreaker.wantKids).toBe("Don't want kids");
  });

  it('maps life-domain slider settings', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserB);

    expect(mapped.lifeDomainSettings).toMatchObject({
      intimacy: 22,
      finance: 22,
      spirituality: 18,
      family: 23,
      physicalHealth: 15,
    });
  });
});
