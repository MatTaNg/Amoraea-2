import {
  buildStructuralRetryUserPromptAddon,
  logStructuralValidationOutcome,
  stripStructuralNarrativeBlock,
  validateMarkdownStructuralEnforcement,
  type StructuralValidationContext,
} from '@features/reports/reportNarrativeStructuralEnforcement';
import {
  invokeAnthropicReportNarrative,
  invokeOpenAiReportNarrative,
  type ReportNarrativePipeline,
} from '@utilities/reportNarrativeGeneration';
import type { AnthropicMessagesPayload } from '@utilities/invokeAnthropicMessages';
import type { OpenAiChatPayload } from '@utilities/invokeOpenAiChat';

export async function invokeAnthropicReportNarrativeWithStructuralValidation(
  pipeline: Extract<
    ReportNarrativePipeline,
    'personal_full_report' | 'personal_partial_report'
  >,
  payload: Omit<AnthropicMessagesPayload, 'max_tokens'> & { max_tokens?: number },
  userPromptBase: string,
  validationContext: StructuralValidationContext = {},
): Promise<string> {
  let userPrompt = userPromptBase;
  let markdown = await invokeAnthropicReportNarrative(pipeline, {
    ...payload,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let validation = validateMarkdownStructuralEnforcement(markdown, validationContext);
  logStructuralValidationOutcome(pipeline, validation, false);

  if (!validation.ok) {
    userPrompt = userPromptBase + buildStructuralRetryUserPromptAddon(validation.issues);
    console.warn(`[NarrativeStructural] ${pipeline}: retrying once after structural validation failure`);
    markdown = await invokeAnthropicReportNarrative(pipeline, {
      ...payload,
      messages: [{ role: 'user', content: userPrompt }],
    });
    validation = validateMarkdownStructuralEnforcement(markdown, validationContext);
    logStructuralValidationOutcome(pipeline, validation, true);
  }

  return stripStructuralNarrativeBlock(markdown);
}

export async function invokeOpenAiReportNarrativeWithStructuralValidation(
  pipeline: Extract<
    ReportNarrativePipeline,
    'relationship_validation_full' | 'relationship_validation_partial'
  >,
  payload: Omit<OpenAiChatPayload, 'messages'> & {
    messages: Array<{ role: string; content: string }>;
  },
  userPromptBase: string,
  systemContent: string,
): Promise<string> {
  const buildMessages = (user: string) => [
    { role: 'system' as const, content: systemContent },
    { role: 'user' as const, content: user },
  ];

  let userPrompt = userPromptBase;
  let markdown = await invokeOpenAiReportNarrative(pipeline, {
    ...payload,
    messages: buildMessages(userPrompt),
  });

  let validation = validateMarkdownStructuralEnforcement(markdown);
  logStructuralValidationOutcome(pipeline, validation, false);

  if (!validation.ok) {
    userPrompt = userPromptBase + buildStructuralRetryUserPromptAddon(validation.issues);
    console.warn(`[NarrativeStructural] ${pipeline}: retrying once after structural validation failure`);
    markdown = await invokeOpenAiReportNarrative(pipeline, {
      ...payload,
      messages: buildMessages(userPrompt),
    });
    validation = validateMarkdownStructuralEnforcement(markdown);
    logStructuralValidationOutcome(pipeline, validation, true);
  }

  return stripStructuralNarrativeBlock(markdown);
}
