import {
  computeDealbreakerMultiplier,
  MAX_DISTANCE_KM,
  type DealbreakerProfile,
} from './computeCompatibilityScore';

function normalizeKey(v: string | null | undefined): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function wantsChildrenExplicitly(v: string | null | undefined): boolean {
  const s = normalizeKey(v);
  return s === 'want kids' || s === 'yes' || /^want/.test(s);
}

function doesNotWantChildrenExplicitly(v: string | null | undefined): boolean {
  const s = normalizeKey(v);
  return s === "don't want kids" || s === 'no' || /don'?t want/.test(s);
}

function userRequiresSameReligion(p: DealbreakerProfile): boolean {
  if (p.requireSameReligion === true) return true;
  return normalizeKey(p.partnerSameReligionRequired) === 'yes';
}

function userRequiresPoliticalAlignment(p: DealbreakerProfile): boolean {
  if (p.requiresPoliticalAlignment === true) return true;
  return normalizeKey(p.prefPartnerPoliticalAlignmentImportance) === 'yes';
}

function userWillingToRelocate(p: DealbreakerProfile): boolean {
  if (p.willingToRelocate === true) return true;
  return normalizeKey(p.relocationPreference) === 'yes';
}

function normalizeRelationshipStyle(v: string | null | undefined): string {
  const s = normalizeKey(v);
  if (!s) return '';
  if (/mono/i.test(s)) return 'monogamous';
  if (/poly|open|enm/i.test(s)) return 'non_monogamous';
  return s;
}

function substanceUses(frequency: string | null | undefined): boolean {
  const f = normalizeKey(frequency);
  if (!f || f === 'never') return false;
  if (f === 'only_ceremonially') return false;
  return true;
}

function hardSubstanceIncompatibility(
  userComfort: string | null | undefined,
  partnerFrequency: string | null | undefined,
): boolean {
  const comfort = normalizeKey(userComfort);
  if (comfort !== 'no') return false;
  return substanceUses(partnerFrequency);
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Human-readable dealbreaker reasons when multiplier would be 0. */
export function explainDealbreakerBlockers(a: DealbreakerProfile, b: DealbreakerProfile): string[] {
  const reasons: string[] = [];

  const aWants = wantsChildrenExplicitly(a.wantKids);
  const aNo = doesNotWantChildrenExplicitly(a.wantKids);
  const bWants = wantsChildrenExplicitly(b.wantKids);
  const bNo = doesNotWantChildrenExplicitly(b.wantKids);
  if ((aWants && bNo) || (aNo && bWants)) {
    reasons.push(`Kids preference conflict (${a.wantKids ?? '?'} vs ${b.wantKids ?? '?'}).`);
  }

  if (userRequiresSameReligion(a) || userRequiresSameReligion(b)) {
    const relA = normalizeKey(a.religion);
    const relB = normalizeKey(b.religion);
    if (relA && relB && relA !== relB) {
      reasons.push(`Religion requirement not met (${a.religion} vs ${b.religion}).`);
    }
  }

  const styleA = normalizeRelationshipStyle(a.relationshipStyle);
  const styleB = normalizeRelationshipStyle(b.relationshipStyle);
  if (styleA && styleB && styleA !== styleB) {
    reasons.push(`Relationship structure mismatch (${a.relationshipStyle} vs ${b.relationshipStyle}).`);
  }

  if (!userWillingToRelocate(a) && !userWillingToRelocate(b)) {
    if (a.location && b.location) {
      const distanceKm = haversineKm(a.location, b.location);
      if (distanceKm > MAX_DISTANCE_KM) {
        reasons.push(
          `Both unwilling to relocate and live >${MAX_DISTANCE_KM} km apart (~${Math.round(distanceKm)} km).`,
        );
      }
    }
  }

  if (userRequiresPoliticalAlignment(a) || userRequiresPoliticalAlignment(b)) {
    const polA = normalizeKey(a.politics);
    const polB = normalizeKey(b.politics);
    if (polA && polB && polA !== polB) {
      reasons.push(`Political alignment required but profiles differ (${a.politics} vs ${b.politics}).`);
    }
  }

  const sa = a.substance ?? {};
  const sb = b.substance ?? {};
  const substancePairs: [string, string | null | undefined, string | null | undefined][] = [
    ['alcohol', sa.partnerDrinksComfort, sb.alcoholFrequency],
    ['alcohol (reverse)', sb.partnerDrinksComfort, sa.alcoholFrequency],
    ['cigarettes', sa.partnerCigarettesComfort, sb.cigaretteFrequency],
    ['cigarettes (reverse)', sb.partnerCigarettesComfort, sa.cigaretteFrequency],
    ['cannabis/tobacco', sa.partnerCannabisTobaccoComfort, sb.cannabisTobaccoFrequency],
    ['cannabis/tobacco (reverse)', sb.partnerCannabisTobaccoComfort, sa.cannabisTobaccoFrequency],
    ['recreational drugs', sa.partnerRecreationalDrugsComfort, sb.recreationalDrugsFrequency],
    ['recreational drugs (reverse)', sb.partnerRecreationalDrugsComfort, sa.recreationalDrugsFrequency],
  ];
  for (const [label, comfort, freq] of substancePairs) {
    if (hardSubstanceIncompatibility(comfort, freq)) {
      reasons.push(`Substance use dealbreaker (${label}).`);
    }
  }

  if (reasons.length === 0 && computeDealbreakerMultiplier(a, b) === 0) {
    reasons.push('Hard dealbreaker detected (unspecified).');
  }

  return reasons;
}
