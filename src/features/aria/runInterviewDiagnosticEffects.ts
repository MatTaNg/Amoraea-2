import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type {
  AdminScoreCardRenderLogDeps,
  ElongatingProbeFromMessagesDeps,
  InterviewNetworkStatusCheckDeps,
  ReasoningProgressResetDeps,
  SyncCurrentMessagesRefDeps,
  TranscriptScenarioLogDeps,
} from '@features/aria/interviewDiagnosticEffectsTypes';

export function runSyncCurrentMessagesRef(
  deps: SyncCurrentMessagesRefDeps,
  messages: Array<{ role: string; content?: string }>,
): void {
  deps.currentMessagesRef.current = messages;
}

export function runSyncElongatingProbeFromMessages(
  deps: ElongatingProbeFromMessagesDeps,
  messages: Array<{ role: string; content?: string }>,
): void {
  const lastAsst = [...messages].reverse().find((m) => m.role === 'assistant');
  deps.elongatingProbeFiredRef.current = deps.isApprovedElongatingProbeOnly(lastAsst?.content ?? '');
}

export function runLogTranscriptScenarioAssignments(
  deps: TranscriptScenarioLogDeps,
  trigger: { userId: string | undefined; messages: MessageWithScenario[] },
): void {
  if (!trigger.userId) {
    deps.transcriptScenarioLogCursorRef.current = trigger.messages.length;
    return;
  }
  const start = deps.transcriptScenarioLogCursorRef.current;
  if (trigger.messages.length < start) {
    deps.transcriptScenarioLogCursorRef.current = trigger.messages.length;
    return;
  }
  if (trigger.messages.length === start) return;
  const appended = trigger.messages.slice(start);
  appended.forEach((m, i) => {
    if (m.role !== 'assistant' && m.role !== 'user') return;
    const msg = m as MessageWithScenario;
    const scenarioNumber =
      typeof msg.scenarioNumber === 'number' && [1, 2, 3].includes(msg.scenarioNumber)
        ? msg.scenarioNumber
        : null;
    const interviewMoment =
      typeof msg.interviewMoment === 'number'
        ? msg.interviewMoment
        : deps.currentInterviewMomentRef.current;
    const content = String(msg.content ?? '');
    const delivery_source =
      m.role === 'user'
        ? 'user_input'
        : (
              deps.isMoment5AssistantAnchor(content) ||
              deps.looksLikeMoment5AccountabilityProbeAssistantPrompt(content) ||
              deps.looksLikeMoment4ThresholdQuestion(content) ||
              deps.looksLikeMoment4SpecificityFollowUpPrompt(content) ||
              deps.looksLikeMoment4GrudgePrompt(content)
            )
          ? 'client_inject'
          : 'api_response';
    void deps.remoteLog('transcript_scenario_number_assigned', {
      turn_role: m.role,
      scenarioNumber,
      interviewMoment,
      delivery_source,
      transcript_index: start + i,
    });
  });
  deps.transcriptScenarioLogCursorRef.current = trigger.messages.length;
}

export function runLogAdminScoreCardRender(
  deps: AdminScoreCardRenderLogDeps,
  trigger: {
    isAdmin: boolean;
    messages: Array<{ role: string; content?: string }>;
    status: string;
    interviewStatus: string;
    userId: string | undefined;
  },
): void {
  if (!trigger.isAdmin) return;
  const scoreCardCount = trigger.messages.filter((m) => deps.messageLooksLikeScoreCard(m)).length;
  if (scoreCardCount === deps.lastAdminScoreCardCountRef.current) return;
  deps.lastAdminScoreCardCountRef.current = scoreCardCount;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[ADMIN_SCORECARD_RENDER]', {
      accountType: trigger.isAdmin ? 'admin' : 'regular',
      scoreCardCount,
      totalMessages: trigger.messages.length,
      renderConditionMet: trigger.isAdmin && scoreCardCount > 0,
      status: trigger.status,
      interviewStatus: trigger.interviewStatus,
    });
  }
  void deps.remoteLog('[ADMIN_SCORECARD_RENDER]', {
    accountType: trigger.isAdmin ? 'admin' : 'regular',
    scoreCardCount,
    totalMessages: trigger.messages.length,
    renderConditionMet: trigger.isAdmin && scoreCardCount > 0,
    status: trigger.status,
    interviewStatus: trigger.interviewStatus,
    userId: trigger.userId ?? null,
  });
}

export function runResetReasoningProgressOnNonScoringStatus(
  deps: ReasoningProgressResetDeps,
  status: string,
): void {
  if (status !== 'scoring') deps.setReasoningProgress(null);
}

export async function runCheckInterviewNetworkStatus(
  deps: InterviewNetworkStatusCheckDeps,
): Promise<void> {
  const supabaseUrl = deps.getResolvedSupabaseUrl();
  const anonKey = deps.getResolvedSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    deps.setNetworkStatus('poor');
    return;
  }
  try {
    const timeout = setTimeout(
      () => deps.setNetworkStatus((prev) => (prev === 'checking' ? 'poor' : prev)),
      4000,
    );
    const base = supabaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    clearTimeout(timeout);
    deps.setNetworkStatus(res.status < 500 ? 'good' : 'poor');
  } catch {
    deps.setNetworkStatus('poor');
  }
}
