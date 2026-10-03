export const DEALBREAKER_QUESTION_HIGHLIGHT_PHRASE = 'important';

/** Shared importance framing for partner-alignment questions (onboarding + edit profile). */
export function partnerAlignmentDealbreakerQuestion(shareSubject: string): string {
  return `How important is it that your match shares ${shareSubject}?`;
}

/** Substance questions ask whether a match should share the same relationship, not whether it is a dealbreaker. */
export function partnerRelationshipShareQuestion(topic: string): string {
  return `How important is it that your match shares your relationship with ${topic}?`;
}

export const PARTNER_ALIGNMENT_TOBACCO_DEALBREAKER_QUESTION =
  partnerRelationshipShareQuestion('cigarettes or vaping');

export const PARTNER_ALIGNMENT_ALCOHOL_DEALBREAKER_QUESTION =
  partnerRelationshipShareQuestion('alcohol');

export const PARTNER_ALIGNMENT_RECREATIONAL_DRUGS_DEALBREAKER_QUESTION =
  partnerRelationshipShareQuestion('recreational drugs');

export const PARTNER_ALIGNMENT_PSYCHEDELICS_DEALBREAKER_QUESTION =
  partnerRelationshipShareQuestion('psychedelics or plant medicines');

export const PARTNER_ALIGNMENT_CANNABIS_DEALBREAKER_QUESTION =
  partnerRelationshipShareQuestion('cannabis or tobacco');

export const PARTNER_POLITICAL_VIEWS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your political views');

export const PARTNER_SAME_RELIGION_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your religious faith');

export const PARTNER_SPECIFIC_SEX_INTERESTS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your specific sex interests');
