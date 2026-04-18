/** First `recording_start` after a storage-resumed session — logged once for correlation. */

let sessionResumedPendingFirstRecording = false;

export function markSessionResumedForNextRecordingStart(): void {
  sessionResumedPendingFirstRecording = true;
}

export function takeSessionResumedForFirstRecordingStart(): boolean {
  if (!sessionResumedPendingFirstRecording) return false;
  sessionResumedPendingFirstRecording = false;
  return true;
}
