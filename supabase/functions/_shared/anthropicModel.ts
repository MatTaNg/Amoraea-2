import { DEFAULT_CLAUDE_SONNET_MODEL, resolveAnthropicSonnetModel } from './resolveAnthropicSonnetModel.ts';

/** Default Sonnet model for Anthropic Messages API calls from edge functions. */
export const CLAUDE_SONNET_MODEL = resolveAnthropicSonnetModel();
export { resolveAnthropicSonnetModel };
