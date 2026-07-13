import { SCENARIO_B_VIGNETTE } from '@/constants/scenarioBVignette';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { SCENARIO_1_VIGNETTE, SCENARIO_3_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import {
  __substituteCanonicalInterviewScenarioBodiesForTtsTest,
  substituteCanonicalInterviewScenarioBodiesForTts,
} from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';

describe('substituteCanonicalInterviewScenarioBodiesForTts', () => {
  it('replaces paraphrased Scenario 1 vignette with canonical copy', () => {
    const paraphrased =
      "Here's the first situation. Emma and Ryan are at dinner when Ryan's mom calls for twenty-five minutes. Emma pays and seems upset. Later she tells Ryan she thinks he always puts family first. Ryan pushes back. Emma says he has made that very clear. What's going on between them?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(SCENARIO_1_VIGNETTE);
    expect(out).toContain("What's going on between these two?");
    expect(out).not.toMatch(/What's going on between them\?/);
  });

  it('replaces paraphrased Scenario 2 vignette with canonical copy', () => {
    const paraphrased =
      "Sarah has been job hunting for months. She gets a job offer and James celebrates but focuses on salary details. Sarah cries. James says don't cry. They fight the next day. What do you think is happening here?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(SCENARIO_B_VIGNETTE.slice(0, 40));
    expect(out).toContain('What do you think is going on here?');
    expect(out).not.toMatch(/What do you think is happening here\?/);
  });

  it('replaces Scenario 2 vignette when model paraphrases Sarah and James together', () => {
    const paraphrased =
      "Here's the next situation: Sarah and James have been together for two years. Sarah mentions in passing that she wishes James would celebrate more. What do you think is going on here?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(SCENARIO_B_VIGNETTE);
    expect(out).toContain('What do you think is going on here?');
    expect(out).not.toMatch(/together for two years/i);
  });

  it('replaces Scenario 2 vignette when paraphrase omits "fight starts" ending', () => {
    const paraphrased =
      "That's the end of that scenario. Here's the next situation. Sarah has been looking for work for months and finally gets an offer. James is busy on a deadline but tries to celebrate. Sarah feels unappreciated. What do you think is going on here?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(SCENARIO_B_VIGNETTE);
    expect(out).toContain('What do you think is going on here?');
  });

  it('replaces paraphrased Scenario 3 vignette and opening with canonical copy', () => {
    const paraphrased =
      "Sophie and Daniel keep arguing. Daniel walks away for ten minutes and comes back saying he didn't know how to respond. Sophie is still angry. When Daniel says he was unsure what to say, what's your read?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain('same argument');
    expect(out).toContain("When Daniel comes back and says 'I didn't know what to say'");
  });

  it('replaces Sophie/Daniel "together for two years" fiction with canonical Scenario 3', () => {
    const fiction =
      "That's the second one done. One more situation and then we'll get personal.\n\nHere's the next situation:\n\nSophie and Daniel have been together for two years. When they fight, Daniel tends to go quiet and leave the room. Sophie says she feels abandoned when this happens. Daniel says he does it because he needs space to cool down.";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(fiction);
    expect(out).toContain(SCENARIO_3_VIGNETTE);
    expect(out).toContain("When Daniel comes back and says 'I didn't know what to say'");
    expect(out).not.toMatch(/have been together for two years/i);
    expect(out).not.toMatch(/feels abandoned/i);
  });

  it('replaces paraphrased Moment 4 grudge prompt with Show Scenario modal copy', () => {
    const paraphrased =
      "Good work — you finished the three situations. Think about someone you really didn't like and tell me what went wrong.";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(MOMENT_4_GRUDGE_QUESTION_TEXT);
    expect(out).toContain('Good work');
  });

  it('replaces paraphrased Moment 5 conflict prompt with Show Scenario modal copy', () => {
    const paraphrased =
      "Here's one more question. Tell me about a specific conflict with someone important in your life and whether it got resolved.";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(out).toContain("Here's one more question");
  });

  it('leaves already-canonical Scenario 1 vignette unchanged', () => {
    const canonical = `${SCENARIO_1_VIGNETTE}\n\nWhat's going on between these two?`;
    expect(substituteCanonicalInterviewScenarioBodiesForTts(canonical)).toBe(canonical);
  });

  it('replaces legacy Sarah/James chores vignette with canonical job-offer copy', () => {
    const legacy =
      "Sarah and James have been together for two years. Sarah has been feeling underappreciated lately. One evening, after a long day, she brings it up. She says 'I just feel like you don't notice the things I do around here.' James responds by listing all the things he does. What do you think is going on here?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(legacy);
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out).not.toMatch(/feeling underappreciated lately/i);
    expect(out).not.toMatch(/don't notice the things I do/i);
  });

  it('replaces birthday-dinner wrong S2 variant with canonical job-offer copy', () => {
    const wrong =
      "Here's the next situation. Sarah has been planning a birthday dinner for herself. She tells James about it two weeks in advance. James says he'll be there. Two days before, James texts to say he can't make it because of a work thing. Sarah doesn't respond to the text. They get into a bigger fight. What do you think is going on here?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(wrong);
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out).not.toMatch(/birthday dinner/i);
    expect(out).not.toMatch(/two weeks in advance/i);
  });

  it('replaces working-late / promotion wrong S2 variant with canonical job-offer copy', () => {
    const wrong =
      "Nice work, Matt. Here's the next situation. Sarah and James have been together for two years. Sarah has been working late most nights. James says 'Must be nice to finally have good news for once.' James later admits he's been keeping score on his phone. What do you think Sarah felt when James made that comment?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(wrong);
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out).toContain('What do you think is going on here?');
    expect(out).not.toMatch(/working late most nights/i);
    expect(out).not.toMatch(/Must be nice to finally/i);
    expect(out).not.toMatch(/list on his phone/i);
  });

  it('strips concatenated wrong S2 variants when model appends multiple legacy vignettes', () => {
    const wrong =
      "Got it. That's a wrap on this situation. Nice work, Matt — you read Emma's line as accumulated frustration. Here's the next situation. Sarah has been planning a birthday dinner for herself. She tells James about it two weeks in advance. James texts he can't make it. They fight. --- Sarah and James have been together for two years. Sarah has been working late. James says 'Must be nice to finally have good news for once.' What do you think Sarah felt?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(wrong);
    expect(out).toContain('Nice work, Matt');
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out).not.toMatch(/birthday dinner/i);
    expect(out).not.toMatch(/working late/i);
    expect(out).not.toMatch(/Must be nice/i);
  });

  it('strips legacy S2 vignette when model concatenates wrong variant before canonical copy', () => {
    const legacy =
      "Sarah and James have been together for two years. Sarah has been feeling underappreciated lately. What do you think is going on here?";
    const mixed = `Here's the next situation.\n\n${legacy}\n\n${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\nWhat do you think is going on here?`;
    const out = substituteCanonicalInterviewScenarioBodiesForTts(mixed);
    expect(out).toContain("Here's the next situation");
    expect(out).toContain(SHOW_SCENARIO_2_VIGNETTE_EXACT);
    expect(out).not.toMatch(/feeling underappreciated lately/i);
    expect((out.match(/job hunting for four months/g) ?? []).length).toBe(1);
  });

  it('preserves S3→M4 reflection when model paraphrases grudge opener as Is there someone', () => {
    const paraphrased =
      "That's the end of the three described situations. Good work, Matt — you recognized Daniel's genuine struggle to find words and how Sophie experienced his leaving as repeated dismissal. Is there someone in your life — or someone from your past — that you've had a really hard time with?";
    const out = substituteCanonicalInterviewScenarioBodiesForTts(paraphrased);
    expect(out).toContain(MOMENT_4_GRUDGE_QUESTION_TEXT);
    expect(out).toContain('end of the three described situations');
    expect(out).toContain('Good work, Matt');
  });

  it('substituteMoment4GrudgeCardForTts replaces question-only paraphrase', () => {
    const out = __substituteCanonicalInterviewScenarioBodiesForTtsTest.substituteMoment4GrudgeCardForTts(
      'Have you ever held a grudge against someone close to you?',
    );
    expect(out).toBe(MOMENT_4_GRUDGE_QUESTION_TEXT);
  });

  it('substituteMoment5ConflictQuestionForTts replaces question-only paraphrase', () => {
    const out = __substituteCanonicalInterviewScenarioBodiesForTtsTest.substituteMoment5ConflictQuestionForTts(
      'Think of a time when you had a conflict with someone important to you. How did you two work it out?',
    );
    expect(out).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('does not replace Scenario B James-differently follow-up with Situation 2 opening Q1', () => {
    const jamesDifferently =
      'What do you think James could have done differently to help Sarah feel appreciated?';
    expect(substituteCanonicalInterviewScenarioBodiesForTts(jamesDifferently)).toBe(jamesDifferently);
  });

  it('does not replace Scenario B repair-as-James follow-up with Situation 2 opening Q1', () => {
    const repairAsJames = 'And if you were James, how would you repair?';
    expect(substituteCanonicalInterviewScenarioBodiesForTts(repairAsJames)).toBe(repairAsJames);
  });

  it('does not rewrite S2 closing reflection that names Sarah/James/celebrate into the vignette', () => {
    const reflection =
      "Nice work, Matt — you recognized that James's instinct to ask practical questions missed what Sarah actually needed in that moment, which was for him to just be present and celebrate her.";
    expect(substituteCanonicalInterviewScenarioBodiesForTts(reflection)).toBe(reflection);
    expect(substituteCanonicalInterviewScenarioBodiesForTts(reflection)).not.toMatch(
      /job hunting for four months/i,
    );
  });
});
