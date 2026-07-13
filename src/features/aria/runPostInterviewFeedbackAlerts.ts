import { Alert } from 'react-native';

import type { PostInterviewFeedbackAlertDeps } from '@features/aria/interviewClosingQuestionTypes';

export function runShowFeedbackNotice(
  deps: PostInterviewFeedbackAlertDeps,
  title: string,
  message: string,
): void {
  deps.showSimpleAlert(title, message);
}

export function runShowMissingInterviewAttemptAlert(): void {
  Alert.alert(
    'Feedback',
    'We could not find the latest interview record yet. Please try again in a moment.',
  );
}
