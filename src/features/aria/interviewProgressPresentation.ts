export type InterviewProgressMoment = 1 | 2 | 3 | 4 | 5;

export const INTERVIEW_PROGRESS_MOMENT_COUNT = 5;

/**
 * Equal chapters the user still has to get through.
 * Scenario 1 is one of seven, so finishing it stays near one seventh.
 * Follow-up prompts move the bar inside the current chapter.
 */
const INTERVIEW_PROGRESS_CHAPTERS: ReadonlyArray<{
  moment: InterviewProgressMoment;
  steps: ReadonlyArray<(normalized: string) => boolean>;
}> = [
  {
    moment: 1,
    steps: [
      (text) => text.includes('between these two'),
      (text) => text.includes('made that very clear'),
      (text) => text.includes('if you were ryan'),
    ],
  },
  {
    moment: 2,
    steps: [
      (text) => text.includes('what do you think is going on here'),
      (text) => text.includes('could have done differently'),
    ],
  },
  {
    moment: 3,
    steps: [
      (text) => text.includes("didn't know what to say") || text.includes('didnt know what to say'),
      (text) => text.includes('like for sophie'),
    ],
  },
  {
    moment: 4,
    steps: [(text) => text.includes('under your skin') || text.includes('falling out')],
  },
  {
    moment: 4,
    steps: [(text) => text.includes('walk away'), (text) => text.includes('keep investing')],
  },
  {
    moment: 4,
    steps: [(text) => text.includes('needed support') || text.includes('really stressed')],
  },
  {
    moment: 5,
    steps: [(text) => text.includes('how did things get resolved')],
  },
];

const INTERVIEW_PROGRESS_CHAPTER_COUNT = INTERVIEW_PROGRESS_CHAPTERS.length;

const FLAT_STEPS = INTERVIEW_PROGRESS_CHAPTERS.flatMap((chapter, chapterIndex) =>
  chapter.steps.map((match, stepIndex) => ({ chapterIndex, stepIndex, match })),
);

export function normalizeInterviewProgressPrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Highest delivered prompt this text matches, or -1 when it is not a progress step. */
export function matchInterviewProgressStep(lastQuestionText: string): number {
  const normalized = normalizeInterviewProgressPrompt(lastQuestionText);
  if (!normalized) return -1;
  let matched = -1;
  for (let index = 0; index < FLAT_STEPS.length; index += 1) {
    if (FLAT_STEPS[index].match(normalized)) matched = index;
  }
  return matched;
}

function clampMoment(currentMoment: number): InterviewProgressMoment {
  const rounded = Math.round(currentMoment) || 1;
  return Math.min(INTERVIEW_PROGRESS_MOMENT_COUNT, Math.max(1, rounded)) as InterviewProgressMoment;
}

function chaptersCompletedBeforeMoment(moment: InterviewProgressMoment): number {
  let count = 0;
  for (const chapter of INTERVIEW_PROGRESS_CHAPTERS) {
    if (chapter.moment < moment) count += 1;
  }
  return count;
}

export function interviewCompletionRatio(input: {
  currentMoment: number;
  momentsComplete: Partial<Record<InterviewProgressMoment, boolean>>;
  lastQuestionText?: string;
}): number {
  if (input.momentsComplete[5]) return 1;

  const current = clampMoment(input.currentMoment);
  let completedChapters = chaptersCompletedBeforeMoment(current);
  for (const moment of [1, 2, 3, 4] as const) {
    if (input.momentsComplete[moment] === true) {
      completedChapters = Math.max(completedChapters, chaptersCompletedBeforeMoment((moment + 1) as InterviewProgressMoment));
    }
  }

  const matched = matchInterviewProgressStep(input.lastQuestionText ?? '');
  let within = 0;
  if (matched >= 0) {
    const { chapterIndex, stepIndex } = FLAT_STEPS[matched];
    if (chapterIndex < completedChapters) {
      within = 0;
    } else {
      completedChapters = chapterIndex;
      const stepCount = INTERVIEW_PROGRESS_CHAPTERS[chapterIndex].steps.length;
      within = (stepIndex + 1) / stepCount;
    }
  }

  const raw = (completedChapters + within) / INTERVIEW_PROGRESS_CHAPTER_COUNT;
  return Math.min(raw, (INTERVIEW_PROGRESS_CHAPTER_COUNT - 0.5) / INTERVIEW_PROGRESS_CHAPTER_COUNT);
}

export function interviewCompletionPercent(input: {
  currentMoment: number;
  momentsComplete: Partial<Record<InterviewProgressMoment, boolean>>;
  lastQuestionText?: string;
}): number {
  return Math.round(interviewCompletionRatio(input) * 100);
}
