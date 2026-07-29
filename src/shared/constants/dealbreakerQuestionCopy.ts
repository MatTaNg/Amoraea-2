export const DEALBREAKER_QUESTION_HIGHLIGHT_PHRASE = 'dealbreaker';

/** Shared dealbreaker framing for partner-alignment questions (onboarding + edit profile). */
export function partnerAlignmentDealbreakerQuestion(shareSubject: string): string {
  return `If you met someone amazing who didn't share ${shareSubject} with you, would it still be a dealbreaker?`;
}

export const PARTNER_ALIGNMENT_TOBACCO_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your relationship with cigarettes or vaping');

export const PARTNER_ALIGNMENT_ALCOHOL_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your relationship with alcohol');

export const PARTNER_ALIGNMENT_RECREATIONAL_DRUGS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your relationship with recreational drugs');

export const PARTNER_ALIGNMENT_PSYCHEDELICS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your relationship with psychedelics or plant medicines');

export const PARTNER_ALIGNMENT_CANNABIS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your relationship with cannabis or tobacco');

export const PARTNER_POLITICAL_VIEWS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your political views');

export const PARTNER_SAME_RELIGION_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your religious faith');

export const PARTNER_SPECIFIC_SEX_INTERESTS_DEALBREAKER_QUESTION =
  partnerAlignmentDealbreakerQuestion('your specific sex interests');
