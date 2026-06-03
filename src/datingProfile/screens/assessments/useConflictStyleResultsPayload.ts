import { useState, useEffect } from "react";
import { getConflictStyleScores } from "@/data/services/conflictStyleService";
import {
  countsToPercentages,
  hasDominantTie,
  tiedForDominant,
} from "@/data/assessments/instruments/conflictStyleScoring";
import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import { CONFLICT_STYLE_KEYS } from "@/data/assessments/instruments/conflictStyleTypes";
import {
  buildRelationshipInterpretation,
  styleDisplayName,
} from "@/data/assessments/conflictStyleResultsNarrative";
import type { ConflictStyleCounts } from "@/data/assessments/instruments/conflictStyleScoring";

export const CONFLICT_STYLE_RESULT_DESCRIPTIONS: Record<
  ConflictStyleKey,
  { short: string; long: string }
> = {
  competing: {
    short:
      "You tend to pursue your goals firmly in conflict, even at short-term relational cost.",
    long: "You value directness and are comfortable with disagreement.",
  },
  collaborating: {
    short:
      "You seek solutions that fully satisfy both parties and lean into conflict as an opportunity for mutual understanding.",
    long: "You invest time and depth in working things through.",
  },
  compromising: {
    short:
      "You look for middle ground and are willing to give something up to move forward.",
    long: "You value fairness and practical resolution.",
  },
  avoiding: {
    short: "You tend to sidestep or delay engaging with conflict.",
    long: "You may prefer to let issues resolve naturally or wait for a better moment.",
  },
  accommodating: {
    short:
      "You prioritize the relationship and the other person's needs over your own position in conflict.",
    long: "You are willing to concede to keep things peaceful.",
  },
};

export type ConflictStyleResultsPayload = {
  loading: boolean;
  dominant: ConflictStyleKey | null;
  counts: ConflictStyleCounts | null;
  percents: Record<ConflictStyleKey, number> | null;
  ranked: { k: ConflictStyleKey; p: number }[];
  dominantLabel: string;
  leadText: string;
  narrative: ReturnType<typeof buildRelationshipInterpretation> | null;
};

export function useConflictStyleResultsPayload(
  userId: string | undefined,
): ConflictStyleResultsPayload {
  const [loading, setLoading] = useState(true);
  const [dominant, setDominant] = useState<ConflictStyleKey | null>(null);
  const [counts, setCounts] = useState<ConflictStyleCounts | null>(null);
  const [percents, setPercents] = useState<Record<ConflictStyleKey, number> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const res = await getConflictStyleScores(userId);
      if (cancelled) return;
      if (res.success && res.data) {
        setDominant(res.data.dominant);
        setCounts(res.data.counts);
        setPercents(countsToPercentages(res.data.counts));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const narrative = counts ? buildRelationshipInterpretation(counts) : null;
  const dominantLabel =
    counts && hasDominantTie(counts)
      ? tiedForDominant(counts)
          .map((k) => styleDisplayName(k))
          .join(" · ")
      : dominant
        ? styleDisplayName(dominant)
        : "";
  const leadText =
    counts && dominant
      ? hasDominantTie(counts)
        ? tiedForDominant(counts)
            .map((k) => `${CONFLICT_STYLE_RESULT_DESCRIPTIONS[k].short} ${CONFLICT_STYLE_RESULT_DESCRIPTIONS[k].long}`)
            .join(" ")
        : `${CONFLICT_STYLE_RESULT_DESCRIPTIONS[dominant].short} ${CONFLICT_STYLE_RESULT_DESCRIPTIONS[dominant].long}`
      : "";

  const ranked =
    percents != null
      ? [...CONFLICT_STYLE_KEYS]
          .map((k) => ({ k, p: percents[k] }))
          .sort((a, b) => b.p - a.p)
      : [];

  return {
    loading,
    dominant,
    counts,
    percents,
    ranked,
    dominantLabel,
    leadText,
    narrative,
  };
}
