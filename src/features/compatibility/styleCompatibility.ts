import { supabase } from '@data/supabase/client';

export interface StyleCompatibilityResult {
  score: number;
  explanation: string;
  overallConfidence: number;
}

type StyleProfileRow = {
  emotional_analytical_score: number | null;
  narrative_conceptual_score: number | null;
  certainty_ambiguity_score: number | null;
  relational_individual_score: number | null;
  warmth_score: number | null;
  overall_confidence: number | null;
};

const neutral = 0.5;

function v(n: number | null | undefined): number {
  return Number.isFinite(n) ? Number(n) : neutral;
}

export async function computeStyleCompatibility(
  userIdA: string,
  userIdB: string
): Promise<StyleCompatibilityResult> {
  const { data, error } = await supabase
    .from('communication_style_profiles')
    .select(
      'user_id, emotional_analytical_score, narrative_conceptual_score, certainty_ambiguity_score, relational_individual_score, warmth_score, overall_confidence'
    )
    .in('user_id', [userIdA, userIdB]);
  if (error) throw new Error(`Failed to fetch style profiles: ${error.message}`);

  const byId = new Map<string, StyleProfileRow>();
  (data ?? []).forEach((row: Record<string, unknown>) => {
    byId.set(String(row.user_id), {
      emotional_analytical_score: row.emotional_analytical_score as number | null,
      narrative_conceptual_score: row.narrative_conceptual_score as number | null,
      certainty_ambiguity_score: row.certainty_ambiguity_score as number | null,
      relational_individual_score: row.relational_individual_score as number | null,
      warmth_score: row.warmth_score as number | null,
      overall_confidence: row.overall_confidence as number | null,
    });
  });

  const a = byId.get(userIdA);
  const b = byId.get(userIdB);
  if (!a || !b) {
    return {
      score: 0.5,
      explanation: 'Style data is limited for one or both users, so style compatibility is treated as neutral.',
      overallConfidence: 0,
    };
  }

  const dEmotionalAnalytical = Math.abs(v(a.emotional_analytical_score) - v(b.emotional_analytical_score));
  const dNarrativeConceptual = Math.abs(v(a.narrative_conceptual_score) - v(b.narrative_conceptual_score));
  const dCertaintyAmbiguity = Math.abs(v(a.certainty_ambiguity_score) - v(b.certainty_ambiguity_score));
  const dRelationalIndividual = Math.abs(v(a.relational_individual_score) - v(b.relational_individual_score));
  const dWarmth = Math.abs(v(a.warmth_score) - v(b.warmth_score));

  const score = Math.max(
    0,
    Math.min(
      1,
      1 -
        (
          dEmotionalAnalytical * 0.2 +
          dNarrativeConceptual * 0.2 +
          dCertaintyAmbiguity * 0.25 +
          dRelationalIndividual * 0.15 +
          dWarmth * 0.2
        )
    )
  );

  const confidence = (v(a.overall_confidence) + v(b.overall_confidence)) / 2;
  const explanation = [
    `Style compatibility is ${(score * 100).toFixed(0)}%.`,
    `Biggest alignment appears in ${dNarrativeConceptual <= dCertaintyAmbiguity ? 'narrative style' : 'certainty tolerance'}.`,
    `Largest gap appears in ${dCertaintyAmbiguity >= dWarmth ? 'certainty/ambiguity tolerance' : 'warmth expression'}.`,
    'This style signal is weighted by confidence so low-confidence profiles stay close to neutral.',
  ].join(' ');

  return {
    score,
    explanation,
    overallConfidence: confidence,
  };
}

export function computeFinalCompatibilityScore(params: {
  attachmentScore: number; // 0..1
  valuesScore: number; // 0..1
  semanticScore: number; // 0..1
  styleScore: number; // 0..1
  styleConfidence: number; // 0..1
  dealbreakerMultiplier: number; // 0..1
}): number {
  const styleConfidence = Math.max(0, Math.min(1, params.styleConfidence));
  const weightedStyleScore = params.styleScore * styleConfidence + 0.5 * (1 - styleConfidence);
  const finalScore =
    (params.attachmentScore * 0.35 +
      params.valuesScore * 0.3 +
      weightedStyleScore * 0.2 +
      params.semanticScore * 0.15) * params.dealbreakerMultiplier;
  return Math.max(0, Math.min(1, finalScore));
}

