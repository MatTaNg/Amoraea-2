import { getLifeDomainOnboardingMeta, type LifeDomainId } from '@/shared/constants/lifeDomainOnboardingQuestions';
import { FEEDBACK_CATEGORY_FEATURE_REQUEST } from '@/shared/constants/feedbackCategories';
import { submitInterviewFeedback } from '@data/services/submitInterviewFeedback';

export function formatLifeDomainQuestionSuggestionMessage(
  domainId: LifeDomainId,
  suggestion: string,
): string {
  const { name } = getLifeDomainOnboardingMeta(domainId);
  return `[Life domain: ${name}] Question suggestion:\n${suggestion.trim()}`;
}

/** Sends optional life-domain question suggestion to admin feedback (Feature request). */
export async function submitLifeDomainQuestionSuggestion(
  userId: string,
  domainId: LifeDomainId,
  suggestion: string,
): Promise<{ error: string | null }> {
  const trimmed = suggestion.trim();
  if (!trimmed) return { error: null };

  return submitInterviewFeedback({
    userId,
    category: FEEDBACK_CATEGORY_FEATURE_REQUEST,
    message: formatLifeDomainQuestionSuggestionMessage(domainId, trimmed),
    pageContext: `life_domain_questions:${domainId}`,
  });
}
