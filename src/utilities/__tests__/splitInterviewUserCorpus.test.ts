import {
  parseInterviewTranscriptMessages,
  splitUserCorpusScenarioVsPersonal,
} from '../../../supabase/functions/_shared/splitInterviewUserCorpus';

describe('splitUserCorpusScenarioVsPersonal', () => {
  it('splits when handoff uses Unicode apostrophe in We’ve', () => {
    const transcript = [
      { role: 'user', content: 'Ryan is emotionally immature.' },
      {
        role: 'assistant',
        content:
          'We\u2019ve finished the three situations — the last two questions are more personal. Tell me about a grudge?',
      },
      { role: 'user', content: 'I had a difficult relationship with my father. I am working on it in therapy.' },
    ];
    const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(transcript);
    expect(scenarioCorpus).toContain('emotionally immature');
    expect(personalCorpus).toContain('therapy');
    expect(personalCorpus.length).toBeGreaterThan(40);
  });

  it('matches ASCII apostrophe handoff', () => {
    const transcript = [
      { role: 'user', content: 'Scenario answer.' },
      {
        role: 'assistant',
        content: "We've finished the three situations — more personal now.",
      },
      { role: 'user', content: 'Personal answer with therapy and not fully there yet.' },
    ];
    const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(transcript);
    expect(scenarioCorpus).toContain('scenario');
    expect(personalCorpus).toContain('therapy');
  });

  it('treats Assistant role case-insensitively', () => {
    const transcript = [
      { role: 'user', content: 'x' },
      {
        role: 'Assistant',
        content: "We've finished the three situations — personal.",
      },
      { role: 'user', content: 'y' },
    ];
    const { personalCorpus } = splitUserCorpusScenarioVsPersonal(transcript);
    expect(personalCorpus.trim().length).toBeGreaterThan(0);
  });

  it('falls back to grudge prompt when "finished the three situations" is split across assistant bubbles', () => {
    const transcript = [
      { role: 'user', content: 'Verdict: emotionally immature.' },
      { role: 'assistant', content: 'Good work, you just finished the ' },
      {
        role: 'assistant',
        content:
          'three situations — two questions left. More about you.\n\nHave you ever held a grudge against someone?',
      },
      { role: 'user', content: 'Therapy helped. I am working on boundaries.' },
    ];
    const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(transcript);
    expect(scenarioCorpus).toContain('emotionally immature');
    expect(personalCorpus).toContain('therapy');
  });

  it('parses stringified JSON transcript', () => {
    const arr = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: "We've finished the three situations — personal." },
      { role: 'user', content: 'therapy and working on myself' },
    ];
    const parsed = parseInterviewTranscriptMessages(JSON.stringify(arr));
    const { personalCorpus } = splitUserCorpusScenarioVsPersonal(parsed);
    expect(personalCorpus).toContain('therapy');
  });

  it('matches production MOMENT_4_HANDOFF copy (no We’ve / no word "personal")', () => {
    const handoff =
      "Good work, you just finished the three situations, there are only two questions left. These questions are more about you. Heres the first one.\n\nHave you ever held a grudge";
    const transcript = [
      { role: 'user', content: 'Scenario verdict emotionally immature.' },
      { role: 'assistant', content: handoff },
      { role: 'user', content: 'I am working on it in therapy and not fully there yet.' },
    ];
    const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(transcript);
    expect(scenarioCorpus).toContain('emotionally immature');
    expect(personalCorpus).toContain('therapy');
  });
});
