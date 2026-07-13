import { isApprovedElongatingProbeOnly } from '@features/aria/elongatingProbe';
import type { TranscriptTurn } from '@features/aria/interviewTranscriptTurns';
import { appendAssistantTurnMergingConcurrentUsers } from '@features/aria/interviewTranscriptTurns';
import {
  looksLikeScenarioARepairQuestionLoose,
  scenarioFollowUpAlreadyInTranscript,
  transcriptContainsScenarioAContemptProbe,
  transcriptContainsScenarioARepairQuestion,
  transcriptContainsScenarioBAppreciationProbe,
  transcriptContainsScenarioBJamesDifferentlyProbe,
  transcriptContainsScenarioBRepairAsJamesQuestion,
  transcriptContainsScenarioCRepairQuestion,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  looksLikeScenarioAContemptProbeQuestion,
} from '@features/aria/scenarioAContemptProbeTextMatch';
import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  isScenarioBQ1Prompt,
  looksLikeScenarioBQ1Question,
} from '@features/aria/scenarioBProbeLogic';
import {
  looksLikeScenarioBFullAppreciationProbeQuestion,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  isScenarioCRepairAssistantPrompt,
  isScenarioCQ1Prompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  transcriptContainsScenarioCQ1Prompt,
} from '@features/aria/scenarioCPromptDetection';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';

export type ScriptedFollowUpKind =
  | 's1_contempt'
  | 's1_repair'
  | 's2_q1'
  | 's2_appreciation'
  | 's2_james_differently'
  | 's2_james_repair'
  | 's3_q1_daniel'
  | 's3_repair'
  | 's3_sophie_perspective';

function normalizeTranscriptCompare(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function lastPersistableAssistantTurn(
  transcript: readonly TranscriptTurn[],
): TranscriptTurn | null {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const m = transcript[i];
    if (m?.role !== 'assistant') continue;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    if ((m as { isScoreCard?: boolean }).isScoreCard) continue;
    return m;
  }
  return null;
}

/** Classify scripted construct-probe / follow-up questions for dedup. */
export function classifyScriptedFollowUpKind(text: string): ScriptedFollowUpKind | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  if (looksLikeScenarioAContemptProbeQuestion(t)) return 's1_contempt';
  if (looksLikeScenarioARepairQuestion(t) || looksLikeScenarioARepairQuestionLoose(t)) return 's1_repair';
  if (isScenarioBQ1Prompt(t) || looksLikeScenarioBQ1Question(t)) return 's2_q1';
  if (looksLikeScenarioBFullAppreciationProbeQuestion(t)) return 's2_appreciation';
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return 's2_james_differently';
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) return 's2_james_repair';
  if (isScenarioCQ1Prompt(t)) return 's3_q1_daniel';
  if (isScenarioCRepairAssistantPrompt(t)) return 's3_repair';
  if (
    looksLikeScenarioCSophiePerspectiveQuestion(t) ||
    normalizeTranscriptCompare(t) === normalizeTranscriptCompare(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)
  ) {
    return 's3_sophie_perspective';
  }
  return null;
}

function transcriptContainsFollowUpKind(
  transcript: readonly TranscriptTurn[],
  kind: ScriptedFollowUpKind,
): boolean {
  switch (kind) {
    case 's1_contempt':
      return transcriptContainsScenarioAContemptProbe(transcript);
    case 's1_repair':
      return transcriptContainsScenarioARepairQuestion(transcript);
    case 's2_q1':
      return transcript.some(
        (m) =>
          m.role === 'assistant' &&
          (isScenarioBQ1Prompt((m as { content?: string }).content ?? '') ||
            looksLikeScenarioBQ1Question((m as { content?: string }).content ?? '')),
      );
    case 's2_appreciation':
      return transcriptContainsScenarioBAppreciationProbe(transcript);
    case 's2_james_differently':
      return transcriptContainsScenarioBJamesDifferentlyProbe(transcript);
    case 's2_james_repair':
      return transcriptContainsScenarioBRepairAsJamesQuestion(transcript);
    case 's3_q1_daniel':
      return transcriptContainsScenarioCQ1Prompt(transcript);
    case 's3_repair':
      return transcriptContainsScenarioCRepairQuestion(transcript);
    case 's3_sophie_perspective':
      return transcript.some(
        (m) =>
          m.role === 'assistant' &&
          looksLikeScenarioCSophiePerspectiveQuestion((m as { content?: string }).content ?? ''),
      );
    default:
      return false;
  }
}

/**
 * Assistant rows staged on `messagesToUse` during post-Claude bootstrap (stream recovery)
 * that are not yet in the live transcript ref.
 */
export function resolveStagedAssistantPersistContent(
  liveTranscript: readonly TranscriptTurn[],
  messagesToUse: readonly TranscriptTurn[],
  displayText: string,
): string {
  const staged = messagesToUse.slice(liveTranscript.length);
  const stagedAssistant = staged.find(
    (m) => m.role === 'assistant' && String(m.content ?? '').trim().length > 0,
  );
  if (stagedAssistant?.content?.trim()) {
    return stagedAssistant.content.trim();
  }
  return displayText;
}

/**
 * Skip a second assistant row when the same scripted follow-up was already persisted
 * (canonical inject + model paraphrase, or stream bootstrap + persist).
 */
export function shouldSkipRedundantAssistantPersist(
  liveTranscript: readonly TranscriptTurn[],
  displayText: string,
): boolean {
  const trimmed = (displayText ?? '').trim();
  if (!trimmed) return true;
  if (scenarioFollowUpAlreadyInTranscript(liveTranscript, trimmed)) {
    return true;
  }

  const nextKind = classifyScriptedFollowUpKind(trimmed);
  if (nextKind && transcriptContainsFollowUpKind(liveTranscript, nextKind)) {
    return true;
  }

  const lastAssistant = lastPersistableAssistantTurn(liveTranscript);
  const lastContent = String(lastAssistant?.content ?? '').trim();
  if (!lastContent) return false;

  const lastKind = classifyScriptedFollowUpKind(lastContent);
  if (lastKind && nextKind && lastKind === nextKind) {
    return true;
  }

  if (lastKind && transcriptContainsFollowUpKind(liveTranscript, lastKind) && nextKind === lastKind) {
    return true;
  }

  if (lastKind && !nextKind && isApprovedElongatingProbeOnly(trimmed)) {
    return true;
  }

  if (
    lastContent &&
    trimmed.includes('?') &&
    classifyScriptedFollowUpKind(lastContent) &&
    tokenOverlapRatio(lastContent, trimmed) >= 0.3
  ) {
    return true;
  }

  if (
    lastContent &&
    lastContent.includes('?') &&
    trimmed.includes('?') &&
    tokenOverlapRatio(lastContent, trimmed) >= 0.28 &&
    (lastKind || nextKind)
  ) {
    return true;
  }

  return false;
}

function tokenOverlapRatio(a: string, b: string): number {
  const wordsA = normalizeTranscriptCompare(a).split(/\s+/).filter(Boolean);
  const wordsB = new Set(normalizeTranscriptCompare(b).split(/\s+/).filter(Boolean));
  if (wordsA.length === 0 || wordsB.size === 0) return 0;
  const overlap = wordsA.filter((w) => wordsB.has(w)).length;
  return overlap / Math.max(wordsA.length, wordsB.size);
}

/**
 * When ASR emits two user rows for one spoken answer (whisper re-ask residue or concurrent commit),
 * replace the prior row instead of appending another duplicate.
 */
export function shouldReplaceLastUserTurnWithRefinedTranscript(
  priorUserContent: string | null | undefined,
  nextUserContent: string,
): boolean {
  const prior = String(priorUserContent ?? '').trim();
  const next = String(nextUserContent ?? '').trim();
  if (!prior || !next) return false;
  if (normalizeTranscriptCompare(prior) === normalizeTranscriptCompare(next)) return true;
  const priorWords = prior.split(/\s+/).filter(Boolean).length;
  const nextWords = next.split(/\s+/).filter(Boolean).length;
  if (priorWords < 4 || nextWords < 4) return false;
  return tokenOverlapRatio(prior, next) >= 0.55;
}

export type AssistantTranscriptUpsertAction = 'skip' | 'append' | 'replace';

/**
 * Idempotent assistant persist: skip duplicate follow-ups, upgrade paraphrase rows to canonical copy in-place.
 */
export function upsertAssistantTranscriptTurn<T extends TranscriptTurn>(
  liveTranscript: T[],
  turnSnapshot: T[],
  content: string,
  metadata: Partial<T> = {},
): { transcript: T[]; action: AssistantTranscriptUpsertAction } {
  const trimmed = (content ?? '').trim();
  if (!trimmed) {
    return { transcript: liveTranscript, action: 'skip' };
  }

  if (shouldSkipRedundantAssistantPersist(liveTranscript, trimmed)) {
    const lastAssistant = lastPersistableAssistantTurn(liveTranscript);
    const lastContent = String(lastAssistant?.content ?? '').trim();
    const lastKind = lastContent ? classifyScriptedFollowUpKind(lastContent) : null;
    const nextKind = classifyScriptedFollowUpKind(trimmed);
    if (
      lastAssistant &&
      lastKind &&
      nextKind &&
      lastKind === nextKind &&
      normalizeTranscriptCompare(lastContent) !== normalizeTranscriptCompare(trimmed)
    ) {
      const idx = liveTranscript.lastIndexOf(lastAssistant);
      if (idx >= 0) {
        const transcript = [...liveTranscript];
        transcript[idx] = { ...lastAssistant, content: trimmed, ...metadata } as T;
        return { transcript, action: 'replace' };
      }
    }
    if (nextKind) {
      for (let i = liveTranscript.length - 1; i >= 0; i--) {
        const row = liveTranscript[i];
        if (row?.role !== 'assistant') continue;
        const rowContent = String(row.content ?? '').trim();
        if (!rowContent || classifyScriptedFollowUpKind(rowContent) !== nextKind) continue;
        if (normalizeTranscriptCompare(rowContent) === normalizeTranscriptCompare(trimmed)) {
          return { transcript: liveTranscript, action: 'skip' };
        }
        const transcript = [...liveTranscript];
        transcript[i] = { ...row, content: trimmed, ...metadata } as T;
        return { transcript, action: 'replace' };
      }
    }
    return { transcript: liveTranscript, action: 'skip' };
  }

  return {
    transcript: appendAssistantTurnMergingConcurrentUsers(
      liveTranscript,
      turnSnapshot,
      trimmed,
      metadata,
    ),
    action: 'append',
  };
}

/**
 * Collapse duplicate back-to-back transcript rows (ASR residue users, canonical+paraphrase assistants).
 * Safe to run before persist, after commit, and at interview close before scoring.
 */
export function compactInterviewTranscriptTurns<T extends TranscriptTurn>(
  transcript: readonly T[],
): T[] {
  const out: T[] = [];
  for (const row of transcript) {
    if (row.role === 'user') {
      const content = String(row.content ?? '').trim();
      if (!content) continue;
      const last = out[out.length - 1];
      if (
        last?.role === 'user' &&
        shouldReplaceLastUserTurnWithRefinedTranscript(
          (last as { content?: string }).content,
          content,
        )
      ) {
        out[out.length - 1] = { ...last, ...row, content } as T;
        continue;
      }
      out.push(row);
      continue;
    }
    if (row.role === 'assistant') {
      const content = String(row.content ?? '').trim();
      if (!content) continue;
      if (shouldSkipRedundantAssistantPersist(out, content)) {
        const lastAssistant = lastPersistableAssistantTurn(out);
        if (lastAssistant) {
          const idx = out.lastIndexOf(lastAssistant);
          const lastKind = classifyScriptedFollowUpKind(String(lastAssistant.content ?? ''));
          const nextKind = classifyScriptedFollowUpKind(content);
          if (
            idx >= 0 &&
            lastKind &&
            nextKind &&
            lastKind === nextKind &&
            normalizeTranscriptCompare(lastAssistant.content ?? '') !==
              normalizeTranscriptCompare(content)
          ) {
            out[idx] = { ...lastAssistant, ...row, content } as T;
          }
        }
        continue;
      }
      out.push(row);
      continue;
    }
    out.push(row);
  }
  return out;
}

/** Commit one assistant row through transcript dedup (forced probes, disengagement injects). */
export function commitDedupedAssistantTranscriptTurn<T extends TranscriptTurn>(
  liveTranscript: T[],
  turnSnapshot: T[],
  content: string,
  metadata: Partial<T>,
  commit: (next: T[]) => void,
): T[] {
  const { transcript, action } = upsertAssistantTranscriptTurn(
    liveTranscript,
    turnSnapshot,
    content,
    metadata,
  );
  if (action === 'skip') {
    return transcript;
  }
  commit(transcript);
  return transcript;
}
