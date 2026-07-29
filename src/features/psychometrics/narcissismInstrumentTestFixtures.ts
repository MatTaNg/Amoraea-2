import { NPI_ENTITLEMENT_ENABLED } from './psychometricsFeatureFlags';
import { NPI_ENTITLEMENT_FLOOR_FAIL_CODE } from './npiEntitlementFloor';
import { SD3_NARCISSISM_FLOOR_FAIL_CODE } from './sd3NarcissismFloor';

/** Values Assessment (NPI) is profile/matching only — SD3 still has a psychometric gate floor. */
export const NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED = !NPI_ENTITLEMENT_ENABLED;

export const ACTIVE_NARCISSISM_FLOOR_CODE = NPI_ENTITLEMENT_ENABLED
  ? NPI_ENTITLEMENT_FLOOR_FAIL_CODE
  : SD3_NARCISSISM_FLOOR_FAIL_CODE;

/** Floor-breach narcissism score for the active battery instrument. */
export function narcissismFloorBreachScores(floorBreach = true) {
  if (NPI_ENTITLEMENT_ENABLED) {
    return {
      sd3NarcissismScore: null as number | null,
      npiEntitlementScore: floorBreach ? 5 : 3,
    };
  }
  return {
    sd3NarcissismScore: floorBreach ? 4.111 : 3.222,
    npiEntitlementScore: null as number | null,
  };
}

export function narcissismModifierPoorBandScores() {
  if (NPI_ENTITLEMENT_ENABLED) {
    return {
      sd3NarcissismScore: null as number | null,
      npiEntitlementScore: 4,
    };
  }
  return {
    sd3NarcissismScore: 3.99,
    npiEntitlementScore: null as number | null,
  };
}

export function narcissismModifierAverageBandScores() {
  if (NPI_ENTITLEMENT_ENABLED) {
    return {
      sd3NarcissismScore: null as number | null,
      npiEntitlementScore: 3,
    };
  }
  return {
    sd3NarcissismScore: 2.5,
    npiEntitlementScore: null as number | null,
  };
}
