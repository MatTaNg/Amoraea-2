import { DEFAULT_CLAUDE_SONNET_MODEL, resolveAnthropicSonnetModel } from '../anthropicMessagesClient';

describe('resolveAnthropicSonnetModel', () => {
  it('returns current default when model is missing', () => {
    expect(resolveAnthropicSonnetModel()).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
    expect(resolveAnthropicSonnetModel('')).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
  });

  it('remaps retired Sonnet 4 snapshot to current default', () => {
    expect(resolveAnthropicSonnetModel('claude-sonnet-4-20250514')).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
    expect(resolveAnthropicSonnetModel('claude-sonnet-4-0')).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
  });

  it('passes through current model ids unchanged', () => {
    expect(resolveAnthropicSonnetModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
  });
});
