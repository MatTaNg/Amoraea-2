import { supabase } from "@/data/supabaseClient";
import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import {
  primaryConflictStyle,
  type ConflictStyleCounts,
  tallyResponses,
} from "@/data/assessments/instruments/conflictStyleScoring";
import { traitsRepo } from "@/data/repos/traitsRepo";
import { profilesRepo } from "@/data/repos/profilesRepo";
import type { Result } from "@/src/types";
import type { TraitScores } from "@/src/types";
import {
  buildAssessmentResultSummary,
  instrumentToTestId,
} from "@/data/services/assessmentService";
import { buildDetailedInsightRows } from "@/data/assessments/insightContent";

export type ConflictStyleResponseRow = {
  questionIndex: number;
  selectedOptionIndex: number;
  selectedStyle: ConflictStyleKey;
};

function countsToTraitPercents(counts: ConflictStyleCounts): Pick<
  TraitScores,
  | "conflictCompeting"
  | "conflictCollaborating"
  | "conflictCompromising"
  | "conflictAvoiding"
  | "conflictAccommodating"
> {
  const pct = (n: number) => Math.round((n / 20) * 100);
  return {
    conflictCompeting: pct(counts.competing),
    conflictCollaborating: pct(counts.collaborating),
    conflictCompromising: pct(counts.compromising),
    conflictAvoiding: pct(counts.avoiding),
    conflictAccommodating: pct(counts.accommodating),
  };
}

/**
 * Snapshot previous scores into history (retake). Call before overwriting conflict_style_scores.
 */
export async function archiveConflictStyleHistory(userId: string): Promise<Result<void>> {
  const { data, error } = await supabase
    .from("conflict_style_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { success: false, error: new Error(error.message) };
  if (!data) return { success: true };

  const { error: insErr } = await supabase.from("conflict_style_history").insert({
    user_id: userId,
    competing: data.competing,
    collaborating: data.collaborating,
    compromising: data.compromising,
    avoiding: data.avoiding,
    accommodating: data.accommodating,
    dominant_style: data.dominant_style,
  });
  if (insErr) return { success: false, error: new Error(insErr.message) };
  return { success: true };
}

export async function saveConflictStyleCompletion(
  userId: string,
  responses: ConflictStyleResponseRow[],
  options: { isRetake: boolean }
): Promise<Result<void>> {
  const answers = responses.map((r) => ({
    questionIndex: r.questionIndex,
    style: r.selectedStyle,
  }));
  const counts = tallyResponses(
    answers.map((a) => ({ questionIndex: a.questionIndex, style: a.style }))
  );
  const dominant = primaryConflictStyle(counts);

  if (options.isRetake) {
    const arch = await archiveConflictStyleHistory(userId);
    if (!arch.success) return arch;
  }

  const { error: delErr } = await supabase
    .from("conflict_style_responses")
    .delete()
    .eq("user_id", userId);
  if (delErr) return { success: false, error: new Error(delErr.message) };

  const rows = responses.map((r) => ({
    user_id: userId,
    question_index: r.questionIndex,
    selected_option_index: r.selectedOptionIndex,
    selected_style: r.selectedStyle,
  }));
  const { error: respErr } = await supabase.from("conflict_style_responses").insert(rows);
  if (respErr) return { success: false, error: new Error(respErr.message) };

  const { error: scoreErr } = await supabase.from("conflict_style_scores").upsert(
    {
      user_id: userId,
      competing: counts.competing,
      collaborating: counts.collaborating,
      compromising: counts.compromising,
      avoiding: counts.avoiding,
      accommodating: counts.accommodating,
      dominant_style: dominant,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (scoreErr) return { success: false, error: new Error(scoreErr.message) };

  const traitPct = countsToTraitPercents(counts);
  const traitsUp = await traitsRepo.updateTraitScores(userId, traitPct);
  if (!traitsUp.success) return traitsUp;

  const scoreRecord = {
    competing: traitPct.conflictCompeting,
    collaborating: traitPct.conflictCollaborating,
    compromising: traitPct.conflictCompromising,
    avoiding: traitPct.conflictAvoiding,
    accommodating: traitPct.conflictAccommodating,
  };
  const rawFlat: Record<string, number> = {};
  responses.forEach((r) => {
    rawFlat[`q${r.questionIndex}`] = r.selectedOptionIndex;
  });

  const { error: uaErr } = await supabase.from("user_assessments").upsert(
    {
      user_id: userId,
      instrument: "CONFLICT-30",
      scores: scoreRecord,
      raw_responses: rawFlat,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,instrument" }
  );
  if (uaErr) return { success: false, error: new Error(uaErr.message) };

  const conflictTestId = instrumentToTestId("CONFLICT-30");
  if (conflictTestId) {
    const summary = buildAssessmentResultSummary(scoreRecord);
    const details = buildDetailedInsightRows("CONFLICT-30", scoreRecord);
    const { error: trErr } = await supabase.from("test_results").upsert(
      {
        user_id: userId,
        test_id: conflictTestId,
        result_summary: summary,
        result_data: { scores: scoreRecord, instrument: "CONFLICT-30", details },
        taken_at: new Date().toISOString(),
      },
      { onConflict: "user_id,test_id" }
    );
    if (trErr) return { success: false, error: new Error(trErr.message) };
  }

  const profUp = await profilesRepo.updateProfile(userId, {
    conflictStyleCompleted: true,
  } as any);
  if (!profUp.success) return profUp;

  return { success: true };
}

/** Draft rows while the 20-question flow is in progress (survives refresh when upserted each step). */
export async function fetchConflictStyleResponseDrafts(
  userId: string
): Promise<
  Result<
    Array<{
      question_index: number;
      selected_option_index: number;
      selected_style: string;
    }>
  >
> {
  const { data, error } = await supabase
    .from("conflict_style_responses")
    .select("question_index,selected_option_index,selected_style")
    .eq("user_id", userId);
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true, data: data ?? [] };
}

export async function upsertConflictStyleDraftAnswer(
  userId: string,
  args: {
    questionIndex: number;
    selectedOptionIndex: number;
    selectedStyle: ConflictStyleKey;
  }
): Promise<Result<void>> {
  const { error } = await supabase.from("conflict_style_responses").upsert(
    {
      user_id: userId,
      question_index: args.questionIndex,
      selected_option_index: args.selectedOptionIndex,
      selected_style: args.selectedStyle,
    },
    { onConflict: "user_id,question_index" }
  );
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true };
}

export async function clearConflictStyleResponseDrafts(userId: string): Promise<Result<void>> {
  const { error } = await supabase.from("conflict_style_responses").delete().eq("user_id", userId);
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true };
}

export async function getConflictStyleScores(
  userId: string
): Promise<
  Result<{
    counts: ConflictStyleCounts;
    dominant: ConflictStyleKey;
    completedAt: string;
  } | null>
> {
  const { data, error } = await supabase
    .from("conflict_style_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { success: false, error: new Error(error.message) };
  if (!data) return { success: true, data: null };
  const counts: ConflictStyleCounts = {
    competing: data.competing,
    collaborating: data.collaborating,
    compromising: data.compromising,
    avoiding: data.avoiding,
    accommodating: data.accommodating,
  };
  return {
    success: true,
    data: {
      counts,
      dominant: data.dominant_style as ConflictStyleKey,
      completedAt: data.completed_at,
    },
  };
}
