/**
 * @deprecated Use `@/features/profile/profilePromptsLibrary` for the full prompt catalog.
 */
export {
  PROFILE_PROMPT_ANSWER_MAX_LENGTH as PROMPT_ANSWER_MAX,
  PROFILE_PROMPT_CATEGORIES,
} from '@/features/profile/profilePromptsLibrary';

/** @deprecated No minimum length — short honest answers are valid. */
export const PROMPT_ANSWER_MIN = 1;
