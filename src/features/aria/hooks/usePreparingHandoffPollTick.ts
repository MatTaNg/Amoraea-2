import { useEffect, useState } from 'react';

const PREPARING_HANDOFF_POLL_MS = 2000;

/** Re-check server on a short interval while "Preparing your results" is showing. */
export function usePreparingHandoffPollTick(interviewStatus: string): number {
  const [preparingHandoffPollTick, setPreparingHandoffPollTick] = useState(0);

  useEffect(() => {
    if (interviewStatus !== 'preparing_results') return;
    const id = setInterval(() => {
      setPreparingHandoffPollTick((n) => n + 1);
    }, PREPARING_HANDOFF_POLL_MS);
    return () => clearInterval(id);
  }, [interviewStatus]);

  return preparingHandoffPollTick;
}
