import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';

export function interviewStackPathname(path: string): string {
  const qIndex = path.indexOf('?');
  const pathnameRaw = qIndex >= 0 ? path.slice(0, qIndex) : path;
  return pathnameRaw.replace(/\/+$/, '') || '/';
}

export function isInterviewAliasWebPath(path: string): boolean {
  const pathname = interviewStackPathname(path);
  return (
    pathname === '/' ||
    pathname === '' ||
    pathname === '/interview' ||
    pathname === 'interview'
  );
}

/** When reveal is ready, do not keep the user on stale processing / interview URLs after login. */
export function shouldRedirectWebPathToPreferredRoute(
  path: string,
  preferredRoute: InterviewStackRoute | undefined,
): boolean {
  if (!preferredRoute) {
    return false;
  }
  if (preferredRoute === 'AssessmentWelcome') {
    const pathname = interviewStackPathname(path);
    // Bare root aliases only — `/interview` is the Amoraea screen after Continue.
    return pathname === '/' || pathname === '';
  }
  if (preferredRoute === 'Amoraea' || preferredRoute === 'PsychometricAssessment') {
    return false;
  }
  const pathname = interviewStackPathname(path);
  if (isInterviewAliasWebPath(path)) return true;
  if (
    preferredRoute === 'PostInterviewLaunch' ||
    preferredRoute === 'PostInterviewPassed' ||
    preferredRoute === 'PostInterviewFailed'
  ) {
    return (
      pathname === '/post-interview-processing' ||
      pathname === 'post-interview-processing' ||
      pathname === '/post-interview' ||
      pathname === 'post-interview'
    );
  }
  return false;
}
