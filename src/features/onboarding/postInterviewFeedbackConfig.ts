export type PostInterviewFeedbackKey = 'conversation_quality' | 'clarity_flow' | 'trust_accuracy';

export const POST_INTERVIEW_FEEDBACK_QUESTIONS: Array<{ id: PostInterviewFeedbackKey; title: string; prompt: string }> = [
  {
    id: 'conversation_quality',
    title: 'Conversation Quality',
    prompt:
      'Did Amoraea feel human? Did you feel heard? How was the conversation flow? Was it easy and natural to follow?',
  },
  {
    id: 'clarity_flow',
    title: 'Clarity and Flow',
    prompt: 'Did you understand what was being asked of you? Did the length feel appropriate?',
  },
  {
    id: 'trust_accuracy',
    title: 'Trust and Accuracy',
    prompt:
      'Did you feel the grading and the questions were fair? What about the follow-up questions? How accurately do you think the interview measures relationship-readiness?',
  },
];
