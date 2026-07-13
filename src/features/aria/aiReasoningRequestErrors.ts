export type AIReasoningRequestFailureKind = 'aborted' | 'network' | 'http' | 'parse' | 'unknown';

/** Set on the thrown `Error` when our per-attempt `AbortController` timer fired (vs browser-aborted request). */
export const AI_REASONING_LOCAL_TIMEOUT = '__aiReasoningLocalTimeout' as const;

export type AIReasoningErrorClassification = {
  kind: AIReasoningRequestFailureKind;
  message: string;
  name?: string;
  status?: number;
  isClientRequestTimeout: boolean;
  isBrowserLevelNetworkFailure: boolean;
};

const httpClassification = (status: number): AIReasoningErrorClassification => ({
  kind: 'http',
  message: `HTTP ${status}`,
  status,
  isClientRequestTimeout: false,
  isBrowserLevelNetworkFailure: false,
});

export function classifyAIReasoningRequestError(
  e: unknown,
  response: Response | null,
  opts?: { localTimerAbort?: boolean },
): AIReasoningErrorClassification {
  const markedLocal =
    e &&
    typeof e === 'object' &&
    (e as Record<string, unknown>)[AI_REASONING_LOCAL_TIMEOUT] === true;
  const isOurAbortTimer = opts?.localTimerAbort === true || markedLocal;

  if (response && !response.ok) {
    return httpClassification(response.status);
  }
  if (e && typeof e === 'object' && 'name' in e) {
    const n = (e as { name?: string }).name;
    if (n === 'AbortError') {
      if (isOurAbortTimer) {
        return {
          kind: 'aborted',
          name: n,
          message: (e as Error).message || 'Request aborted (client timeout)',
          isClientRequestTimeout: true,
          isBrowserLevelNetworkFailure: false,
        };
      }
      return {
        kind: 'aborted',
        name: n,
        message: (e as Error).message || 'Request aborted',
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: true,
      };
    }
  }
  if (e instanceof SyntaxError) {
    return {
      kind: 'parse',
      name: 'SyntaxError',
      message: e.message,
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: false,
    };
  }
  if (e instanceof TypeError) {
    return {
      kind: 'network',
      name: e.name,
      message: e.message || 'TypeError',
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: true,
    };
  }
  if (e instanceof Error) {
    const msg = e.message || '';
    if (/json|parse|undefined is not|unexpected token/i.test(msg)) {
      return {
        kind: 'parse',
        name: e.name,
        message: msg,
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: false,
      };
    }
    if (
      /^load failed$/i.test(msg.trim()) ||
      /failed to fetch|network request failed|networkerror|the network connection was lost|internet connection appears to be offline|load failed|could not connect/i.test(
        msg,
      )
    ) {
      return {
        kind: 'network',
        name: e.name,
        message: msg,
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: true,
      };
    }
    return {
      kind: 'unknown',
      name: e.name,
      message: msg,
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: false,
    };
  }
  return {
    kind: 'unknown',
    message: String(e),
    isClientRequestTimeout: false,
    isBrowserLevelNetworkFailure: false,
  };
}
