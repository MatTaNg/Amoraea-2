import {
  FINANCE_QUESTIONS,
  INTIMACY_QUESTIONS,
  PERSONAL_GROWTH_QUESTIONS,
  PHYSICAL_HEALTH_QUESTIONS,
  SPIRITUALITY_QUESTIONS,
  type LifeDomainQuestionBankItem,
} from '@/shared/constants/lifeDomainQuestionBank';

export type LifeDomainId = 'finance' | 'family' | 'intimacy' | 'spirituality' | 'health';

export type LifeDomainQuestionDef = {
  id: string;
  text: string;
  input?: 'text' | 'dropdown';
  multiline?: boolean;
  options?: { label: string; value: string }[];
  required?: boolean;
  requiredWhenWantKids?: boolean;
  explicitlyOptional?: boolean;
};

export const LIFE_DOMAIN_ONBOARDING_DOMAINS: {
  id: LifeDomainId;
  icon: string;
  name: string;
}[] = [
  { id: 'finance', icon: '💰', name: 'Finances / Business / Career' },
  { id: 'family', icon: '🏠', name: 'Family' },
  { id: 'intimacy', icon: '❤️', name: 'Relationships / Intimacy / Sex' },
  { id: 'spirituality', icon: '✨', name: 'Spirituality / Religion' },
  { id: 'health', icon: '🏃', name: 'Health / Fitness / Growth' },
];

/** Legacy free-text sleep schedule answers (preserved in `life_domain_answers`). */
export const LEGACY_SLEEP_SCHEDULE_DESCRIPTION_QUESTION_ID = 'sleepScheduleDescription';

function mapBankQuestions(questions: LifeDomainQuestionBankItem[]): LifeDomainQuestionDef[] {
  return questions.map((q) => {
    const base = {
      id: q.key,
      text: q.question,
      required: q.required === true,
      requiredWhenWantKids: q.requiredWhenWantKids === true,
      explicitlyOptional: q.explicitlyOptional === true,
    };
    if (q.type === 'picker' && q.pickerOptions?.length) {
      return {
        ...base,
        input: 'dropdown' as const,
        options: (q.pickerOptions ?? []).filter((o) => o.value.trim() !== ''),
      };
    }
    return {
      ...base,
      input: 'text' as const,
      multiline: q.multiline ?? true,
    };
  });
}

export const LIFE_DOMAIN_ONBOARDING_QUESTIONS: Record<LifeDomainId, LifeDomainQuestionDef[]> = {
  finance: mapBankQuestions(FINANCE_QUESTIONS),
  family: mapBankQuestions(PHYSICAL_HEALTH_QUESTIONS),
  intimacy: mapBankQuestions(INTIMACY_QUESTIONS),
  spirituality: mapBankQuestions(SPIRITUALITY_QUESTIONS),
  health: mapBankQuestions(PERSONAL_GROWTH_QUESTIONS),
};

export function isLifeDomainAnswerFilled(value: string | undefined | null): boolean {
  return value != null && String(value).trim() !== '';
}

export function isWantKidsRelevantForLifeDomains(wantKids: string | null | undefined): boolean {
  if (wantKids == null || String(wantKids).trim() === '') return false;
  return String(wantKids).trim() !== "Don't want kids";
}

export function isLifeDomainQuestionRequiredForOnboarding(
  q: LifeDomainQuestionDef,
  context?: { wantKids?: string | null },
): boolean {
  if (q.explicitlyOptional) return false;
  if (q.requiredWhenWantKids) {
    return isWantKidsRelevantForLifeDomains(context?.wantKids);
  }
  return q.required === true;
}

export function getOptionalLifeDomainQuestionsForDomain(
  domainId: LifeDomainId,
  context?: { wantKids?: string | null },
): LifeDomainQuestionDef[] {
  return LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId].filter(
    (q) => !isLifeDomainQuestionRequiredForOnboarding(q, context),
  );
}

export function getActiveRequiredLifeDomainQuestionsByDomain(
  wantKids?: string | null,
): Partial<Record<LifeDomainId, LifeDomainQuestionDef[]>> {
  const byDomain: Partial<Record<LifeDomainId, LifeDomainQuestionDef[]>> = {};
  for (const { domainId, questionId } of getActiveLifeDomainRequiredQuestionSteps(wantKids)) {
    const q = findLifeDomainQuestionDef(domainId, questionId);
    if (!q) continue;
    if (!byDomain[domainId]) byDomain[domainId] = [];
    byDomain[domainId]!.push(q);
  }
  return byDomain;
}

export function countAnsweredInDomain(
  domainId: LifeDomainId,
  answers: Record<string, string | undefined>,
  context?: {
    wantKids?: string | null;
    countRequiredOnly?: boolean;
    countOptionalOnly?: boolean;
  },
): { answered: number; total: number } {
  const qs = LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId] ?? [];
  const scoped = context?.countRequiredOnly
    ? qs.filter((q) => isLifeDomainQuestionRequiredForOnboarding(q, context))
    : context?.countOptionalOnly
      ? qs.filter((q) => !isLifeDomainQuestionRequiredForOnboarding(q, context))
      : qs;
  const total = scoped.length;
  let answered = 0;
  for (const q of scoped) {
    if (isLifeDomainAnswerFilled(answers[q.id])) answered += 1;
  }
  return { answered, total };
}

export function validateLifeDomainStep(
  domainId: LifeDomainId,
  answers: Record<string, string | undefined>,
  options: { enforceRequired: boolean; wantKids?: string | null },
): { valid: boolean; missingQuestions: LifeDomainQuestionDef[] } {
  if (!options.enforceRequired) {
    return { valid: true, missingQuestions: [] };
  }
  const missingQuestions: LifeDomainQuestionDef[] = [];
  for (const q of LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId]) {
    if (!isLifeDomainQuestionRequiredForOnboarding(q, { wantKids: options.wantKids })) continue;
    if (!isLifeDomainAnswerFilled(answers[q.id])) {
      missingQuestions.push(q);
    }
  }
  return { valid: missingQuestions.length === 0, missingQuestions };
}

/** Required per-question steps (finance → family → intimacy → spirituality → health). */
export const LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER: LifeDomainId[] = [
  'finance',
  'family',
  'intimacy',
  'spirituality',
  'health',
];

/** Optional open-ended screens after life-domain sliders. */
export const LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_DOMAIN_ORDER: LifeDomainId[] = [
  'intimacy',
  'finance',
  'spirituality',
  'family',
  'health',
];

export function isLifeDomainOptionalOpenEndedQuestion(
  q: LifeDomainQuestionDef,
  context?: { wantKids?: string | null },
): boolean {
  if (isLifeDomainQuestionRequiredForOnboarding(q, context)) return false;
  return q.input !== 'dropdown';
}

export function getOptionalOpenEndedQuestionsForDomain(
  domainId: LifeDomainId,
  context?: { wantKids?: string | null },
): LifeDomainQuestionDef[] {
  return LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId].filter((q) =>
    isLifeDomainOptionalOpenEndedQuestion(q, context),
  );
}

export function getLeftoverOptionalOpenEndedQuestionsForDomain(
  domainId: LifeDomainId,
  answers: Record<string, string | undefined>,
  context?: { wantKids?: string | null },
): LifeDomainQuestionDef[] {
  return getOptionalOpenEndedQuestionsForDomain(domainId, context).filter(
    (q) => !isLifeDomainAnswerFilled(answers[q.id]),
  );
}

export function lifeDomainOptionalOpenEndedStepId(domainId: LifeDomainId): string {
  return `lifeDomainOptional__${domainId}`;
}

export function parseLifeDomainOptionalOpenEndedStepId(step: string): LifeDomainId | null {
  if (!step.startsWith('lifeDomainOptional__')) return null;
  const domainId = step.slice('lifeDomainOptional__'.length) as LifeDomainId;
  return LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_DOMAIN_ORDER.includes(domainId) ? domainId : null;
}

export const LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS =
  LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_DOMAIN_ORDER.map((domainId) => ({
    step: lifeDomainOptionalOpenEndedStepId(domainId),
    domainId,
  }));

export type LifeDomainOptionalOpenEndedOnboardingStep =
  (typeof LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS)[number]['step'];

export function isLifeDomainOptionalOpenEndedStep(
  step: string,
): step is LifeDomainOptionalOpenEndedOnboardingStep {
  return LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS.some((s) => s.step === step);
}

export function getActiveLifeDomainOptionalOpenEndedSteps(
  wantKids?: string | null,
  lifeDomainAnswers?: Partial<Record<LifeDomainId, Record<string, string | undefined>>>,
): Array<{
  step: LifeDomainOptionalOpenEndedOnboardingStep;
  domainId: LifeDomainId;
}> {
  const ctx = { wantKids };
  return LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS.filter(({ domainId }) => {
    const answers = lifeDomainAnswers?.[domainId] ?? {};
    return getLeftoverOptionalOpenEndedQuestionsForDomain(domainId, answers, ctx).length > 0;
  }) as Array<{
    step: LifeDomainOptionalOpenEndedOnboardingStep;
    domainId: LifeDomainId;
  }>;
}

export function firstIncompleteLifeDomainOptionalOpenEndedStep(
  wantKids?: string | null,
  lifeDomainAnswers?: Partial<Record<LifeDomainId, Record<string, string | undefined>>>,
): LifeDomainOptionalOpenEndedOnboardingStep | null {
  return getActiveLifeDomainOptionalOpenEndedSteps(wantKids, lifeDomainAnswers)[0]?.step ?? null;
}

export function lifeDomainQuestionStepId(domainId: LifeDomainId, questionId: string): string {
  return `lifeDomainQ__${domainId}__${questionId}`;
}

export function parseLifeDomainQuestionStepId(
  step: string,
): { domainId: LifeDomainId; questionId: string } | null {
  if (!step.startsWith('lifeDomainQ__')) return null;
  const rest = step.slice('lifeDomainQ__'.length);
  const sep = rest.indexOf('__');
  if (sep <= 0) return null;
  const domainId = rest.slice(0, sep) as LifeDomainId;
  const questionId = rest.slice(sep + 2);
  if (!LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER.includes(domainId) || !questionId) return null;
  return { domainId, questionId };
}

function buildRequiredQuestionSteps(): Array<{
  step: string;
  domainId: LifeDomainId;
  questionId: string;
}> {
  const rows: Array<{ step: string; domainId: LifeDomainId; questionId: string }> = [];
  for (const domainId of LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER) {
    for (const q of LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId]) {
      if (!q.required && !q.requiredWhenWantKids) continue;
      rows.push({
        step: lifeDomainQuestionStepId(domainId, q.id),
        domainId,
        questionId: q.id,
      });
    }
  }
  return rows;
}

/** One onboarding step per required life-domain question (before sliders and lifestyle). */
export const LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS = buildRequiredQuestionSteps();

export type LifeDomainRequiredQuestionOnboardingStep =
  (typeof LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS)[number]['step'];

/** @deprecated Per-domain screens; maps to first question in that domain for resume. */
export const LIFE_DOMAIN_QUESTION_ONBOARDING_STEPS = [
  { step: 'lifeDomainQuestionsFinance' as const, domainId: 'finance' as const },
  { step: 'lifeDomainQuestionsFamily' as const, domainId: 'family' as const },
  { step: 'lifeDomainQuestionsIntimacy' as const, domainId: 'intimacy' as const },
  { step: 'lifeDomainQuestionsSpirituality' as const, domainId: 'spirituality' as const },
  { step: 'lifeDomainQuestionsHealth' as const, domainId: 'health' as const },
] as const;

export type LifeDomainQuestionOnboardingStep =
  | LifeDomainRequiredQuestionOnboardingStep
  | (typeof LIFE_DOMAIN_QUESTION_ONBOARDING_STEPS)[number]['step'];

/** @deprecated Use per-question steps; kept for resume migration. */
export const LEGACY_LIFE_DOMAIN_QUESTIONS_STEP = 'lifeDomainQuestions';

export function isLifeDomainRequiredQuestionStep(step: string): step is LifeDomainRequiredQuestionOnboardingStep {
  return LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS.some((s) => s.step === step);
}

export function isLifeDomainQuestionOnboardingStep(step: string): step is LifeDomainQuestionOnboardingStep {
  return (
    isLifeDomainRequiredQuestionStep(step) ||
    isLifeDomainOptionalOpenEndedStep(step) ||
    LIFE_DOMAIN_QUESTION_ONBOARDING_STEPS.some((s) => s.step === step)
  );
}

export function getActiveLifeDomainRequiredQuestionSteps(wantKids?: string | null): Array<{
  step: LifeDomainRequiredQuestionOnboardingStep;
  domainId: LifeDomainId;
  questionId: string;
}> {
  return LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS.filter(({ domainId, questionId }) => {
    const q = findLifeDomainQuestionDef(domainId, questionId);
    if (!q) return false;
    return isLifeDomainQuestionRequiredForOnboarding(q, { wantKids });
  }) as Array<{
    step: LifeDomainRequiredQuestionOnboardingStep;
    domainId: LifeDomainId;
    questionId: string;
  }>;
}

export function normalizeLifeDomainQuestionOnboardingStep(
  step: string,
  wantKids?: string | null,
): LifeDomainRequiredQuestionOnboardingStep | null {
  if (isLifeDomainRequiredQuestionStep(step)) {
    const parsed = parseLifeDomainQuestionStepId(step);
    if (!parsed) return null;
    const q = findLifeDomainQuestionDef(parsed.domainId, parsed.questionId);
    if (q && isLifeDomainQuestionRequiredForOnboarding(q, { wantKids })) {
      return step;
    }
    return getActiveLifeDomainRequiredQuestionSteps(wantKids)[0]?.step ?? null;
  }
  if (step === LEGACY_LIFE_DOMAIN_QUESTIONS_STEP) {
    return getActiveLifeDomainRequiredQuestionSteps(wantKids)[0]?.step ?? null;
  }
  const legacy = LIFE_DOMAIN_QUESTION_ONBOARDING_STEPS.find((s) => s.step === step);
  if (legacy) {
    const first = getActiveLifeDomainRequiredQuestionSteps(wantKids).find(
      (row) => row.domainId === legacy.domainId,
    );
    return first?.step ?? getActiveLifeDomainRequiredQuestionSteps(wantKids)[0]?.step ?? null;
  }
  return null;
}

export function lifeDomainIdForQuestionStep(step: string): LifeDomainId {
  const parsed = parseLifeDomainQuestionStepId(step);
  if (parsed) return parsed.domainId;
  const row = LIFE_DOMAIN_QUESTION_ONBOARDING_STEPS.find((s) => s.step === step);
  return row?.domainId ?? 'finance';
}

export function findLifeDomainQuestionStepRow(step: string) {
  const parsed = parseLifeDomainQuestionStepId(step);
  if (parsed) {
    return {
      step,
      domainId: parsed.domainId,
      questionId: parsed.questionId,
    };
  }
  return null;
}

export function getLifeDomainOnboardingMeta(domainId: LifeDomainId) {
  return LIFE_DOMAIN_ONBOARDING_DOMAINS.find((d) => d.id === domainId)!;
}

export function findLifeDomainQuestionDef(
  domainId: LifeDomainId,
  questionId: string,
): LifeDomainQuestionDef | undefined {
  return (LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId] ?? []).find((q) => q.id === questionId);
}
