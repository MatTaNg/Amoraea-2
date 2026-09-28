import {
  INTERVIEW_CANONICAL_PROBES,
  type InterviewCanonicalProbeId,
  type InterviewFixedLineId,
} from '@features/aria/interviewCanonicalProbeRegistry';
import type {
  InterviewTurnAction,
  InterviewTurnOrchestratorDecision,
  InterviewUserTurnIntent,
} from '@features/aria/interviewTurnOrchestratorTypes';

const USER_INTENTS: InterviewUserTurnIntent[] = [
  'substantive_answer',
  'meta_question',
  'confusion_repeat',
  'skip_request',
  'go_back_request',
  'score_request',
  'off_topic',
  'unclear',
];

const DELEGATE_HINTS = new Set(['gentle_redirect', 'answer_meta_then_continue', 'check_before_ask']);

function isCanonicalProbeId(value: unknown): value is InterviewCanonicalProbeId {
  return typeof value === 'string' && value in INTERVIEW_CANONICAL_PROBES;
}

function isFixedLineId(value: unknown): value is InterviewFixedLineId {
  return value === 'score_decline' || value === 'go_back_decline';
}

function parseUserIntent(value: unknown): InterviewUserTurnIntent | null {
  if (typeof value !== 'string') return null;
  return USER_INTENTS.includes(value as InterviewUserTurnIntent)
    ? (value as InterviewUserTurnIntent)
    : null;
}

function parseProbeIdList(value: unknown): InterviewCanonicalProbeId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCanonicalProbeId);
}

function parseAction(raw: unknown): InterviewTurnAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const action = raw as Record<string, unknown>;
  const kind = action.kind;
  if (kind === 'delegate_claude') {
    const hint = action.hint;
    if (hint != null && (typeof hint !== 'string' || !DELEGATE_HINTS.has(hint))) {
      return null;
    }
    return {
      kind: 'delegate_claude',
      hint:
        hint === 'gentle_redirect' ||
        hint === 'answer_meta_then_continue' ||
        hint === 'check_before_ask'
          ? hint
          : undefined,
    };
  }
  if (kind === 'speak_canonical') {
    if (!isCanonicalProbeId(action.probeId)) return null;
    return {
      kind: 'speak_canonical',
      probeId: action.probeId,
      withBriefAck: action.withBriefAck === true ? true : undefined,
    };
  }
  if (kind === 'speak_fixed_line') {
    if (!isFixedLineId(action.lineId)) return null;
    return { kind: 'speak_fixed_line', lineId: action.lineId };
  }
  if (kind === 'skip_probe_already_satisfied') {
    if (!isCanonicalProbeId(action.probeId)) return null;
    const advanceToProbeId = isCanonicalProbeId(action.advanceToProbeId)
      ? action.advanceToProbeId
      : undefined;
    return {
      kind: 'skip_probe_already_satisfied',
      probeId: action.probeId,
      advanceToProbeId,
    };
  }
  return null;
}

export function parseInterviewTurnOrchestratorLlmJson(args: {
  raw: string;
  activeQuestionPreview: string;
}): InterviewTurnOrchestratorDecision | null {
  const trimmed = args.raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const userIntent = parseUserIntent(parsed.userIntent);
    const action = parseAction(parsed.action);
    if (!userIntent || !action) return null;

    const pendingProbeId =
      parsed.pendingProbeId == null
        ? null
        : isCanonicalProbeId(parsed.pendingProbeId)
          ? parsed.pendingProbeId
          : null;
    if (parsed.pendingProbeId != null && pendingProbeId == null) return null;

    return {
      source: 'llm_v1',
      userIntent,
      activeQuestionPreview: args.activeQuestionPreview,
      satisfiedProbeIds: parseProbeIdList(parsed.satisfiedProbeIds),
      pendingProbeId,
      activeConstructEngaged: parsed.activeConstructEngaged === true,
      action,
      reason: String(parsed.reason ?? '').slice(0, 240),
    };
  } catch {
    return null;
  }
}
