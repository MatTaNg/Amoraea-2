import { useCallback } from 'react';

import { runProcessUserSpeech } from '@features/aria/runProcessUserSpeech';
import type { ProcessUserSpeechDeps } from '@features/aria/processUserSpeechTypes';
import { runHandleRecordingError } from '@features/aria/runHandleRecordingError';
import type { HandleRecordingErrorDeps } from '@features/aria/handleRecordingErrorTypes';
import { runTranscribeSafe } from '@features/aria/runTranscribeSafe';
import type { TranscribeSafeDeps } from '@features/aria/transcribeSafeTypes';
import { runHandleSendTyped } from '@features/aria/runHandleSendTyped';
import type { HandleSendTypedDeps } from '@features/aria/handleSendTypedTypes';
import { runDeliverRecordingRetryLine } from '@features/aria/runDeliverRecordingRetryLine';
import type { DeliverRecordingRetryLineDeps } from '@features/aria/deliverRecordingRetryLineTypes';
import { runInterruptInterviewTtsForDocumentHidden } from '@features/aria/runInterruptInterviewTtsForDocumentHidden';
import type { InterruptInterviewTtsForDocumentHiddenDeps } from '@features/aria/interruptDocumentHiddenTtsTypes';
import { runEnsureValidSession } from '@features/aria/runEnsureValidSession';
import type { EnsureValidSessionDeps } from '@features/aria/runEnsureValidSession';
import { runSubmitPostInterviewFeedback } from '@features/aria/runSubmitPostInterviewFeedback';
import type { SubmitPostInterviewFeedbackDeps } from '@features/aria/submitPostInterviewFeedbackTypes';
import { runHandleWebResumeWelcomeTap } from '@features/aria/runHandleWebResumeWelcomeTap';
import type { WebResumeWelcomeTapDeps } from '@features/aria/webResumeWelcomeTapTypes';

export function useInterviewTurnProcessingCallbacks(deps: {
  processUserSpeechDepsRef: React.MutableRefObject<ProcessUserSpeechDeps>;
  handleRecordingErrorDepsRef: React.MutableRefObject<HandleRecordingErrorDeps>;
  transcribeSafeDepsRef: React.MutableRefObject<TranscribeSafeDeps>;
}) {
  const processUserSpeech = useCallback(
    async (spokenText: string) => {
      await runProcessUserSpeech(deps.processUserSpeechDepsRef.current, { spokenText });
    },
    [deps.processUserSpeechDepsRef],
  );

  const handleRecordingError = useCallback(
    (err: Error) => {
      runHandleRecordingError(deps.handleRecordingErrorDepsRef.current, err);
    },
    [deps.handleRecordingErrorDepsRef],
  );

  const transcribeSafe = useCallback(
    async (audioBlob: Blob | null, nativeUri: string | null) =>
      runTranscribeSafe(deps.transcribeSafeDepsRef.current, { audioBlob, nativeUri }),
    [deps.transcribeSafeDepsRef],
  );

  return { processUserSpeech, handleRecordingError, transcribeSafe };
}

export function useInterviewHandleSendTyped(
  depsRef: React.MutableRefObject<HandleSendTypedDeps>,
  typedAnswer: string,
) {
  return useCallback(() => {
    runHandleSendTyped(depsRef.current, { text: typedAnswer });
  }, [depsRef, typedAnswer]);
}

export function useDeliverRecordingRetryLine(depsRef: React.MutableRefObject<DeliverRecordingRetryLineDeps>) {
  return useCallback(
    async (
      message: string,
      speakOpts?: {
        telemetrySource?: 'turn' | 'other';
        skipLastQuestionRef?: boolean;
      },
    ): Promise<void> => {
      await runDeliverRecordingRetryLine(depsRef.current, { message, speakOpts });
    },
    [depsRef],
  );
}

export function useInterruptInterviewTtsForDocumentHidden(
  depsRef: React.MutableRefObject<InterruptInterviewTtsForDocumentHiddenDeps>,
) {
  return useCallback(() => {
    runInterruptInterviewTtsForDocumentHidden(depsRef.current);
  }, [depsRef]);
}

export function useEnsureValidSessionCallback(depsRef: React.MutableRefObject<EnsureValidSessionDeps>) {
  return useCallback(async () => {
    await runEnsureValidSession(depsRef.current);
  }, [depsRef]);
}

export function useSubmitPostInterviewFeedbackCallback(
  depsRef: React.MutableRefObject<SubmitPostInterviewFeedbackDeps>,
) {
  return useCallback(async () => {
    await runSubmitPostInterviewFeedback(depsRef.current);
  }, [depsRef]);
}

export function useHandleWebResumeWelcomeTap(depsRef: React.MutableRefObject<WebResumeWelcomeTapDeps>) {
  return useCallback(async () => {
    await runHandleWebResumeWelcomeTap(depsRef.current);
  }, [depsRef]);
}
