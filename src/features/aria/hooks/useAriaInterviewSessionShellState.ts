import { useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

import { type ActiveScenario } from '@app/screens/UserInterviewLayout';
import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import { useAriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

import type { AriaInterviewScreenSessionShellState, InterviewUiPhase, ReasoningProgress } from './ariaInterviewScreenSessionStateTypes';

export type UseAriaInterviewSessionShellStateParams = {
  status: InterviewSessionStatus;
  setMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string; scenarioNumber?: number }[]>>;
};

export function useAriaInterviewSessionShellState(
  params: UseAriaInterviewSessionShellStateParams,
): AriaInterviewScreenSessionShellState {
  const { status, setMessages } = params;

  const [touchedConstructs, setTouchedConstructs] = useState<number[]>([]);
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [stageResults, setStageResults] = useState<Array<{ stage: number; results: InterviewResults }>>([]);
  const [preInterviewConsentAge, setPreInterviewConsentAge] = useState(false);
  const [preInterviewConsentData, setPreInterviewConsentData] = useState(false);
  const [interviewAttemptBootstrap, setInterviewAttemptBootstrap] = useState<
    'idle' | 'loading' | 'ready' | 'failed'
  >('idle');
  const [typedAnswer, setTypedAnswer] = useState('');
  const scoredScenariosRef = useRef<Set<number>>(new Set());
  const [scenarioScores, setScenarioScores] = useState<Record<number, ScenarioScoreResult>>({});
  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [emotionModalItemIndex, setEmotionModalItemIndex] = useState(0);
  const [emotionItemResponses, setEmotionItemResponses] = useState<string[]>([]);
  const [emotionItemsComplete, setEmotionItemsComplete] = useState(false);
  const emotionModalOpenForIndexRef = useRef(0);
  const maybeAwaitEmotionAfterScenarioTransitionRef = useRef<(sn: 1 | 2 | 3) => Promise<void>>(async () => {});
  const runEmotionModalAfterScenarioTransitionRef = useRef<
    (
      scenarioNum: 1 | 2 | 3,
      opts?: { transitionText?: string; priorScenario?: 1 | 2 | 3 | null },
    ) => Promise<void>
  >(async () => {});
  const resumeEmotionCatchUpIndicesRef = useRef<number[] | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<
    'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'
  >('loading');
  const [analysisAttemptId, setAnalysisAttemptId] = useState<string | null>(null);
  const [pendingScoringSyncAttemptId, setPendingScoringSyncAttemptId] = useState<string | null>(null);
  const isInterviewCompleteRef = useRef(false);
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const pendingCompletionTranscriptRef = useRef<
    { role: string; content: string; interviewMoment?: number; scenarioNumber?: number }[] | null
  >(null);
  const [standardResultsReferralCode, setStandardResultsReferralCode] = useState<string | null>(null);
  const [standardResultsReferralCopyFeedback, setStandardResultsReferralCopyFeedback] = useState(false);
  const committedScenarioRef = useRef<ActiveScenario | null>(null);
  const [interviewUiPhase, setInterviewUiPhase] = useState<InterviewUiPhase>('pre_scenario');
  const [referenceCardScenario, setReferenceCardScenario] = useState<ActiveScenario | null>(null);
  const [referenceCardPrompt, setReferenceCardPrompt] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const hasResumedRef = useRef(false);
  const interviewUserTurnEpochRef = useRef(0);
  const timingRef = useRef<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>({ questionEndTime: null, recordingStartTime: null, recordingEndTime: null });
  const lastQuestionTextRef = useRef('');
  const probeLogRef = useRef<
    Array<{
      scenario: number;
      construct: string;
      probe_fired: boolean;
      trigger_reason: string | null;
      pre_probe_score: number;
      post_probe_score: number;
      score_delta: number;
    }>
  >([]);
  const scenarioScoresRef = useRef<Record<number, ScenarioScoreResult>>({});
  const scoreScenarioRef = useRef<
    ((scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>) | null
  >(null);
  const currentScenarioRef = useRef<1 | 2 | 3>(1);
  const transcriptionFailureStreakRef = useRef(0);
  const recordingCompleteInFlightRef = useRef(false);
  const lastRecordingRetryDeliveredNormRef = useRef<string | null>(null);
  const lastRecordingRetryDeliveredAtMsRef = useRef(0);
  const waitingMessageIdRef = useRef<string | null>(null);
  const interviewSessionAttemptIdRef = useRef<string | null>(null);
  const recordingJustFinishedBeforeNextTtsRef = useRef(false);
  const postRecordingParallelStreamSettleRef = useRef(false);
  const recordingPeakMeteringRef = useRef<number | null>(null);
  const lastRecordingVadSpeechDetectedRef = useRef<boolean | null>(null);
  const transcribeBufferMetaRef = useRef<{ audio_duration_ms: number; buffer_size_bytes: number } | null>(null);
  const recordingDelayMeasurementRef = useRef<preamble.RecordingDelayMeasurement | null>(null);
  const [sessionAudioHealthNotice, setSessionAudioHealthNotice] = useState<string | null>(null);
  const [ttsPlaybackReliabilityNotice, setTtsPlaybackReliabilityNotice] = useState<string | null>(null);
  const [conversationErrorNotice, setConversationErrorNotice] = useState<string | null>(null);
  const ttsLineInFlightRef = useRef(false);
  const tabHiddenDuringActiveTtsLineRef = useRef(false);
  const handleWebTabGestureRestoreTapRef = useRef<() => void>(() => {});
  const speakingWithoutPlaybackSinceMsRef = useRef<number | null>(null);
  const staleWebTtsRuntimeLockSinceMsRef = useRef<number | null>(null);
  const mobileTabHideLetPlaybackContinueRef = useRef(false);
  const mobileTabHideBackgroundUtteranceRef = useRef<string | null>(null);
  const lastVoiceTurnLanguageRef = useRef<string | null>(null);
  const lastVoiceTurnConfidenceRef = useRef<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');
  const [webResumeWelcomeTapPending, setWebResumeWelcomeTapPending] = useState(false);

  const statusRef = useRef(status);
  statusRef.current = status;
  const interviewStatusRef = useRef(interviewStatus);
  interviewStatusRef.current = interviewStatus;

  const [sessionExpired, setSessionExpired] = useState(false);
  const [usingMemoryFallback, setUsingMemoryFallback] = useState(false);
  const [reasoningProgress, setReasoningProgress] = useState<ReasoningProgress>(null);
  const [usedPersonalExamples, setUsedPersonalExamples] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const postInterviewFeedback = useAriaPostInterviewFeedbackState();
  const lastAdminScoreCardCountRef = useRef(0);

  return {
    touchedConstructs,
    setTouchedConstructs,
    results,
    setResults,
    stageResults,
    setStageResults,
    preInterviewConsentAge,
    setPreInterviewConsentAge,
    preInterviewConsentData,
    setPreInterviewConsentData,
    interviewAttemptBootstrap,
    setInterviewAttemptBootstrap,
    typedAnswer,
    setTypedAnswer,
    scoredScenariosRef,
    scenarioScores,
    setScenarioScores,
    emotionModalVisible,
    setEmotionModalVisible,
    emotionModalItemIndex,
    setEmotionModalItemIndex,
    emotionItemResponses,
    setEmotionItemResponses,
    emotionItemsComplete,
    setEmotionItemsComplete,
    emotionModalOpenForIndexRef,
    maybeAwaitEmotionAfterScenarioTransitionRef,
    runEmotionModalAfterScenarioTransitionRef,
    resumeEmotionCatchUpIndicesRef,
    isAdmin,
    setIsAdmin,
    userEmail,
    setUserEmail,
    interviewStatus,
    setInterviewStatus,
    analysisAttemptId,
    setAnalysisAttemptId,
    pendingScoringSyncAttemptId,
    setPendingScoringSyncAttemptId,
    isInterviewCompleteRef,
    pendingCompletion,
    setPendingCompletion,
    pendingCompletionTranscriptRef,
    standardResultsReferralCode,
    setStandardResultsReferralCode,
    standardResultsReferralCopyFeedback,
    setStandardResultsReferralCopyFeedback,
    committedScenarioRef,
    interviewUiPhase,
    setInterviewUiPhase,
    referenceCardScenario,
    setReferenceCardScenario,
    referenceCardPrompt,
    setReferenceCardPrompt,
    scrollViewRef,
    hasResumedRef,
    interviewUserTurnEpochRef,
    timingRef,
    lastQuestionTextRef,
    probeLogRef,
    scenarioScoresRef,
    scoreScenarioRef,
    currentScenarioRef,
    transcriptionFailureStreakRef,
    recordingCompleteInFlightRef,
    lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef,
    waitingMessageIdRef,
    interviewSessionAttemptIdRef,
    recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef,
    recordingPeakMeteringRef,
    lastRecordingVadSpeechDetectedRef,
    transcribeBufferMetaRef,
    recordingDelayMeasurementRef,
    sessionAudioHealthNotice,
    setSessionAudioHealthNotice,
    ttsPlaybackReliabilityNotice,
    setTtsPlaybackReliabilityNotice,
    conversationErrorNotice,
    setConversationErrorNotice,
    ttsLineInFlightRef,
    tabHiddenDuringActiveTtsLineRef,
    handleWebTabGestureRestoreTapRef,
    speakingWithoutPlaybackSinceMsRef,
    staleWebTtsRuntimeLockSinceMsRef,
    mobileTabHideLetPlaybackContinueRef,
    mobileTabHideBackgroundUtteranceRef,
    lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef,
    networkStatus,
    setNetworkStatus,
    webResumeWelcomeTapPending,
    setWebResumeWelcomeTapPending,
    commitInterviewMessages: setMessages,
    statusRef,
    interviewStatusRef,
    sessionExpired,
    setSessionExpired,
    usingMemoryFallback,
    setUsingMemoryFallback,
    reasoningProgress,
    setReasoningProgress,
    usedPersonalExamples,
    setUsedPersonalExamples,
    isWaiting,
    setIsWaiting,
    showAdminPanel,
    setShowAdminPanel,
    postInterviewFeedback,
    lastAdminScoreCardCountRef,
  };
}
