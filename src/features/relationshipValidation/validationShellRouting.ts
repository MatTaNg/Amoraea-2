import type { QueryClient } from '@tanstack/react-query';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';

import { RELATIONSHIP_VALIDATION_TRACK } from './constants';
import {
  enterValidationFlow as enterValidationFlowRepo,
  exitValidationFlow as exitValidationFlowRepo,
  fetchValidationShellRouting,
  type ValidationShellRouting,
} from './relationshipValidationRepo';

export type { ValidationShellRouting };

/** Post-interview screens users can return to after exiting the validation flow. */
export type ValidationStandardReturnRoute =
  | 'PostInterview'
  | 'PostInterviewLaunch'
  | 'PostInterviewPassed'
  | 'PostInterviewFailed'
  | 'InterviewComplete';

export function validationStandardReturnRouteQueryKey(userId: string) {
  return ['validationStandardReturnRoute', userId] as const;
}

export function isValidationStandardReturnRoute(
  route: string,
): route is ValidationStandardReturnRoute {
  return (
    route === 'PostInterview' ||
    route === 'PostInterviewLaunch' ||
    route === 'PostInterviewPassed' ||
    route === 'PostInterviewFailed' ||
    route === 'InterviewComplete'
  );
}

export function setValidationStandardReturnRoute(
  queryClient: QueryClient,
  userId: string,
  route: ValidationStandardReturnRoute,
): void {
  queryClient.setQueryData(validationStandardReturnRouteQueryKey(userId), route);
}

export function readValidationStandardReturnRoute(
  queryClient: QueryClient,
  userId: string,
): ValidationStandardReturnRoute | null {
  const route = queryClient.getQueryData<InterviewStackRoute>(
    validationStandardReturnRouteQueryKey(userId),
  );
  return route && isValidationStandardReturnRoute(route) ? route : null;
}

export function clearValidationStandardReturnRoute(
  queryClient: QueryClient,
  userId: string,
): void {
  queryClient.removeQueries({ queryKey: validationStandardReturnRouteQueryKey(userId) });
}

export function shouldUseRelationshipValidationNavigator(
  routing: ValidationShellRouting | null | undefined,
): boolean {
  if (!routing || routing.track !== RELATIONSHIP_VALIDATION_TRACK) return false;
  if (!routing.standardAppEnrolled) return true;
  return routing.flowActive;
}

export function isValidationStandardAppEnrolled(
  routing: ValidationShellRouting | null | undefined,
): boolean {
  return (
    routing?.track === RELATIONSHIP_VALIDATION_TRACK && routing.standardAppEnrolled === true
  );
}

export async function enterValidationFlowFromStandardApp(userId: string): Promise<void> {
  await enterValidationFlowRepo(userId);
}

export async function exitValidationFlowToStandardApp(userId: string): Promise<void> {
  await exitValidationFlowRepo(userId);
}

export { fetchValidationShellRouting };
