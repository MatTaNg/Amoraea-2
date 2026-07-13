import { supabase } from "@/data/supabaseClient";
import type { AssessmentId } from "@/data/services/assessmentService";
import {
  ASSESSMENT_AI_SYSTEM_PROMPT,
  buildAssessmentAiUserMessage,
} from "@/data/assessments/assessmentAiInsightPrompt";

const AI_INSTRUMENTS = new Set<AssessmentId>(["ECR-36", "PVQ-21", "CONFLICT-30"]);

export type AssessmentAiInsightResult =
  | { status: "ready"; text: string }
  | { status: "skipped" }
  | { status: "error" };

/**
 * EXPO_PUBLIC_* is bundled into the client — anyone can extract this key from a release build.
 * Prefer Supabase Edge Function + `supabase secrets set OPENAI_API_KEY` for production.
 */
function getExpoPublicOpenAiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() || undefined;
}

async function fetchInsightViaOpenAiDirect(
  apiKey: string,
  instrument: AssessmentId,
  scores: Record<string, number>
): Promise<AssessmentAiInsightResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.65,
        max_tokens: 700,
        messages: [
          { role: "system", content: ASSESSMENT_AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write the personalized reflection for this user.\n\n${buildAssessmentAiUserMessage(instrument, scores)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { status: "error" };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { status: "skipped" };
    }
    return { status: "ready", text };
  } catch {
    return { status: "error" };
  }
}

async function fetchInsightViaEdgeFunction(
  instrument: AssessmentId,
  scores: Record<string, number>
): Promise<AssessmentAiInsightResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    skip?: boolean;
    text?: string;
    error?: string;
    reason?: string;
  }>("assessment-ai-insight", {
    body: { instrument, scores },
  });

  if (error) {
    return { status: "error" };
  }

  if (!data?.ok && (data?.skip || data?.reason === "openai_not_configured")) {
    return { status: "skipped" };
  }

  if (data?.ok && typeof data.text === "string" && data.text.trim()) {
    return { status: "ready", text: data.text.trim() };
  }

  return { status: "skipped" };
}

/**
 * Loads personalized reflection text.
 * 1. If `EXPO_PUBLIC_OPENAI_API_KEY` is set, calls OpenAI from the app (works on native; Expo Web may hit CORS).
 * 2. Otherwise uses Edge Function `assessment-ai-insight` with server-side `OPENAI_API_KEY`.
 */
export async function fetchAssessmentAiInsight(
  instrument: AssessmentId,
  scores: Record<string, number>
): Promise<AssessmentAiInsightResult> {
  if (!AI_INSTRUMENTS.has(instrument) || Object.keys(scores).length === 0) {
    return { status: "skipped" };
  }

  const publicKey = getExpoPublicOpenAiKey();
  if (publicKey) {
    const direct = await fetchInsightViaOpenAiDirect(publicKey, instrument, scores);
    if (direct.status === "ready") {
      return direct;
    }
    const edge = await fetchInsightViaEdgeFunction(instrument, scores);
    if (edge.status === "ready") {
      return edge;
    }
    return direct.status === "error" ? direct : edge;
  }

  return fetchInsightViaEdgeFunction(instrument, scores);
}
