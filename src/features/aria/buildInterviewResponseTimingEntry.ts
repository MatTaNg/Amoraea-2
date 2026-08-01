import { shouldRecordInterviewResponseTiming } from '@features/aria/interviewLanguageGate';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { resolveAssessableQuestionTextForResponseTiming } from '@features/aria/resolveAssessableQuestionTextForResponseTiming';
import type { InterviewResponseTimingEntry } from '@utilities/persistResponseTimingsIncremental';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export function buildInterviewResponseTimingEntry(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): InterviewResponseTimingEntry | null {
  const assessableQuestionText = resolveAssessableQuestionTextForResponseTiming(
    deps.lastQuestionTextRef.current,
  );
  if (!shouldRecordInterviewResponseTiming(assessableQuestionText)) {
    return null;
  }

  let latencyMs = 0;
  let durationMs = 0;
  const timing = deps.timingRef.current as {
    recordingStartTime?: number | null;
    recordingEndTime?: number | null;
    questionEndTime?: number | null;
  };
  if (timing.recordingStartTime != null) {
    timing.recordingEndTime = Date.now();
    const qEnd = timing.questionEndTime ?? timing.recordingStartTime;
    latencyMs = Math.max(0, timing.recordingStartTime - qEnd);
    durationMs = Math.max(
      0,
      (timing.recordingEndTime ?? Date.now()) - timing.recordingStartTime,
    );
    timing.recordingStartTime = null;
    timing.questionEndTime = null;
    timing.recordingEndTime = null;
  } else {
    const r = getSessionLogRuntime();
    const deliveredAt = r.lastQuestionDeliveredAt;
    if (deliveredAt) {
      const t = Date.parse(deliveredAt);
      if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
    }
    const audioDur = deps.lastUserTurnAudioDurationMsRef.current;
    if (typeof audioDur === 'number' && Number.isFinite(audioDur) && audioDur > 0) {
      durationMs = Math.round(audioDur);
    }
  }
  deps.lastUserTurnAudioDurationMsRef.current = null;
  deps.lastUserTurnMicStopTelemetryRef.current = null;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const momentNumForTiming = deps.currentInterviewMomentRef.current;
  const scenario =
    momentNumForTiming >= 4
      ? 3
      : (deps.currentScenarioRef.current ??
        getCurrentScenario(deps.scoredScenariosRef.current) ??
        null);

  return {
    question_id: `q_${deps.responseTimingsRef.current.length + 1}`,
    scenario: scenario ?? null,
    question_text: assessableQuestionText,
    latency_ms: latencyMs,
    duration_ms: durationMs,
    word_count: wordCount,
  };
}
