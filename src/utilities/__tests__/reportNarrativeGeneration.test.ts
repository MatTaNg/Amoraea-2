import {
  anthropicStoppedDueToMaxTokens,
  closingSectionAppearsTruncated,
  invokeAnthropicReportNarrative,
  invokeOpenAiReportNarrative,
  openAiStoppedDueToLength,
  REPORT_NARRATIVE_TOKEN_BUDGETS,
} from '../reportNarrativeGeneration';
import { invokeAnthropicMessages } from '../invokeAnthropicMessages';
import { invokeOpenAiChatWithMeta } from '../invokeOpenAiChat';

jest.mock('../invokeAnthropicMessages');
jest.mock('../invokeOpenAiChat');

const mockAnthropic = invokeAnthropicMessages as jest.MockedFunction<typeof invokeAnthropicMessages>;
const mockOpenAi = invokeOpenAiChatWithMeta as jest.MockedFunction<typeof invokeOpenAiChatWithMeta>;

describe('reportNarrativeGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('stop reason helpers', () => {
    it('detects anthropic max_tokens', () => {
      expect(anthropicStoppedDueToMaxTokens('max_tokens')).toBe(true);
      expect(anthropicStoppedDueToMaxTokens('end_turn')).toBe(false);
    });

    it('detects openai length finish', () => {
      expect(openAiStoppedDueToLength('length')).toBe(true);
      expect(openAiStoppedDueToLength('stop')).toBe(false);
    });
  });

  describe('closingSectionAppearsTruncated', () => {
    it('returns false when closing ends with punctuation', () => {
      const md = `## Overview\nHello.\n\n## Closing\nYou already have what you need to grow.`;
      expect(closingSectionAppearsTruncated(md)).toBe(false);
    });

    it('returns true when closing ends mid-sentence', () => {
      const md = `## Overview\nHello.\n\n## Closing\nIt's about closing the distance between the understanding you already have`;
      expect(closingSectionAppearsTruncated(md)).toBe(true);
    });

    it('returns false when no closing section', () => {
      expect(closingSectionAppearsTruncated('## Overview\nDone.')).toBe(false);
    });
  });

  describe('invokeAnthropicReportNarrative', () => {
    it('returns text on end_turn without retry', async () => {
      mockAnthropic.mockResolvedValueOnce({
        content: [{ text: '## Closing\nDone.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const text = await invokeAnthropicReportNarrative('personal_full_report', {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(text).toBe('## Closing\nDone.');
      expect(mockAnthropic).toHaveBeenCalledTimes(1);
      expect(mockAnthropic.mock.calls[0]?.[0].max_tokens).toBe(
        REPORT_NARRATIVE_TOKEN_BUDGETS.personal_full_report.initial,
      );
    });

    it('retries once with higher budget when stop_reason is max_tokens', async () => {
      mockAnthropic
        .mockResolvedValueOnce({
          content: [{ text: '## Closing\nCut off mid' }],
          stop_reason: 'max_tokens',
          usage: { input_tokens: 200, output_tokens: 2500 },
        })
        .mockResolvedValueOnce({
          content: [{ text: '## Closing\nFully complete.' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 200, output_tokens: 4000 },
        });

      const text = await invokeAnthropicReportNarrative('personal_full_report', {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(text).toBe('## Closing\nFully complete.');
      expect(mockAnthropic).toHaveBeenCalledTimes(2);
      expect(mockAnthropic.mock.calls[1]?.[0].max_tokens).toBe(
        REPORT_NARRATIVE_TOKEN_BUDGETS.personal_full_report.retry,
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('stop_reason=max_tokens'),
      );
    });
  });

  describe('invokeOpenAiReportNarrative', () => {
    it('retries once when finish_reason is length', async () => {
      mockOpenAi
        .mockResolvedValueOnce({
          text: 'partial',
          finishReason: 'length',
          usage: { prompt_tokens: 100, completion_tokens: 4500 },
        })
        .mockResolvedValueOnce({
          text: '## Closing\nComplete.',
          finishReason: 'stop',
          usage: { prompt_tokens: 100, completion_tokens: 5000 },
        });

      const text = await invokeOpenAiReportNarrative('relationship_validation_full', {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(text).toBe('## Closing\nComplete.');
      expect(mockOpenAi).toHaveBeenCalledTimes(2);
      expect(mockOpenAi.mock.calls[1]?.[0].max_tokens).toBe(
        REPORT_NARRATIVE_TOKEN_BUDGETS.relationship_validation_full.retry,
      );
    });
  });
});
