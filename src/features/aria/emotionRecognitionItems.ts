import {
  MOMENT_4_HANDOFF_NO_NAME_LEAD,
  SCENARIO_1_TO_2_TRANSITION_FALLBACK,
  SCENARIO_2_TO_3_TRANSITION_FALLBACK,
} from './interviewTransitionBundles';

export const EMOTION_ITEM_CORRECT_ANSWERS = ['B', 'C', 'C'] as const;

export type EmotionChoiceLetter = 'A' | 'B' | 'C' | 'D';

export type EmotionIdentificationItem = {
  question: string;
  options: Record<EmotionChoiceLetter, string>;
};

/** In-scenario multiple choice after each scripted scenario block (UI-only; not spoken by Aira). */
export const INTERVIEW_EMOTION_IDENTIFICATION_ITEMS: readonly EmotionIdentificationItem[] = [
  {
    question:
      'Emma pays the bill and waits while Ryan finishes his call. What is Emma most likely feeling in that moment?',
    options: {
      A: "Worried something serious has happened with Ryan's mother",
      B: 'Dismissed and deprioritized',
      C: 'Embarrassed to be sitting alone at the table',
      D: 'Annoyed at the restaurant for the interruption',
    },
  },
  {
    question: 'Sarah tears up when James asks about her salary. What is Sarah most likely feeling?',
    options: {
      A: 'Grateful James is being practical about the opportunity',
      B: 'Embarrassed that she accepted a lower salary than expected',
      C: 'Hurt that her excitement is being met with logistics instead of celebration',
      D: 'Anxious about the new job responsibilities',
    },
  },
  {
    question:
      'Sophie calls after Daniel as he walks out the door. What is Sophie most likely feeling in that moment?',
    options: {
      A: 'Relieved he is taking space to calm down',
      B: 'Guilty for pushing him too hard',
      C: 'Frustrated and scared the issue will never get resolved',
      D: 'Indifferent to whether he comes back',
    },
  },
] as const;

export function scoreEmotionItems(responses: string[]): number {
  if (!Array.isArray(responses) || responses.length === 0) return 0;
  let correct = 0;
  let answered = 0;
  for (let i = 0; i < EMOTION_ITEM_CORRECT_ANSWERS.length; i++) {
    const letter = responses[i];
    if (typeof letter !== 'string' || letter.trim().length === 0) continue;
    answered += 1;
    if (letter.trim().toUpperCase() === EMOTION_ITEM_CORRECT_ANSWERS[i]) correct += 1;
  }
  if (answered === 0) return 0;
  return correct / EMOTION_ITEM_CORRECT_ANSWERS.length;
}

/** Display scale 0–10: raw 0 → 0, 1/3 → 3, 2/3 → 7, 1 → 10. */
export function emotionRecognitionDisplayScore(raw: number): number {
  return Math.round(raw * 10);
}

/**
 * Split assistant transition text so the closing line can be spoken before the emotion modal,
 * and the next vignette / Moment 4 card only after the user answers.
 */
export function splitTransitionDisplayForEmotionModal(displayText: string): { preModal: string; postModal: string } {
  const t = displayText.trim();
  const idx = t.indexOf('\n\n');
  if (idx >= 0) {
    const preModal = t.slice(0, idx).trim();
    const postModal = t.slice(idx + 2).trim();
    if (preModal && postModal) return { preModal, postModal };
  }
  const leads = [
    SCENARIO_1_TO_2_TRANSITION_FALLBACK,
    SCENARIO_2_TO_3_TRANSITION_FALLBACK,
    MOMENT_4_HANDOFF_NO_NAME_LEAD,
  ] as const;
  for (const lead of leads) {
    if (t.startsWith(lead)) {
      const postModal = t.slice(lead.length).trim();
      if (postModal) return { preModal: lead.trim(), postModal };
    }
  }
  return { preModal: t, postModal: '' };
}
