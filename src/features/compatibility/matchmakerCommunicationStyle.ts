/**
 * Matchmaker / LLM context for communication style — experiential labels only in user-facing copy.
 *
 * Example (append to system or user message when describing a candidate):
 * ```
 * ${formatCommunicationStyleForMatchmakerPrompt(labelsFromDb)}
 *
 * ${MATCHMAKER_STYLE_VOCABULARY_BLOCK}
 * ```
 * where `labelsFromDb` matches `translateStyleProfile(styleProfileFromDbRow(row))` or the stored
 * `style_labels_*` / `matchmaker_summary` / `low_confidence_note` columns from `communication_style_profiles`.
 */
export type { StyleLabels, TranslateStyleProfileOptions } from '@utilities/styleTranslations';
export {
  MATCHMAKER_STYLE_VOCABULARY_BLOCK,
  countMatchmakerSummaryTemplateSentences,
  formatCommunicationStyleForMatchmakerPrompt,
  matchmakerSummaryReadsAsChipRestatement,
  translateStyleProfile,
  styleProfileFromDbRow,
} from '@utilities/styleTranslations';
export { buildMatchmakerSummaryFromProfile } from '../../../supabase/functions/_shared/matchmakerSummaryFromProfile';
