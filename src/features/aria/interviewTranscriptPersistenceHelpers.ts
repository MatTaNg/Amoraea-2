import {
  tagInterviewTranscriptMessages,
  type MessageWithScenario,
} from '@features/aria/interviewScenarioScoringSlice';

export function filterPersistableInterviewTranscriptMessages(
  messages: ReadonlyArray<{
    role: string;
    content: string;
    isScoreCard?: boolean;
    isWelcomeBack?: boolean;
    scenarioNumber?: number;
  }>,
): MessageWithScenario[] {
  return messages.filter(
    (m) => !m.isScoreCard && !m.isWelcomeBack,
  ) as MessageWithScenario[];
}

export function buildTaggedInterviewTranscriptSnapshot(
  messages: ReadonlyArray<{
    role: string;
    content: string;
    isScoreCard?: boolean;
    isWelcomeBack?: boolean;
    scenarioNumber?: number;
  }>,
): MessageWithScenario[] {
  return tagInterviewTranscriptMessages(filterPersistableInterviewTranscriptMessages(messages));
}
