import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { createProfileNameSourceDebugSyncExtra } from '@features/aria/createInterviewMiscSyncExtras';

export type ProfileNameSourceDebugLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  'getInterviewUserFirstNameForPrompt' | 'writeSessionLog'
>;

export function buildProfileNameSourceDebugLocalSyncExtra(
  scope: ProfileNameSourceDebugLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

/** Pick profile-name debug dep-sync fields from a merged interview sync context. */
export function buildProfileNameSourceDebugSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createProfileNameSourceDebugSyncExtra(params);
}
