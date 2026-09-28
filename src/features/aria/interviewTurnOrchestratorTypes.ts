import type {
  InterviewCanonicalProbeId,
  InterviewFixedLineId,
} from '@features/aria/interviewCanonicalProbeRegistry';

/** High-level read on what the user is doing this turn. */
export type InterviewUserTurnIntent =
  | 'substantive_answer'
  | 'meta_question'
  | 'confusion_repeat'
  | 'skip_request'
  | 'go_back_request'
  | 'score_request'
  | 'off_topic'
  | 'unclear';

/** What the orchestrator wants the runtime to do (validator + TTS layer interprets). */
export type InterviewTurnAction =
  | {
      kind: 'delegate_claude';
      /** Optional hint appended to Claude system suffix (redirect, ack-only, etc.). */
      hint?: 'gentle_redirect' | 'answer_meta_then_continue' | 'check_before_ask';
    }
  | {
      kind: 'speak_canonical';
      probeId: InterviewCanonicalProbeId;
      /** Brief ack before verbatim probe (e.g. "Got it."). */
      withBriefAck?: boolean;
    }
  | {
      kind: 'speak_fixed_line';
      lineId: InterviewFixedLineId;
    }
  | {
      kind: 'skip_probe_already_satisfied';
      probeId: InterviewCanonicalProbeId;
      /** Next probe to consider, if known. */
      advanceToProbeId?: InterviewCanonicalProbeId;
    };

export type InterviewTurnOrchestratorDecision = {
  source: 'heuristic_v1' | 'llm_v1';
  userIntent: InterviewUserTurnIntent;
  /** Active assistant question the user was likely responding to. */
  activeQuestionPreview: string;
  /** Probes whose constructs appear satisfied in transcript + current turn. */
  satisfiedProbeIds: InterviewCanonicalProbeId[];
  /** Next scripted probe the interview still needs, if any. */
  pendingProbeId: InterviewCanonicalProbeId | null;
  /** Whether the user's latest turn substantively engaged the active construct. */
  activeConstructEngaged: boolean;
  action: InterviewTurnAction;
  reason: string;
};

export type InterviewTurnStateSnapshot = {
  currentInterviewMoment: number;
  currentScenario: number;
  lastAssistantContent: string;
  lastQuestionText: string;
  userText: string;
  transcriptTurnCount: number;
};
