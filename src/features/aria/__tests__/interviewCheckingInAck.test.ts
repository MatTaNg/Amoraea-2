import {
  buildCheckingInAckOnlySpeech,
  lastAssistantAlreadyAskedQuestion,
  prefixProbeWithCheckingInAck,
  resolveCheckingInActiveQuestionText,
  resolveCheckingInAdvanceProbeBypassingTranscriptGuard,
  transcriptContainsAssessableQuestion,
} from '@features/aria/interviewCheckingInAck';
import {
  looksLikeCheckingInClientOwnedAckAssistantLine,
  looksLikeCheckingInSufficiencyAsk,
} from '@features/aria/metaCommentPatternScoring';
import { looksLikeUnassessableScenarioAnswer } from '@features/aria/interviewAnswerRelevance';
import { shouldForceScenarioBJamesRepairProbe } from '@features/aria/scenarioBProbeLogic';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

describe('interviewCheckingInAck', () => {
  it('detects checking-in sufficiency asks', () => {
    expect(looksLikeCheckingInSufficiencyAsk('Was that enough?')).toBe(true);
    expect(looksLikeCheckingInSufficiencyAsk("Wasn't that enough?")).toBe(true);
    expect(looksLikeCheckingInSufficiencyAsk("Isn't that enough?")).toBe(true);
    expect(looksLikeCheckingInSufficiencyAsk('Did you get that?')).toBe(true);
    expect(looksLikeCheckingInSufficiencyAsk('Is that sufficient?')).toBe(true);
    expect(looksLikeCheckingInSufficiencyAsk('I think James could apologize')).toBe(false);
  });

  it('treats checking-in as unassessable for construct advance', () => {
    expect(looksLikeUnassessableScenarioAnswer('Was that enough?')).toBe(true);
  });

  it('does not force James repair on checking-in alone', () => {
    expect(
      shouldForceScenarioBJamesRepairProbe({
        currentMoment: 2,
        messages: [],
        lastAssistantContent: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        userAnswer: 'Was that enough?',
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(false);
  });

  it('prefixes canonical probe with checking-in ack', () => {
    expect(
      prefixProbeWithCheckingInAck("Yes — that's enough.", 'And if you were James, how would you repair?'),
    ).toBe("Yes — that's enough. And if you were James, how would you repair?");
  });

  it('does not repeat verbatim probe when ack embeds what we are looking for', () => {
    const ack =
      "You said James could have planned something special. What I'm looking for here is what James could have done differently to help Sarah feel appreciated.";
    const probe =
      'What do you think James could have done differently to help Sarah feel appreciated?';
    expect(prefixProbeWithCheckingInAck(ack, probe)).toBe(ack);
  });

  it('detects when the last assistant turn already asked the target question', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, scenarioNumber: 2 },
      {
        role: 'assistant',
        content: `Yes — that's enough. That makes a lot of sense. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
        scenarioNumber: 2,
      },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];

    expect(lastAssistantAlreadyAskedQuestion(messages, SCENARIO_B_JAMES_REPAIR_CANONICAL)).toBe(true);
    expect(lastAssistantAlreadyAskedQuestion(messages, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL)).toBe(false);
  });

  it('ignores polluted lastQuestionTextRef when transcript has the real question', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];
    expect(
      resolveCheckingInActiveQuestionText({
        messages,
        lastQuestionTextRef: "Yes — got it. I'm with you.",
        lastInterviewerContent: '',
        activeScenario: 2,
      }),
    ).toBe(SCENARIO_B_JAMES_REPAIR_CANONICAL);
  });

  it('detects polluted checking-in ack-only assistant lines', () => {
    expect(
      looksLikeCheckingInClientOwnedAckAssistantLine(
        "Yes — that's enough. Got it. Yes — got it. I'm with you.",
      ),
    ).toBe(true);
    expect(
      looksLikeCheckingInClientOwnedAckAssistantLine(
        "What I'm looking for here is Yes — that's enough. Got it.",
      ),
    ).toBe(true);
    expect(
      looksLikeCheckingInClientOwnedAckAssistantLine(
        `Yes — I heard you. You said James should listen. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
      ),
    ).toBe(false);
  });

  it('resolves repair question when the latest assistant turn is polluted meta-ack copy', () => {
    const pollutedAck = "Yes — that's enough. Got it. Yes — got it. I'm with you.";
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'user', content: 'I think James should apologize and listen first.', scenarioNumber: 2 },
      { role: 'assistant', content: pollutedAck, scenarioNumber: 2 },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];

    expect(
      resolveCheckingInActiveQuestionText({
        messages,
        lastQuestionTextRef: pollutedAck,
        lastInterviewerContent: pollutedAck,
        activeScenario: 2,
      }),
    ).toBe(SCENARIO_B_JAMES_REPAIR_CANONICAL);
    expect(transcriptContainsAssessableQuestion(messages, SCENARIO_B_JAMES_REPAIR_CANONICAL)).toBe(
      true,
    );
  });

  it('does not build looking-for clause from polluted ack text', () => {
    const pollutedAck = "Yes — that's enough. Got it. Yes — got it. I'm with you.";
    const spoken = buildCheckingInAckOnlySpeech({
      messages: [],
      priorSubstantiveText:
        'I think there was a pattern of behavior with James and this may be the first time he is genuinely hearing Sarah.',
      activeQuestionPreview: pollutedAck,
      checkingInFrustrationAdjacent: true,
    });

    expect(spoken).not.toMatch(/what i'm looking for here is yes/i);
    expect(spoken).toMatch(/you said/i);
  });

  it('bypasses transcript dedup for repair pivot when repair is not the last assistant turn', () => {
    const flags = {
      shouldForceScenarioBJamesRepairProbe: true,
    } as PreClaudeScenarioConstructProbeFlags;
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, scenarioNumber: 2 },
      { role: 'user', content: 'I would listen first.', scenarioNumber: 2 },
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];

    expect(resolveCheckingInAdvanceProbeBypassingTranscriptGuard(flags, messages)).toBeNull();
    expect(
      resolveCheckingInAdvanceProbeBypassingTranscriptGuard(flags, messages.slice(0, 2)),
    ).toBeNull();
  });

  it('builds ack-only speech with prior reflection and looking-for clause', () => {
    const priorAnswer =
      'I think James should apologize to Sarah and listen to why she felt dismissed before trying to fix anything.';
    const spoken = buildCheckingInAckOnlySpeech({
      messages: [],
      priorSubstantiveText: priorAnswer,
      activeQuestionPreview: SCENARIO_B_JAMES_REPAIR_CANONICAL,
      checkingInFrustrationAdjacent: true,
    });

    expect(spoken).toMatch(/not quite|not quite what i need yet|not quite yet/i);
    expect(spoken).toMatch(/You said/i);
    expect(spoken).toMatch(/what i'm looking for here is/i);
    expect(spoken).toMatch(/how would you repair/i);
    expect(spoken).not.toMatch(/^got it\b/i);
    expect(spoken).not.toMatch(/^yes\s*[—–-]\s*got it/i);
    expect(spoken).not.toMatch(/i'm with you/i);
  });

  it('uses sufficiency confirm only when the prior answer satisfies the active question', () => {
    const priorAnswer =
      'I think James should apologize to Sarah and listen to why she felt dismissed before trying to fix anything.';
    const spoken = buildCheckingInAckOnlySpeech({
      messages: [],
      priorSubstantiveText: priorAnswer,
      activeQuestionPreview: SCENARIO_B_JAMES_REPAIR_CANONICAL,
      priorAnswerSatisfiesActiveQuestion: true,
      checkingInFrustrationAdjacent: true,
    });

    expect(spoken).toMatch(/that'?s enough/i);
    expect(spoken).not.toMatch(/what i'm looking for here is/i);
  });
});
