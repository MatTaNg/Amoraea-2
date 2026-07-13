import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type ResetScenarioCClientGatesLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  'scenarioCRepairOnlyEvidenceRef' | 'scenarioCSophiePerspectiveProbeFiredRef'
>;

export function buildResetScenarioCClientGatesLocalSyncExtra(
  scope: ResetScenarioCClientGatesLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type ResolveAssistantScenarioNumberLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'currentInterviewMomentRef'
  | 'currentScenarioRef'
  | 'detectScenarioFromResponse'
  | 'isScenarioCQ1Prompt'
  | 'getScenarioNumberForNewMessage'
>;

export function buildResolveAssistantScenarioNumberLocalSyncExtra(
  scope: ResolveAssistantScenarioNumberLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type ProcessTurnAudioLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'userId'
  | 'interviewSessionIdRef'
  | 'supabaseAnonKey'
  | 'getResolvedSupabaseUrl'
  | 'bytesToBase64'
  | 'deleteTurnAudioFile'
>;

export function buildProcessTurnAudioLocalSyncExtra(scope: ProcessTurnAudioLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}
