/** Set when the scripted S3 repair Q2 is passed to TTS (not merely staged in transcript). */
export function markS3RepairProbeTtsDelivered(deps: {
  s3RepairProbeDeliveredRef: { current: boolean };
}): void {
  deps.s3RepairProbeDeliveredRef.current = true;
}
