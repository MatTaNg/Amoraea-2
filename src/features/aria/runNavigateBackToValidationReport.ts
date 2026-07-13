import type { NavigateBackToValidationReportDeps } from '@features/aria/interviewClosingQuestionTypes';

export function runNavigateBackToValidationReport(deps: NavigateBackToValidationReportDeps): void {
  if (typeof deps.navigation.canGoBack === 'function' && deps.navigation.canGoBack()) {
    deps.navigation.goBack?.();
    return;
  }
  if (typeof deps.navigation.replace === 'function') {
    deps.navigation.replace('ValidationReport');
  }
}
