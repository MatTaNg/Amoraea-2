import { prepareAIReasoningForPersistence } from './aiReasoningPostProcess';
import {
  AI_REASONING_LOCAL_TIMEOUT,
  classifyAIReasoningRequestError,
} from '@features/aria/aiReasoningRequestErrors';
import {
  buildAnthropicMessagesHeaders,
  getAnthropicEndpoint,
  isAnthropicProxyEndpoint,
  SUPABASE_ANON_KEY,
} from '@features/aria/anthropicClientConfig';
import {
  DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type AIReasoningResult,
  type GenerateAIReasoningOptions,
} from '@features/aria/aiReasoningUserPrompt';
import {
  buildStructuralRetryUserPromptAddon,
  logStructuralValidationOutcome,
  validateAiReasoningStructuralEnforcement,
} from '@features/reports/reportNarrativeStructuralEnforcement';
import {
  compactTranscriptForNarrativePrompt,
  isWorkerResourceLimitError,
  shouldAutoCompactTranscriptForNarrative,
} from '@features/aria/narrativeTranscriptCompaction';
import {
  logNarrativeGenerationOutcome,
  REPORT_NARRATIVE_TOKEN_BUDGETS,
  anthropicStoppedDueToMaxTokens,
} from '@utilities/reportNarrativeGeneration';
import {
  buildAiReasoningEvidenceInventory,
  logLiveNarrativePrompt,
  logNarrativeEvidenceAudit,
} from '@features/reports/narrativeEvidenceAudit';
import { CLAUDE_SONNET_MODEL, resolveAnthropicSonnetModel } from '@utilities/anthropicMessagesClient';
export async function generateAIReasoning(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[] = [],
  options?: GenerateAIReasoningOptions
): Promise<AIReasoningResult> {
  console.log('[ReasoningScore] sending authoritative scores to model:', {
    weightedScore,
    pillarScores,
    passed,
  });

  const apiUrl = getAnthropicEndpoint();
  if (isAnthropicProxyEndpoint(apiUrl) && !SUPABASE_ANON_KEY?.trim()) {
    throw new Error(
      'AI reasoning via anthropic-proxy requires EXPO_PUBLIC_SUPABASE_ANON_KEY in the client bundle (missing). Rebuild the admin app with env vars set.',
    );
  }
  const headers = buildAnthropicMessagesHeaders({ apiUrl, includeProxyApiKey: true });

  let useCompactTranscript =
    options?.compactTranscript === true || shouldAutoCompactTranscriptForNarrative(transcript);

  const aiReasoningBudgets = REPORT_NARRATIVE_TOKEN_BUDGETS.ai_reasoning;
  let maxTokensForCall = aiReasoningBudgets.initial;
  let retriedHigherBudget = false;

  /** One fetch attempt should not block indefinitely; proxies can hang without closing the socket. */
  const REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS =
    options?.perAttemptTimeoutMs ?? DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS;
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastErr: Error | null = null;
  let response: Response | null = null;
  let responseText: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) useCompactTranscript = true;
    const narrativeTranscript = useCompactTranscript
      ? compactTranscriptForNarrativePrompt(transcript)
      : transcript;
    const userPrompt = buildUserPrompt(
      pillarScores,
      scenarioScores,
      narrativeTranscript,
      weightedScore,
      passed,
      unassessedMarkers,
      options?.evidenceContext,
      useCompactTranscript,
    );

    if (attempt === 0) {
      logNarrativeEvidenceAudit(
        buildAiReasoningEvidenceInventory(scenarioScores, pillarScores, options?.evidenceContext),
      );
      logLiveNarrativePrompt('ai_reasoning', SYSTEM_PROMPT, userPrompt);
    }

    const body: Record<string, unknown> = {
      model: resolveAnthropicSonnetModel(CLAUDE_SONNET_MODEL),
      max_tokens: maxTokensForCall,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    };

    let ourAbortTimerFired = false;
    const abort = new AbortController();
    const abortTimer = setTimeout(() => {
      ourAbortTimerFired = true;
      abort.abort();
    }, REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS);
    try {
      if (attempt > 0) {
        const backoffMs = Math.min(30_000, 1000 * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, backoffMs));
      }
      response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        clearTimeout(abortTimer);
        const resourceLimit = isWorkerResourceLimitError(response.status, errText);
        const meta = classifyAIReasoningRequestError(new Error(`HTTP ${response.status} ${errText}`), response);
        lastErr = new Error(
          `AI reasoning request failed: [${meta.kind}] ${response.status} ${errText.slice(0, 500)}`
        );
        if (resourceLimit) {
          useCompactTranscript = true;
          continue;
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw lastErr;
        }
        continue;
      }
      responseText = await response.text();
      clearTimeout(abortTimer);
      break;
    } catch (e) {
      clearTimeout(abortTimer);
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (ourAbortTimerFired && lastErr.name === 'AbortError') {
        Object.defineProperty(lastErr, AI_REASONING_LOCAL_TIMEOUT, { value: true, enumerable: true });
      }
      if (lastErr.name === 'AbortError' || /aborted/i.test(lastErr.message)) {
        console.error('[Reasoning] AbortError detected:', lastErr.message);
        console.error('[Reasoning] content present at abort:', responseText != null && responseText.length > 0);
        console.error(
          '[Reasoning] abort occurred at stage:',
          responseText != null && responseText.length > 0 ? 'post-response' : 'fetch'
        );
      }
      if (attempt === maxAttempts - 1) throw lastErr;
    }
  }

  if (!response?.ok || responseText == null) {
    throw lastErr ?? new Error('AI reasoning request failed after retries');
  }

  type AnthropicEnvelope = {
    content?: Array<{ text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  let envelope = JSON.parse(responseText) as AnthropicEnvelope;

  if (anthropicStoppedDueToMaxTokens(envelope.stop_reason)) {
    console.warn(
      `[Reasoning] stop_reason=max_tokens at ${maxTokensForCall} — retrying with ${aiReasoningBudgets.retry}`,
    );
    retriedHigherBudget = true;
    maxTokensForCall = aiReasoningBudgets.retry;
    const retryBody = { ...body, max_tokens: maxTokensForCall };
    const retryAbort = new AbortController();
    const retryTimer = setTimeout(() => retryAbort.abort(), REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS);
    try {
      const retryResponse = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(retryBody),
        signal: retryAbort.signal,
      });
      const retryText = await retryResponse.text();
      clearTimeout(retryTimer);
      if (!retryResponse.ok) {
        throw new Error(`AI reasoning max_tokens retry failed: HTTP ${retryResponse.status}`);
      }
      responseText = retryText;
      envelope = JSON.parse(retryText) as AnthropicEnvelope;
    } catch (retryErr) {
      clearTimeout(retryTimer);
      console.error('[Reasoning] max_tokens retry failed:', retryErr);
    }
  }

  logNarrativeGenerationOutcome({
    pipeline: 'ai_reasoning',
    provider: 'anthropic',
    maxTokensRequested: maxTokensForCall,
    inputTokens: envelope.usage?.input_tokens ?? null,
    outputTokens: envelope.usage?.output_tokens ?? null,
    stopReason: envelope.stop_reason ?? null,
    narrativeTruncatedDueToMaxTokens: anthropicStoppedDueToMaxTokens(envelope.stop_reason),
    retriedWithHigherBudget: retriedHigherBudget,
    textLength: (envelope.content?.[0]?.text ?? '').length,
  });

  let text: string;
  let parsed: AIReasoningResult;
  try {
    text = (envelope.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
    parsed = JSON.parse(text) as AIReasoningResult;
  } catch (e) {
    const meta = classifyAIReasoningRequestError(e, null);
    throw new Error(
      `AI reasoning: failed to parse model JSON [${meta.kind}] ${e instanceof Error ? e.message : String(e)}`
    );
  }

  let structuralValidation = validateAiReasoningStructuralEnforcement(
    parsed as unknown as Record<string, unknown>,
  );
  logStructuralValidationOutcome('ai_reasoning', structuralValidation, false);

  if (!structuralValidation.ok) {
    const retryUserPrompt = userPrompt + buildStructuralRetryUserPromptAddon(structuralValidation.issues);
    body.messages = [{ role: 'user', content: retryUserPrompt }];
    console.warn('[NarrativeStructural] ai_reasoning: retrying once after structural validation failure');
    const retryAbort = new AbortController();
    const retryTimer = setTimeout(() => retryAbort.abort(), REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS);
    try {
      const retryResponse = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: retryAbort.signal,
      });
      const retryText = await retryResponse.text();
      clearTimeout(retryTimer);
      if (!retryResponse.ok) {
        throw new Error(`AI reasoning structural retry failed: HTTP ${retryResponse.status}`);
      }
      const retryEnvelope = JSON.parse(retryText) as AnthropicEnvelope;
      text = (retryEnvelope.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
      parsed = JSON.parse(text) as AIReasoningResult;
      structuralValidation = validateAiReasoningStructuralEnforcement(
        parsed as unknown as Record<string, unknown>,
      );
      logStructuralValidationOutcome('ai_reasoning', structuralValidation, true);
    } catch (structuralRetryErr) {
      clearTimeout(retryTimer);
      console.error('[NarrativeStructural] ai_reasoning structural retry failed:', structuralRetryErr);
    }
  }

  logNarrativeEvidenceAudit(
    buildAiReasoningEvidenceInventory(scenarioScores, pillarScores, options?.evidenceContext),
    {
      ...(parsed._narrative_evidence_map ?? {}),
      scenario_personal_pattern_crossref: parsed.scenario_personal_pattern_crossref ?? null,
      psychometric_integration:
        parsed.psychometric_integration ?? parsed.psychometric_integration_notes ?? null,
    },
  );

  const breakdown = parsed.construct_breakdown ?? {};
  Object.entries(breakdown).forEach(([, construct]) => {
    const score = construct?.score;
    const struggled = (construct?.where_you_struggled ?? '').trim();
    if (
      typeof score === 'number' &&
      score >= 8 &&
      struggled &&
      !/^potential growth edge/i.test(struggled) &&
      !/^no clear struggle pattern observed/i.test(struggled)
    ) {
      construct.where_you_struggled = `Potential growth edge (not a demonstrated struggle in this interview): ${struggled}`;
    }
  });
  const noEvidenceConstructTemplate = {
    headline: 'Not directly assessed in this interview',
    summary:
      'This marker did not surface with enough direct evidence in the scored moments, so this interview cannot support a confident interpretation for it.',
    what_you_did_well: 'No direct evidence available.',
    where_you_struggled: 'No direct evidence available.',
    key_pattern: 'Insufficient direct data in this interview.',
    nuance_and_context:
      'A low or missing value here reflects missing evidence, not a demonstrated deficit.',
    growth_edge:
      'If you want this area evaluated, it would need additional prompts that directly test this construct.',
  };
  const regulationNoEvidenceTemplate = {
    headline: 'Not directly assessed in this interview',
    summary:
      'Emotional regulation did not surface with enough direct evidence in the scored interview moments, so detailed interpretation is not supported here.',
    what_you_did_well: '',
    where_you_struggled: '',
    key_pattern: '',
    nuance_and_context: '',
    growth_edge: '',
  };
  unassessedMarkers.forEach((id) => {
    if (!parsed.construct_breakdown) parsed.construct_breakdown = {};
    const existing = parsed.construct_breakdown[id] ?? {};
    if (id === 'regulation') {
      parsed.construct_breakdown[id] = {
        ...existing,
        score: existing.score,
        ...regulationNoEvidenceTemplate,
      };
      return;
    }
    parsed.construct_breakdown[id] = {
      ...existing,
      score: existing.score,
      ...noEvidenceConstructTemplate,
    };
  });

  return prepareAIReasoningForPersistence(
    parsed,
    pillarScores,
    unassessedMarkers,
    weightedScore,
  ) as unknown as AIReasoningResult;
}
