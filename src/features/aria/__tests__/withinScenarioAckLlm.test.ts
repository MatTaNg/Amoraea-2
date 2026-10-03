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
    expect(
      isValidWithinScenarioAck('Being there without pushing — that comes through clearly.'),
    ).toBe(false);
  });

  it('resolveWithinScenarioBriefAckForInterview uses a static receipt, not a content reflection', async () => {
    fetchMock.mockResolvedValue('She was expecting celebration, not questions.');
    const { ack, source } = await resolveWithinScenarioBriefAckForInterview({
      messages: [{ role: 'assistant', content: 'What do you think is going on?' }],
      userText: 'Sarah expected celebration, not questions about the job.',
      activeQuestionPreview: 'What do you think is happening for Sarah?',
      interviewSessionId: 'sess-1',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(source).toBe('static');
    expect(ack).not.toMatch(/celebration|questions/i);
    expect(['Got it.', 'Makes sense.', 'That makes a lot of sense.']).toContain(ack);
  });
});
