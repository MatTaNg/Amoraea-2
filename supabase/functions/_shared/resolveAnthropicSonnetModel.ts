/** Current default Sonnet model for Anthropic Messages API. */
export const DEFAULT_CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

/** Retired / invalid model IDs that return HTTP 404 from Anthropic. */
const RETIRED_SONNET_MODELS: Record<string, string> = {
  'claude-sonnet-4-20250514': DEFAULT_CLAUDE_SONNET_MODEL,
  'claude-sonnet-4-0': DEFAULT_CLAUDE_SONNET_MODEL,
  'claude-3-5-sonnet-20241022': DEFAULT_CLAUDE_SONNET_MODEL,
  'claude-3-5-sonnet-latest': DEFAULT_CLAUDE_SONNET_MODEL,
};

function remapRetiredModel(modelId: string): string {
  return RETIRED_SONNET_MODELS[modelId] ?? modelId;
}

/**
 * Resolve the Sonnet model to send to Anthropic.
 * - `ANTHROPIC_SONNET_MODEL` secret overrides the default (still remapped if retired).
 * - Retired model IDs are remapped to the current default.
 * - Empty/missing request falls back to default.
 */
export function resolveAnthropicSonnetModel(requested?: string): string {
  const envOverride =
    typeof Deno !== 'undefined' ? Deno.env.get('ANTHROPIC_SONNET_MODEL')?.trim() : '';
  const trimmed = envOverride || requested?.trim() || '';
  if (!trimmed) return DEFAULT_CLAUDE_SONNET_MODEL;
  return remapRetiredModel(trimmed);
}
