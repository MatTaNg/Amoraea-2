import { Result } from "@/src/types";
import { supabase } from "@/data/supabaseClient";
import { profilesRepo } from "@/data/repos/profilesRepo";
import {
  buildDetailedInsightRows,
  getInsightContent,
} from "@/data/assessments/insightContent";

export type AssessmentId =
  | "ECR-36"
  | "BFI-2"
  | "DSI-R"
  | "BRS"
  | "PVQ-21"
  | "CONFLICT-30";

/** Order: Attachment → Conflict style → Schwartz values */
export const ASSESSMENT_IDS = ["ECR-36", "CONFLICT-30", "PVQ-21"] as const;

const INSTRUMENT_TO_TEST_ID: Record<string, string> = {
  "ECR-36": "attachment",
  "BFI-2": "big5",
  "DSI-R": "diffself",
  BRS: "resilience",
  "PVQ-21": "values",
  "CONFLICT-30": "conflict",
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
 * Reset assessment state when user reaches Break screen (profile done, assessments not started).
 * Does not set onboardingCompleted; that is set only when all assessments are finished.
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
 * Mark that user has started assessments (e.g. when they tap Continue from Intro).
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

/**
 * After completing an instrument: save to user_assessments and update profile.
 */
export async function saveAssessmentResult(
  userId: string,
  instrument: AssessmentId,
  scores: Record<string, number>,
  rawResponses: Record<string, number>,
  timeTakenSec?: number
): Promise<Result<void>> {
  const { error } = await supabase.from("user_assessments").upsert(
    {
      user_id: userId,
      instrument,
      scores,
      raw_responses: rawResponses,
      time_taken_sec: timeTakenSec ?? null,
    },
    {
      onConflict: "user_id,instrument",
    }
  );
  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  const testId = instrumentToTestId(instrument);
  if (testId) {
    const summary = buildAssessmentResultSummary(scores);
    const details = buildDetailedInsightRows(instrument, scores);
    const { error: testResultsError } = await supabase.from("test_results").upsert(
      {
        user_id: userId,
        test_id: testId,
        result_summary: summary,
        result_data: { scores, instrument, details },
        taken_at: new Date().toISOString(),
      },
      { onConflict: "user_id,test_id" }
    );
    if (testResultsError) {
      return { success: false, error: new Error(testResultsError.message) };
    }
  }

  const nextInstrument = getNextInstrument(instrument);
  const update: any = {
    currentAssessment: nextInstrument ?? null,
    currentAssessmentQuestion: nextInstrument ? 1 : null,
  };
  if (!nextInstrument) {
    update.assessmentsCompleted = true;
    update.assessmentsCompletedAt = new Date().toISOString();
    update.onboardingCompleted = true;
    update.onboardingCompletedAt = new Date().toISOString();
  }
  const profileResult = await profilesRepo.updateProfile(userId, update);
  if (!profileResult.success) {
    return profileResult;
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
  return {
    success: true,
    data: (data || []).map((r) => r.instrument),
  };
}

/**
 * Get the saved result for one instrument (for insight screen).
 */
export async function getAssessmentResult(
  userId: string,
  instrument: string
): Promise<Result<{ scores: Record<string, number> } | null>> {
  const { data, error } = await supabase
    .from("user_assessments")
    .select("scores")
    .eq("user_id", userId)
    .eq("instrument", instrument)
    .single();
  if (error && error.code !== "PGRST116")
    return { success: false, error: new Error(error.message) };
  if (!data) return { success: true, data: null };
  return { success: true, data: { scores: (data.scores as Record<string, number>) || {} } };
}
