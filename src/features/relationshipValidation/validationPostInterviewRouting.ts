import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RELATIONSHIP_VALIDATION_TRACK } from './constants';
import { fetchValidationShellRouting } from './relationshipValidationRepo';
import { shouldUseRelationshipValidationNavigator } from './validationShellRouting';

/** Main-app routes that standard onboarding uses after the AI interview. */
export const STANDARD_POST_INTERVIEW_STACK_ROUTES = new Set([
  'PostInterview',
  'PostInterviewProcessing',
  'PostInterviewPassed',
  'PostInterviewFailed',
  'InterviewComplete',
  'PsychometricsComplete',
  'PsychometricAssessment',
  'PostInterviewSexualCommunication',
]);

export function isStandardPostInterviewStackRoute(name: string): boolean {
  return STANDARD_POST_INTERVIEW_STACK_ROUTES.has(name);
}

export function validationStackRouteForStandardPostInterview(
  name: string,
): 'ValidationPostInterviewProcessing' | 'ValidationReport' | null {
  if (!isStandardPostInterviewStackRoute(name)) return null;
  return 'ValidationPostInterviewProcessing';
}

/**
 * Standard PostInterview / processing screens: bounce native RELATIONSHIP signup users back into
 * the validation navigator. Standard-app enrollments stay on post-interview until they opt in.
 */
export function useRedirectRelationshipValidationFromStandardPostInterview(userId: string): {
  isRedirecting: boolean;
} {
  const queryClient = useQueryClient();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsRedirecting(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const routing = await fetchValidationShellRouting(userId);
        if (cancelled) return;
        if (
          routing.track === RELATIONSHIP_VALIDATION_TRACK &&
          shouldUseRelationshipValidationNavigator(routing) &&
          !routing.standardAppEnrolled
        ) {
          await queryClient.invalidateQueries({ queryKey: ['validationShellRouting', userId] });
          await queryClient.invalidateQueries({ queryKey: ['validationTrack', userId] });
          return;
        }
        setIsRedirecting(false);
      } catch {
        if (!cancelled) setIsRedirecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient, userId]);

  return { isRedirecting };
}

/** Module flag set while ValidationAria is mounted — used by shared post-interview handoff. */
let validationTrackInterviewHandoffActive = false;

export function setValidationTrackInterviewHandoffActive(active: boolean): void {
  validationTrackInterviewHandoffActive = active;
}

export function isValidationTrackInterviewHandoffActive(): boolean {
  return validationTrackInterviewHandoffActive;
}

export const VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE = 'ValidationPostInterviewProcessing';
