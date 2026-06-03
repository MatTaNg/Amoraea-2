import { useState, useEffect } from "react";
import {
  getAssessmentResult,
  getNextAssessmentStepMeta,
  saveAssessmentAiReflection,
  type AssessmentId,
} from "@/data/services/assessmentService";
import { fetchAssessmentAiInsight } from "@/data/services/assessmentAiInsightService";
import {
  getInsightContent,
  INSTRUMENT_TITLES,
} from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";

const AI_INSIGHT_INSTRUMENTS = new Set<AssessmentId>([
  "ECR-36",
  "PVQ-21",
  "CONFLICT-30",
]);

function splitInsightParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function contentToSnapshot(
  instrumentId: AssessmentId,
  content: ReturnType<typeof getInsightContent>,
): AssessmentInsightSnapshot {
  return {
    instrumentLabel: INSTRUMENT_TITLES[instrumentId] ?? instrumentId,
    headline: content.headline,
    body: content.body,
    growthEdge: content.growthEdge,
    details: Array.isArray(content.details) ? content.details : [],
    aiParagraphs: undefined,
  };
}

export type AssessmentInsightPayload = {
  loading: boolean;
  snapshot: AssessmentInsightSnapshot | null;
  aiParagraphs: string[];
  aiPhase: "idle" | "loading" | "ready" | "off";
  isFinal: boolean;
  nextTitle: string | null;
  nextMeta: string | null;
};

export function useAssessmentInsightPayload(
  userId: string | undefined,
  instrumentId: AssessmentId | "",
): AssessmentInsightPayload {
  const [snapshot, setSnapshot] = useState<AssessmentInsightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiParagraphs, setAiParagraphs] = useState<string[]>([]);
  const [aiPhase, setAiPhase] = useState<"idle" | "loading" | "ready" | "off">("idle");
  const [isFinal, setIsFinal] = useState(false);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextMeta, setNextMeta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setSnapshot(null);
      setAiParagraphs([]);
      setAiPhase("idle");

      if (!userId || !instrumentId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const result = await getAssessmentResult(userId, instrumentId);
        if (cancelled) return;

        const scores =
          result.success && result.data?.scores
            ? result.data.scores
            : ({} as Record<string, number>);
        const cachedAiFromDb =
          result.success && result.data?.aiReflectionParagraphs?.length
            ? result.data.aiReflectionParagraphs
            : [];

        const content = getInsightContent(instrumentId, scores);
        const nextSnapshot = contentToSnapshot(instrumentId, content);
        let nextAiParagraphs: string[] = [];
        let nextAiPhase: "ready" | "off" = "off";

        if (
          AI_INSIGHT_INSTRUMENTS.has(instrumentId) &&
          Object.keys(scores).length > 0
        ) {
          if (cachedAiFromDb.length > 0) {
            nextAiParagraphs = cachedAiFromDb;
            nextAiPhase = "ready";
          } else {
            const ai = await fetchAssessmentAiInsight(instrumentId, scores);
            if (cancelled) return;
            if (ai.status === "ready") {
              nextAiParagraphs = splitInsightParagraphs(ai.text);
              nextAiPhase = "ready";
              void saveAssessmentAiReflection(userId, instrumentId, nextAiParagraphs).catch(
                () => undefined,
              );
            }
          }
        }

        if (cancelled) return;
        setSnapshot(nextSnapshot);
        const stepMeta = getNextAssessmentStepMeta(instrumentId);
        setIsFinal(stepMeta.isFinal);
        setNextTitle(stepMeta.nextTitle);
        setNextMeta(stepMeta.nextMeta);
        setAiParagraphs(nextAiParagraphs);
        setAiPhase(nextAiPhase);
        setLoading(false);
      } catch {
        if (cancelled) return;
        const fallbackContent = getInsightContent(instrumentId, {});
        setSnapshot(contentToSnapshot(instrumentId, fallbackContent));
        const stepMeta =
          instrumentId && instrumentId.length > 0
            ? getNextAssessmentStepMeta(instrumentId)
            : { isFinal: false, nextTitle: null, nextMeta: null };
        setIsFinal(stepMeta.isFinal);
        setNextTitle(stepMeta.nextTitle);
        setNextMeta(stepMeta.nextMeta);
        setAiParagraphs([]);
        setAiPhase("off");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, instrumentId]);

  return {
    loading,
    snapshot,
    aiParagraphs,
    aiPhase,
    isFinal,
    nextTitle,
    nextMeta,
  };
}
