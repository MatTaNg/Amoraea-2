import type { CompatibilityFormData } from '@/domain/models/CompatibilityForm';
import { SCHWARTZ_FORM_KEYS } from '@/domain/models/TypologyForm';
import type {
  AttachmentProfile,
  ConflictStyleScores,
  DealbreakerProfile,
  FinanceProfile,
  InterviewProcessPillars,
  PoliticsProfile,
  PsychometricProfile,
  RelationalCapacityInput,
  SubstanceUseProfile,
  ValuesProfile,
} from './computeCompatibilityScore';
import type { MatchmakingUserSnapshot } from './matchmakingPairPayload';

/** Optional DB fields not fully represented on {@link MatchmakingUserSnapshot}. */
export type MatchmakingUserMappingExtras = {
  compatibilityData?: Partial<CompatibilityFormData> | null;
  profileJson?: Record<string, unknown> | null;
  locationCoords?: { lat: number; lng: number } | null;
  npiEntitlementScore?: number | null;
  anxietyTraitScore?: number | null;
  gaspExternalizationScore?: number | null;
  prefPartnerPoliticalAlignmentImportance?: string | null;
};

export type MappedUserCompatibilityInputs = {
  userId: string;
  dealbreaker: DealbreakerProfile;
  relationalCapacity: RelationalCapacityInput;
  attachment: AttachmentProfile | null;
  values: ValuesProfile | null;
  finance: FinanceProfile;
  lifeDomainSettings: Record<string, number>;
  interviewProcess: InterviewProcessPillars | null;
  interviewWeightedScore: number;
  conflictStyle: ConflictStyleScores | null;
  politics: PoliticsProfile;
  psychometricSoft: PsychometricProfile;
  sexualCommunicationMean: number | null;
};

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readProfileJsonField(
  snapshot: MatchmakingUserSnapshot,
  extras: MatchmakingUserMappingExtras | undefined,
  key: string,
): unknown {
  const fromExtras = extras?.profileJson?.[key];
  if (fromExtras !== undefined && fromExtras !== null) return fromExtras;
  const profileRecord = snapshot.profile as Record<string, unknown> | undefined;
  return profileRecord?.[key];
}

function readMatchPreference(
  snapshot: MatchmakingUserSnapshot,
  key: string,
): string | null {
  const mp = snapshot.preferences?.matchPreferences;
  if (!mp || typeof mp !== 'object') return null;
  return strOrNull((mp as Record<string, unknown>)[key]);
}

function readFinanceAnswer(
  snapshot: MatchmakingUserSnapshot,
  questionKey: 'financesPooled' | 'yearlyIncome',
): string | null {
  const fromAnswers = snapshot.profile?.lifeDomains?.answers?.finance?.[questionKey];
  if (fromAnswers) return strOrNull(fromAnswers);
  return null;
}

function mapLifeDomainSettings(snapshot: MatchmakingUserSnapshot): Record<string, number> {
  const ld = snapshot.profile?.lifeDomains;
  const keys = ['intimacy', 'finance', 'spirituality', 'family', 'physicalHealth'] as const;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const v = ld?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
    }
  }
  return out;
}

function mapSubstanceProfile(
  compat: Partial<CompatibilityFormData> | null | undefined,
): SubstanceUseProfile {
  return {
    alcoholFrequency: compat?.alcoholFrequency ?? null,
    partnerDrinksComfort: compat?.partnerDrinksComfort ?? null,
    cigaretteFrequency: compat?.cigaretteFrequency ?? null,
    partnerCigarettesComfort: compat?.partnerCigarettesComfort ?? null,
    cannabisTobaccoFrequency: compat?.cannabisTobaccoFrequency ?? null,
    partnerCannabisTobaccoComfort: compat?.partnerCannabisTobaccoComfort ?? null,
    recreationalDrugsFrequency: compat?.recreationalDrugsFrequency ?? null,
    partnerRecreationalDrugsComfort: compat?.partnerRecreationalDrugsComfort ?? null,
  };
}

function mapDealbreakerProfile(
  snapshot: MatchmakingUserSnapshot,
  extras: MatchmakingUserMappingExtras | undefined,
  compat: Partial<CompatibilityFormData> | null | undefined,
): DealbreakerProfile {
  const relocationPref =
    readMatchPreference(snapshot, 'relocationPreference') ??
    (compat?.willingToRelocate === true
      ? 'Yes'
      : compat?.willingToRelocate === false
        ? 'No'
        : null);

  return {
    wantKids: strOrNull(snapshot.profile?.wantKids) ?? strOrNull(readProfileJsonField(snapshot, extras, 'wantKids')),
    requireSameReligion: undefined,
    partnerSameReligionRequired:
      readMatchPreference(snapshot, 'partnerSameReligionRequired') ??
      strOrNull(readProfileJsonField(snapshot, extras, 'partnerSameReligionRequired')),
    religion: strOrNull(snapshot.profile?.religion) ?? strOrNull(readProfileJsonField(snapshot, extras, 'religion')),
    relationshipStyle:
      strOrNull(snapshot.profile?.relationshipStyle) ??
      strOrNull(snapshot.preferences?.relationshipType) ??
      strOrNull(readProfileJsonField(snapshot, extras, 'relationshipStyle')),
    willingToRelocate: compat?.willingToRelocate ?? snapshot.preferences?.willingToRelocate ?? null,
    relocationPreference: relocationPref,
    requiresPoliticalAlignment: undefined,
    prefPartnerPoliticalAlignmentImportance:
      extras?.prefPartnerPoliticalAlignmentImportance ??
      strOrNull(readProfileJsonField(snapshot, extras, 'prefPartnerPoliticalAlignmentImportance')),
    politics: strOrNull(snapshot.profile?.politics) ?? strOrNull(readProfileJsonField(snapshot, extras, 'politics')),
    location: extras?.locationCoords ?? null,
    substance: mapSubstanceProfile(compat),
  };
}

function mapRelationalCapacity(
  snapshot: MatchmakingUserSnapshot,
  extras: MatchmakingUserMappingExtras | undefined,
): RelationalCapacityInput {
  const pillars = snapshot.interview?.pillarScores ?? {};
  const psych = snapshot.preInterviewPsychometrics ?? {};

  return {
    repair: numOrNull(pillars.repair),
    regulation: numOrNull(pillars.regulation),
    contempt: numOrNull(pillars.contempt),
    accountability: numOrNull(pillars.accountability),
    mentalizing: numOrNull(pillars.mentalizing),
    rfqScore: numOrNull(psych.rfqScore),
    gaspExternalizationScore:
      extras?.gaspExternalizationScore ?? numOrNull(psych.gaspScore),
    scsSfScore: numOrNull(psych.scsSfScore),
    brsScore: numOrNull(psych.brsScore),
    anxietyTraitScore: extras?.anxietyTraitScore ?? null,
    dweckScore: numOrNull(psych.dweckScore),
  };
}

function mapAttachment(snapshot: MatchmakingUserSnapshot): AttachmentProfile | null {
  const att = snapshot.postInterviewTypology?.attachment;
  const anxiety = numOrNull(att?.anxiety);
  const avoidance = numOrNull(att?.avoidance);
  if (anxiety == null || avoidance == null) return null;
  return { anxiety, avoidance };
}

function mapValues(snapshot: MatchmakingUserSnapshot): ValuesProfile | null {
  const raw = snapshot.postInterviewTypology?.values;
  if (!raw) return null;

  const out: ValuesProfile = {};
  let hasAny = false;
  for (const key of SCHWARTZ_FORM_KEYS) {
    const v = numOrNull(raw[key]);
    if (v != null) {
      out[key] = v;
      hasAny = true;
    }
  }
  return hasAny ? out : null;
}

function mapFinanceProfile(
  snapshot: MatchmakingUserSnapshot,
  compat: Partial<CompatibilityFormData> | null | undefined,
): FinanceProfile {
  return {
    financesPooled: readFinanceAnswer(snapshot, 'financesPooled'),
    financialRiskComfort: compat?.financialRiskComfort ?? null,
    yearlyIncome: readFinanceAnswer(snapshot, 'yearlyIncome'),
  };
}

function mapInterviewProcess(snapshot: MatchmakingUserSnapshot): InterviewProcessPillars | null {
  const pillars = snapshot.interview?.pillarScores ?? {};
  const repair = numOrNull(pillars.repair);
  const accountability = numOrNull(pillars.accountability);
  const contempt = numOrNull(pillars.contempt);
  if (repair == null || accountability == null || contempt == null) return null;
  return { repair, accountability, contempt };
}

function mapConflictStyle(snapshot: MatchmakingUserSnapshot): ConflictStyleScores | null {
  const cs = snapshot.postInterviewTypology?.conflictStyle;
  if (!cs) return null;
  const competing = numOrNull(cs.competing);
  const collaborating = numOrNull(cs.collaborating);
  const compromising = numOrNull(cs.compromising);
  const avoiding = numOrNull(cs.avoiding);
  const accommodating = numOrNull(cs.accommodating);
  if (
    competing == null ||
    collaborating == null ||
    compromising == null ||
    avoiding == null ||
    accommodating == null
  ) {
    return null;
  }
  return { competing, collaborating, compromising, avoiding, accommodating };
}

function mapPsychometricSoft(
  snapshot: MatchmakingUserSnapshot,
  extras: MatchmakingUserMappingExtras | undefined,
): PsychometricProfile {
  const psych = snapshot.preInterviewPsychometrics ?? {};
  return {
    npiEntitlementScore: extras?.npiEntitlementScore ?? null,
    dweckScore: numOrNull(psych.dweckScore),
    scsSfScore: numOrNull(psych.scsSfScore),
  };
}

/** Map a {@link MatchmakingUserSnapshot} into v2 algorithm input types. */
export function mapMatchmakingUserToCompatibilityInputs(
  snapshot: MatchmakingUserSnapshot,
  extras?: MatchmakingUserMappingExtras,
): MappedUserCompatibilityInputs {
  const compat = extras?.compatibilityData ?? null;

  return {
    userId: snapshot.userId,
    dealbreaker: mapDealbreakerProfile(snapshot, extras, compat),
    relationalCapacity: mapRelationalCapacity(snapshot, extras),
    attachment: mapAttachment(snapshot),
    values: mapValues(snapshot),
    finance: mapFinanceProfile(snapshot, compat),
    lifeDomainSettings: mapLifeDomainSettings(snapshot),
    interviewProcess: mapInterviewProcess(snapshot),
    interviewWeightedScore:
      numOrNull(snapshot.interview?.modifiedWeightedScore) ??
      numOrNull(snapshot.interview?.weightedScore) ??
      0,
    conflictStyle: mapConflictStyle(snapshot),
    politics: { politics: strOrNull(snapshot.profile?.politics) },
    psychometricSoft: mapPsychometricSoft(snapshot, extras),
    sexualCommunicationMean: numOrNull(snapshot.postInterviewTypology?.sexualCommunicationMean),
  };
}
