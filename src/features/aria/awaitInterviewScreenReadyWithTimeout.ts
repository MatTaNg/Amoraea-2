export const INTERVIEW_SCREEN_READY_WAIT_MS = 4000;

export async function awaitInterviewScreenReadyWithTimeout(
  awaitScreenReadySignal: () => Promise<void>,
  timeoutMs = INTERVIEW_SCREEN_READY_WAIT_MS,
): Promise<void> {
  await Promise.race([
    awaitScreenReadySignal(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}
