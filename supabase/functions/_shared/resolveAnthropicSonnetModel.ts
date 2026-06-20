/** Current default Sonnet model for Anthropic Messages API. */
export const DEFAULT_CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

/** Retired Sonnet 4 snapshots that return HTTP 404 from Anthropic. */
const RETIRED_SONNET_MODELS: Record<string, string> = {
  'claude-sonnet-4-20250514': DEFAULT_CLAUDE_SONNET_MODEL,
  'claude-sonnet-4-0': DEFAULT_CLAUDE_SONNET_MODEL,
};

/**
 * Resolve the Sonnet model to send to Anthropic.
 * - `ANTHROPIC_SONNET_MODEL` secret overrides everything (edge functions).
 * - Retired model IDs are remapped to the current default.
 * - Empty/missing request falls back to default.
 */
export function resolveAnthropicSonnetModel(requested?: string): string {
  const envOverride =
    typeof Deno !== 'undefined' ? Deno.env.get('ANTHROPIC_SONNET_MODEL')?.trim() : '';
  if (envOverride) return envOverride;

  const trimmed = requested?.trim() ?? '';
  if (!trimmed) return DEFAULT_CLAUDE_SONNET_MODEL;
  return RETIRED_SONNET_MODELS[trimmed] ?? trimmed;
}
