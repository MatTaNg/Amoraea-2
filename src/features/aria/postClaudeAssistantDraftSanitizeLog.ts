import { remoteLog } from '@utilities/remoteLog';

export function logPostClaudeAssistantDraftSanitizeChange(
  eventType: string,
  before: string,
  after: string,
  extra?: Record<string, unknown>,
): void {
  if (before === after) {
    return;
  }
  void remoteLog(eventType, {
    preview: after.slice(0, 260),
    ...(extra ?? {}),
  });
}
