import { invokeAnthropicMessages } from '../invokeAnthropicMessages';
import { supabase } from '@data/supabase/client';

jest.mock('@utilities/anthropicMessagesClient', () => ({
  getAnthropicEndpoint: jest.fn(),
  getAnthropicRequestHeaders: jest.fn(),
  CLAUDE_SONNET_MODEL: 'claude-sonnet-4-6',
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<typeof supabase.functions.invoke>;

describe('invokeAnthropicMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses anthropic-proxy edge invoke', async () => {
    mockInvoke.mockResolvedValue({
      data: { content: [{ text: '# Report\n\nHello' }] },
      error: null,
    });

    const result = await invokeAnthropicMessages({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockInvoke).toHaveBeenCalledWith('anthropic-proxy', {
      body: {
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    expect(result.content?.[0]?.text).toContain('Report');
  });

  it('throws with proxy error detail when invoke fails', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: { message: 'ANTHROPIC_API_KEY not set' } },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    await expect(
      invokeAnthropicMessages({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY not set|anthropic-proxy/i);
  });

  it('retries then succeeds after transient connection reset', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          error: {
            message:
              'TypeError: error sending request for https://api.anthropic.com/v1/messages: connection reset',
          },
        },
        error: { message: 'Edge Function returned a non-2xx status code' },
      })
      .mockResolvedValueOnce({
        data: { content: [{ text: 'ok' }] },
        error: null,
      });

    const result = await invokeAnthropicMessages({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.content?.[0]?.text).toBe('ok');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 20000);
});
