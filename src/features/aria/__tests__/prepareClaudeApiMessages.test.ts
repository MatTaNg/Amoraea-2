import { prepareClaudeApiMessages } from '@features/aria/prepareClaudeApiMessages';

describe('prepareClaudeApiMessages', () => {
  it('keeps assistant turns before the final user message', () => {
    expect(
      prepareClaudeApiMessages([
        { role: 'assistant', content: 'What do you think?' },
        { role: 'user', content: 'She felt dismissed.' },
      ]),
    ).toEqual([
      { role: 'assistant', content: 'What do you think?' },
      { role: 'user', content: 'She felt dismissed.' },
    ]);
  });

  it('strips trailing assistant messages after the last user turn', () => {
    expect(
      prepareClaudeApiMessages([
        { role: 'user', content: 'Earlier answer.' },
        { role: 'assistant', content: 'Thanks.' },
        { role: 'assistant', content: 'Follow-up without user reply yet.' },
      ]),
    ).toEqual([{ role: 'user', content: 'Earlier answer.' }]);
  });

  it('throws when no user message remains', () => {
    expect(() =>
      prepareClaudeApiMessages([{ role: 'assistant', content: 'Only assistant here.' }]),
    ).toThrow(/user message/i);
  });
});
