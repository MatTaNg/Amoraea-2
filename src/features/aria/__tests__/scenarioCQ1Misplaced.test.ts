import { isMisplacedScenarioCQ1Answer, isScenarioCQ1Prompt } from '../probeAndScoringUtils';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '../interviewDisengagementProbeCopy';
import {
  coerceScenarioCRepairQuestionForTts,
  coerceScenarioCQ1PrescriptiveStripForTts,
  coerceInterviewReplayTtsText,
  isIncompleteScenarioCRepairQuestionTail,
  looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion,
  looksLikeScenarioCDanielPrescriptiveQ1Paraphrase,
  looksLikeScenarioCDanielComeBackMisparaphraseQuestion,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
  looksLikeScenarioCRepairAsDanielQuestion,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  stripScenarioCSophiePerspectiveStreamingEcho,
} from '../scenarioCPromptDetection';

describe('Scenario C Q1 misplaced answer detection', () => {
  it('isScenarioCQ1Prompt matches Daniel opening', () => {
    expect(
      isScenarioCQ1Prompt(
        "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?"
      )
    ).toBe(true);
  });

  it('isScenarioCQ1Prompt still matches legacy scripted line for older transcripts', () => {
    expect(
      isScenarioCQ1Prompt(
        "When Daniel comes back and says 'I didn't know how' — what do you make of that?"
      )
    ).toBe(true);
  });

  it('isScenarioCQ1Prompt matches when model uses typographic apostrophe in didn’t', () => {
    const withCurly = "When Daniel comes back and says 'I didn\u2019t know what to say' — what do you make of that?";
    expect(isScenarioCQ1Prompt(withCurly)).toBe(true);
  });

  it('isScenarioCQ1Prompt rejects repair question', () => {
    expect(
      isScenarioCQ1Prompt('How do you think this situation could be repaired?')
    ).toBe(false);
  });

  it('detects and replaces prescriptive Daniel back-in-room paraphrase', () => {
    const bad = "What should Daniel do when he's back in the room?";
    expect(looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(bad)).toBe(true);
    expect(coerceScenarioCQ1PrescriptiveStripForTts(bad)).toContain('what do you make of that');
  });

  it('coerceScenarioCQ1PrescriptiveStripForTts advances to Sophie probe when Q1 already satisfied', () => {
    const sessionAnswer =
      "Yeah, he needs tools and techniques because he's avoided real conversation.";
    const prescriptiveReplay = "What should Daniel actually do or say to Sophie in that moment when he comes back?";
    const messages = [
      { role: 'user', content: sessionAnswer, scenarioNumber: 3 },
      {
        role: 'assistant',
        content:
          "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
        scenarioNumber: 3,
      },
    ];
    expect(coerceScenarioCQ1PrescriptiveStripForTts(prescriptiveReplay, messages)).toBe(
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );
  });

  it('detects session-log Daniel handle prescriptive paraphrase and coerces after Q1 satisfied', () => {
    const sessionAnswer =
      "Yeah, make of it that he needs some help in knowing some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoiding it.";
    const offScript =
      'Got it — how would you actually have Daniel handle that moment when he walks back in and Sophie is still upset?';
    const messages = [{ role: 'user', content: sessionAnswer, scenarioNumber: 3 }];
    expect(looksLikeScenarioCDanielPrescriptiveQ1Paraphrase(offScript)).toBe(true);
    expect(coerceScenarioCQ1PrescriptiveStripForTts(offScript, messages)).toBe(
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );
  });

  it('stripScenarioCSophiePerspectiveStreamingEcho keeps ack only after probe already spoken', () => {
    const duplicate =
      'That makes a lot of sense. What do you think this pattern of leaving has been like for Sophie over time?';
    expect(stripScenarioCSophiePerspectiveStreamingEcho(duplicate, true)).toBe(
      'That makes a lot of sense',
    );
    expect(
      stripScenarioCSophiePerspectiveStreamingEcho(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE, true),
    ).toBeNull();
  });

  it('coerces Daniel shoes role-play paraphrase to canonical repair Q2', () => {
    const bad =
      "Yet if you were in Daniel's shoes how would you repair things with Sophie";
    expect(looksLikeScenarioCRepairAsDanielQuestion(bad)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(bad)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('coerces Sophie-receive misparaphrase to canonical repair Q2', () => {
    const bad =
      "Makes sense. And when he comes back — how should Sophie receive";
    expect(looksLikeScenarioCSophieReceiveMisparaphraseQuestion(bad)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(bad)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('detects and replaces Sophie-respond-when-Daniel-returns misparaphrase', () => {
    const bad = 'Got it. How would you want Sophie to respond when Daniel comes back?';
    expect(looksLikeScenarioCSophieReceiveMisparaphraseQuestion(bad)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(bad)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('detects Sophie-to-do-with-Daniel misparaphrase from session logs', () => {
    const bad = 'Got it. And what would you want Sophie to do with what Daniel just';
    expect(looksLikeScenarioCSophieReceiveMisparaphraseQuestion(bad)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(bad)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('detects "what do you think Sophie should do when Daniel comes back" misparaphrase', () => {
    const bad =
      "And what do you think Sophie should do when Daniel comes back?";
    expect(looksLikeScenarioCSophieReceiveMisparaphraseQuestion(bad)).toBe(true);
    expect(looksLikeScenarioCDanielComeBackMisparaphraseQuestion(bad)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(bad)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('expands truncated tab-restore repair tail to canonical Q2', () => {
    expect(isIncompleteScenarioCRepairQuestionTail('situation could be repaired')).toBe(true);
    expect(coerceInterviewReplayTtsText('situation could be repaired', [])).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('flags repair logistics without Daniel-internal read', () => {
    const a =
      'They should sit down and make a plan — maybe couples therapy and ground rules for timeouts so both feel heard.';
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });

  it('does not flag interpretation of Daniel line', () => {
    const a =
      "That line sounds like he's ashamed he kept bailing — he didn't know how to come back without flooding, not that he didn't care.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(false);
  });

  it('flags prescription + threshold verdict when user never engages the quoted line', () => {
    const a =
      "Daniel needs to stop leaving. That's the core issue. You can't keep walking out on someone and expect the relationship to work. Thirty minutes is too long. Daniel needs to learn to stay present even when it's uncomfortable. Sophie is right to be frustrated. I'd say if this happens a fourth time without real change, Sophie should seriously consider whether this relationship is working.";
    expect(isMisplacedScenarioCQ1Answer(a)).toBe(true);
  });
});
