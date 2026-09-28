import {
  isValidWithinScenarioAck,
  parseWithinScenarioAckFromLlm,
} from '@features/aria/interviewWithinScenarioAckLlmValidation';
import { resolveWithinScenarioBriefAckForInterview } from '@features/aria/resolveWithinScenarioBriefAckForInterview';
import { fetchInterviewWithinScenarioAckFromLlm } from '@features/aria/fetchInterviewWithinScenarioAckFromLlm';

jest.mock('@features/aria/fetchInterviewWithinScenarioAckFromLlm', () => ({
  fetchInterviewWithinScenarioAckFromLlm: jest.fn(),
}));

const fetchMock = fetchInterviewWithinScenarioAckFromLlm as jest.MockedFunction<
  typeof fetchInterviewWithinScenarioAckFromLlm
>;

describe('within-scenario ack LLM', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('parseWithinScenarioAckFromLlm trims plain text', () => {
    expect(parseWithinScenarioAckFromLlm('  Thanks for naming that.  ')).toBe('Thanks for naming that.');
  });

  it('isValidWithinScenarioAck rejects questions and transitions', () => {
    expect(isValidWithinScenarioAck('Thanks for sharing that.')).toBe(true);
    expect(isValidWithinScenarioAck('What do you think?')).toBe(false);
    expect(isValidWithinScenarioAck("Here's the next situation.")).toBe(false);
  });

  it('resolveWithinScenarioBriefAckForInterview uses LLM when valid', async () => {
    fetchMock.mockResolvedValue('You picked up on the contempt line.');
    const { ack, source } = await resolveWithinScenarioBriefAckForInterview({
      messages: [{ role: 'assistant', content: 'What do you think is going on?' }],
      userText: 'Emma was being contemptuous.',
      activeQuestionPreview: 'What do you think is going on here?',
      interviewSessionId: 'sess-1',
    });
    expect(source).toBe('llm');
    expect(ack).toContain('contempt');
  });
});
