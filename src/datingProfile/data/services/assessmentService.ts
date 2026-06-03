import { Result } from "@/src/types";
import { supabase } from "@/data/supabaseClient";
import { profilesRepo } from "@/data/repos/profilesRepo";
import {
  buildDetailedInsightRows,
  getInsightContent,
} from "@/data/assessments/insightContent";
import { sexualCommunicationBand } from "@features/psychometrics/postInterviewSexualCommunicationService";
import { buildSexualCommunicationScores } from "@features/psychometrics/sexualCommunicationInsight";

export type AssessmentId =
  | "ECR-36"
  | "BFI-2"
  | "DSI-R"
  | "BRS"
  | "PVQ-21"
  | "CONFLICT-30"
  | "SEXUAL_COMMUNICATION";

/** Profile psychometrics after interview — shortest instruments first. */
export const ASSESSMENT_IDS = [
  "SEXUAL_COMMUNICATION",
  "PVQ-21",
  "CONFLICT-30",
  "ECR-36",
] as const;

/** Approximate minutes per instrument on the post-interview typology intro. */
export const TYPOLOGY_ASSESSMENT_DURATION_MIN: Record<(typeof ASSESSMENT_IDS)[number], number> = {
  SEXUAL_COMMUNICATION: 1,
  "PVQ-21": 3,
  "CONFLICT-30": 9,
  "ECR-36": 5,
};

export const TYPOLOGY_PROFILE_SETUP_DURATION_MIN = 12;

export const TYPOLOGY_ONBOARDING_TOTAL_DURATION_LABEL = "20–30 min";

const ASSESSMENT_NEXT_META: Record<(typeof ASSESSMENT_IDS)[number], string> = {
  SEXUAL_COMMUNICATION: "10 questions · ~1 min",
  "PVQ-21": "21 questions · ~3 min",
  "CONFLICT-30": "21 situations · ~9 min",
  "ECR-36": "36 questions · ~5 min",
};

const ASSESSMENT_DISPLAY_TITLES: Record<(typeof ASSESSMENT_IDS)[number], string> = {
  SEXUAL_COMMUNICATION: "Sexual Communication",
  "PVQ-21": "Schwartz Values",
  "CONFLICT-30": "Conflict Style",
  "ECR-36": "Attachment Style",
};

/** Insight / results screens: next step from {@link ASSESSMENT_IDS}, not hardcoded per instrument. */
export function getNextAssessmentStepMeta(current: AssessmentId): {
  isFinal: boolean;
  nextTitle: string | null;
  nextMeta: string | null;
} {
  const next = getNextInstrument(current);
  if (!next) {
    return { isFinal: true, nextTitle: null, nextMeta: null };
  }
  return {
    isFinal: false,
    nextTitle: ASSESSMENT_DISPLAY_TITLES[next] ?? next,
    nextMeta: ASSESSMENT_NEXT_META[next] ?? null,
  };
}

export const FIRST_DATING_PROFILE_ASSESSMENT_ID: (typeof ASSESSMENT_IDS)[number] =
  ASSESSMENT_IDS[0];

/** Shown on the insight screen after the last instrument in {@link ASSESSMENT_IDS}. */
export const ASSESSMENT_BATTERY_COMPLETE_TITLE =
  "You've finished the relationship questionnaires.";
export const ASSESSMENT_BATTERY_COMPLETE_BODY =
  "Next you'll add photos and the rest of your profile.";

/** 1-based position in the onboarding battery (e.g. PVQ-21 → 1). */
export function onboardingAssessmentBatteryIndex(instrument: string): number | null {
  const idx = (ASSESSMENT_IDS as readonly string[]).indexOf(instrument);
  return idx >= 0 ? idx + 1 : null;
}

export function isActiveAssessmentId(instrument: string): instrument is AssessmentId {
  return (ASSESSMENT_IDS as readonly string[]).includes(instrument);
}

/** Map resume/deep-link instrument to an active battery step (skips retired instruments). */
export function resolveActiveAssessmentId(
  instrument: string | null | undefined,
  completedInstrumentIds: string[] = [],
): AssessmentId {
  if (instrument && isActiveAssessmentId(instrument)) {
    return instrument;
  }
  return getFirstIncompleteAssessment(completedInstrumentIds) ?? FIRST_DATING_PROFILE_ASSESSMENT_ID;
}

const INSTRUMENT_TO_TEST_ID: Record<string, string> = {
  "ECR-36": "attachment",
  "BFI-2": "big5",
  "DSI-R": "diffself",
  BRS: "resilience",
  "PVQ-21": "values",
  "CONFLICT-30": "conflict",
  SEXUAL_COMMUNICATION: "sexual_communication",
};

export function instrumentToTestId(instrument: string): string | null {
  return INSTRUMENT_TO_TEST_ID[instrument] ?? null;
}

export function testIdToInstrument(testId: string): AssessmentId | null {
  const entry = Object.entries(INSTRUMENT_TO_TEST_ID).find(([, v]) => v === testId);
  return entry ? (entry[0] as AssessmentId) : null;
}

export function buildAssessmentResultSummary(scores: Record<string, number>): string {
  const keys = Object.keys(scores);
  if (keys.length === 0) return "Completed";
  return keys
    .slice(0, 5)
    .map((k) => {
      const v = scores[k];
      return `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`;
    })
    .join(" · ");
}

export interface SaveAssessmentResultOptions {
  timeTakenSec?: number;
  /** Post-interview sexual communication: persist scores without advancing dating onboarding. */
  skipProfileUpdate?: boolean;
}

export interface AssessmentRecord {
  id: string;
  user_id: string;
  instrument: string;
  completed_at: string;
  scores: Record<string, number>;
  raw_responses: Record<string, number>;
  time_taken_sec: number | null;
}

/**
 * Reset assessment state when re-entering the instrument flow before any test has started.
 */
export async function markOnboardingCompleteForAssessments(
  userId: string
): Promise<Result<void>> {
  const update = {
    assessmentsStarted: false,
    assessmentsCompleted: false,
  };
  const result = await profilesRepo.updateProfile(userId, update as any);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/**
 * Mark that user has started assessments (e.g. when they continue from the profile-complete break screen).
 */
export async function markAssessmentsStarted(
  userId: string,
  firstInstrument: AssessmentId
): Promise<Result<void>> {
  const update = {
    assessmentsStarted: true,
    currentAssessment: firstInstrument,
    currentAssessmentQuestion: 1,
  };
  const result = await profilesRepo.updateProfile(userId, update as any);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/**
 * Save progress within an assessment (every 5 questions).
 */
export async function saveAssessmentProgress(
  userId: string,
  instrument: AssessmentId,
  questionIndex: number
): Promise<Result<void>> {
  const update = {
    currentAssessment: instrument,
    currentAssessmentQuestion: questionIndex,
  };
  const result = await profilesRepo.updateProfile(userId, update as any);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

async function syncSexualCommunicationUsersRow(
  userId: string,
  rawResponses: Record<string, number>,
  scores: Record<string, number>,
  completedAt: string,
): Promise<void> {
  const numericResponses: Record<number, number> = {};
  for (const [k, v] of Object.entries(rawResponses)) {
    const id = Number(k);
    if (Number.isFinite(id)) numericResponses[id] = v;
  }

  const { error } = await supabase
    .from("users")
    .update({
      psychometrics_sexual_communication_responses: numericResponses,
      psychometrics_sexual_communication_score: scores.total ?? null,
      psychometrics_sexual_communication_completed_at: completedAt,
      psychometrics_sexual_communication_skipped_at: null,
      psychometrics_sexual_communication_current_question_index: null,
      psychometrics_sexual_communication_partial_responses: null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

function buildSexualCommunicationResultSummary(scores: Record<string, number>): string {
  const total = scores.total ?? 0;
  const { band } = sexualCommunicationBand(total);
  return `Sexual Communication: ${total.toFixed(2)}/5.0 — ${band}`;
}

/**
 * After completing an instrument: save to user_assessments and update profile.
 */
export async function saveAssessmentResult(
  userId: string,
  instrument: AssessmentId,
  scores: Record<string, number>,
  rawResponses: Record<string, number>,
  options?: SaveAssessmentResultOptions
): Promise<Result<void>> {
  const completedAt = new Date().toISOString();
  const timeTakenSec = options?.timeTakenSec;

  const { error } = await supabase.from("user_assessments").upsert(
    {
      user_id: userId,
      instrument,
      scores,
      raw_responses: rawResponses,
      time_taken_sec: timeTakenSec ?? null,
      completed_at: completedAt,
    },
    {
      onConflict: "user_id,instrument",
    }
  );
  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  if (instrument === "SEXUAL_COMMUNICATION") {
    try {
      await syncSexualCommunicationUsersRow(userId, rawResponses, scores, completedAt);
    } catch (syncErr) {
      return {
        success: false,
        error: syncErr instanceof Error ? syncErr : new Error(String(syncErr)),
      };
    }
  }

  const testId = instrumentToTestId(instrument);
  if (testId) {
    const details = buildDetailedInsightRows(instrument, scores);
    const summary =
      instrument === "SEXUAL_COMMUNICATION"
        ? buildSexualCommunicationResultSummary(scores)
        : buildAssessmentResultSummary(scores);

    const resultData: Record<string, unknown> = {
      scores,
      instrument,
      details,
    };

    const { error: testResultsError } = await supabase.from("test_results").upsert(
      {
        user_id: userId,
        test_id: testId,
        result_summary: summary,
        result_data: resultData,
        taken_at: completedAt,
      },
      { onConflict: "user_id,test_id" }
    );
    if (testResultsError) {
      return { success: false, error: new Error(testResultsError.message) };
    }
  }

  if (!options?.skipProfileUpdate) {
    const nextInstrument = getNextInstrument(instrument);
    const update: any = {
      currentAssessment: nextInstrument ?? null,
      currentAssessmentQuestion: nextInstrument ? 1 : null,
    };
    if (!nextInstrument) {
      update.assessmentsCompleted = true;
      update.assessmentsCompletedAt = new Date().toISOString();
    } else {
      update.assessmentsCompleted = false;
    }
    const profileResult = await profilesRepo.updateProfile(userId, update);
    if (!profileResult.success) {
      return profileResult;
    }
  }
  return { success: true };
}

/**
 * Persist AI reflection paragraphs into existing test_results (same row as onboarding save).
 */
export async function saveAssessmentAiReflection(
  userId: string,
  instrument: AssessmentId,
  paragraphs: string[]
): Promise<Result<void>> {
  const testId = instrumentToTestId(instrument);
  if (!testId) return { success: true };

  const { data, error } = await supabase
    .from("test_results")
    .select("result_data")
    .eq("user_id", userId)
    .eq("test_id", testId)
    .maybeSingle();

  if (error) return { success: false, error: new Error(error.message) };

  const prev =
    data?.result_data && typeof data.result_data === "object" && !Array.isArray(data.result_data)
      ? (data.result_data as Record<string, unknown>)
      : {};

  const next = {
    ...prev,
    aiReflectionParagraphs: paragraphs,
  };

  const { error: upErr } = await supabase
    .from("test_results")
    .update({ result_data: next })
    .eq("user_id", userId)
    .eq("test_id", testId);

  if (upErr) return { success: false, error: new Error(upErr.message) };
  return { success: true };
}

export function getNextInstrument(current: AssessmentId): AssessmentId | null {
  const i = ASSESSMENT_IDS.indexOf(current as (typeof ASSESSMENT_IDS)[number]);
  if (i < 0 || i >= ASSESSMENT_IDS.length - 1) return null;
  return ASSESSMENT_IDS[i + 1] as AssessmentId;
}

export function getPreviousInstrument(current: AssessmentId): AssessmentId | null {
  const i = ASSESSMENT_IDS.indexOf(current as (typeof ASSESSMENT_IDS)[number]);
  if (i <= 0) return null;
  return ASSESSMENT_IDS[i - 1] as AssessmentId;
}

/** Last instrument in the post-interview typology battery. */
export function lastTypologyBatteryInstrument(): AssessmentId {
  return ASSESSMENT_IDS[ASSESSMENT_IDS.length - 1] as AssessmentId;
}

/**
 * First assessment in {@link ASSESSMENT_IDS} order that does not have a row in `user_assessments`.
 * Used after refresh/deep-link when the URL still points at a completed instrument.
 */
export function getFirstIncompleteAssessment(
  completedInstrumentIds: string[]
): AssessmentId | null {
  for (const id of ASSESSMENT_IDS) {
    if (!completedInstrumentIds.includes(id)) {
      return id;
    }
  }
  return null;
}

/**
 * Stack route for an in-progress assessment. Conflict style is not InstrumentScreen (no shared Likert config).
 */
export function getAssessmentEntryRoute(instrument: string): string {
  if (instrument === "CONFLICT-30") {
    return "/onboarding/assessments/conflict-style";
  }
  return `/onboarding/assessments/instrument?instrument=${encodeURIComponent(instrument)}`;
}

/**
 * Get list of instruments the user has already completed.
 */
export async function getCompletedAssessments(
  userId: string
): Promise<Result<string[]>> {
  const { data, error } = await supabase
    .from("user_assessments")
    .select("instrument")
    .eq("user_id", userId);
  if (error) return { success: false, error: new Error(error.message) };

  const instruments = (data || []).map((r) => r.instrument);

  if (!instruments.includes("SEXUAL_COMMUNICATION")) {
    const { data: userRow } = await supabase
      .from("users")
      .select("psychometrics_sexual_communication_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (userRow?.psychometrics_sexual_communication_completed_at) {
      instruments.push("SEXUAL_COMMUNICATION");
    }
  }

  return {
    success: true,
    data: instruments,
  };
}

function parseAiReflectionParagraphsFromResultData(
  rd: Record<string, unknown>
): string[] | null {
  const raw = rd.aiReflectionParagraphs;
  if (!Array.isArray(raw)) return null;
  const paragraphs = raw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  return paragraphs.length > 0 ? paragraphs : null;
}

/** Instruments whose extras live on `test_results.result_data` for this user row. */
function testResultsEnrichmentNeeded(instrument: string): boolean {
  return (
    instrument === "ECR-36" ||
    instrument === "PVQ-21" ||
    instrument === "CONFLICT-30"
  );
}

/**
 * Get the saved result for one instrument (for insight screen).
 * Loads `test_results` extras (cached AI paragraphs) in one read when applicable.
 */
export async function getAssessmentResult(
  userId: string,
  instrument: string
): Promise<
  Result<{
    scores: Record<string, number>;
    raw_responses: Record<string, number>;
    aiReflectionParagraphs: string[] | null;
  } | null>
> {
  const { data, error } = await supabase
    .from("user_assessments")
    .select("scores, raw_responses")
    .eq("user_id", userId)
    .eq("instrument", instrument)
    .single();
  if (error && error.code !== "PGRST116")
    return { success: false, error: new Error(error.message) };

  if (!data && instrument === "SEXUAL_COMMUNICATION") {
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select(
        "psychometrics_sexual_communication_responses, psychometrics_sexual_communication_score, psychometrics_sexual_communication_completed_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (userErr) return { success: false, error: new Error(userErr.message) };
    if (!userRow?.psychometrics_sexual_communication_completed_at) {
      return { success: true, data: null };
    }
    const rawStored = userRow.psychometrics_sexual_communication_responses;
    const raw =
      rawStored && typeof rawStored === "object" && !Array.isArray(rawStored)
        ? (rawStored as Record<string, number>)
        : {};
    const scores =
      Object.keys(raw).length > 0
        ? buildSexualCommunicationScores(raw)
        : {
            total: (userRow.psychometrics_sexual_communication_score as number) ?? 0,
          };
    return {
      success: true,
      data: { scores, raw_responses: raw, aiReflectionParagraphs: null },
    };
  }

  if (!data) return { success: true, data: null };

  let scores = (data.scores as Record<string, number>) || {};
  const raw =
    data.raw_responses &&
    typeof data.raw_responses === "object" &&
    !Array.isArray(data.raw_responses)
      ? (data.raw_responses as Record<string, number>)
      : {};

  if (
    instrument === "SEXUAL_COMMUNICATION" &&
    Object.keys(raw).length > 0 &&
    !Object.keys(scores).some((k) => k.startsWith("item_"))
  ) {
    scores = buildSexualCommunicationScores(raw);
  }

  let aiReflectionParagraphs: string[] | null = null;

  const testId = instrumentToTestId(instrument);
  if (testId && testResultsEnrichmentNeeded(instrument)) {
    const { data: tr, error: trErr } = await supabase
      .from("test_results")
      .select("result_data")
      .eq("user_id", userId)
      .eq("test_id", testId)
      .maybeSingle();
    if (!trErr && tr?.result_data && typeof tr.result_data === "object" && !Array.isArray(tr.result_data)) {
      const rd = tr.result_data as Record<string, unknown>;
      if (
        instrument === "ECR-36" ||
        instrument === "PVQ-21" ||
        instrument === "CONFLICT-30"
      ) {
        aiReflectionParagraphs = parseAiReflectionParagraphsFromResultData(rd);
      }
    }
  }

  return {
    success: true,
    data: { scores, raw_responses: raw, aiReflectionParagraphs },
  };
}
