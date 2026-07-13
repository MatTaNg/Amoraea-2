export { EMOTION_ITEM_CORRECT_ANSWERS } from '@config/scoring/emotionRecognitionItems';
import { EMOTION_ITEM_CORRECT_ANSWERS } from '@config/scoring/emotionRecognitionItems';

export type EmotionInterviewChoice = 'A' | 'B' | 'C' | 'D';

export type EmotionInterviewModalItem = {
  question: string;
  choices: ReadonlyArray<{ letter: EmotionInterviewChoice; text: string }>;
};

export const EMOTION_INTERVIEW_MODAL_ITEMS: readonly EmotionInterviewModalItem[] = [
  {
    question:
      "Emma pays the bill and waits while Ryan finishes his call. What is Emma most likely feeling in that moment?",
    choices: [
      { letter: 'A', text: "Worried something serious has happened with Ryan's mother" },
      { letter: 'B', text: 'Dismissed and deprioritized' },
      { letter: 'C', text: 'Embarrassed to be sitting alone at the table' },
      { letter: 'D', text: 'Annoyed at the restaurant for the interruption' },
    ],
  },
  {
    question:
      'That evening James leads with questions about the salary, the start date, and the commute. Sarah tears up. What is Sarah most likely feeling in that moment?',
    choices: [
      { letter: 'A', text: 'Grateful James is being practical about the opportunity' },
      { letter: 'B', text: 'Embarrassed that she accepted a lower salary than expected' },
      {
        letter: 'C',
        text: 'Hurt that her excitement is being met with logistics instead of celebration',
      },
      { letter: 'D', text: 'Anxious about the new job responsibilities' },
    ],
  },
  {
    question:
      'Sophie calls after Daniel as he walks out the door. What is Sophie most likely feeling in that moment?',
    choices: [
      { letter: 'A', text: 'Relieved he is taking space to calm down' },
      { letter: 'B', text: 'Guilty for pushing him too hard' },
      { letter: 'C', text: 'Frustrated and scared the issue will never get resolved' },
      { letter: 'D', text: 'Indifferent to whether he comes back' },
    ],
  },
] as const;

/** Full in-interview emotion identification battery length (one item per scenario). */
export const EXPECTED_EMOTION_RECOGNITION_ITEMS = EMOTION_INTERVIEW_MODAL_ITEMS.length;
