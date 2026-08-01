import {
  isSituation2ModalAdvancedPastOpening,
  resolveSituation2ExactModalPrompt,
} from '@features/aria/situation2ExactModalPrompt';
import { IRRELEVANT_ANSWER_RETRY_LINE } from '@features/aria/interviewAnswerRelevance';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_2_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';

describe('situation2ExactModalPrompt', () => {
  const s2Intro =
    "Sarah has been job hunting for four months. She gets an offer and calls James from the street. What do you think is going on here?";

  it('returns opening before follow-up probes are delivered', () => {
    const transcript = [{ role: 'assistant', content: s2Intro }];
    expect(resolveSituation2ExactModalPrompt(transcript)).toBe(SCENARIO_2_OPENING);
    expect(isSituation2ModalAdvancedPastOpening(null, SCENARIO_2_OPENING, transcript)).toBe(false);
  });

  it('advances to James-differently after Q2 is delivered', () => {
    const transcript = [
      { role: 'assistant', content: s2Intro },
      { role: 'user', content: 'James missed her emotional needs.' },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
    ];
    expect(resolveSituation2ExactModalPrompt(transcript)).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
    expect(
      isSituation2ModalAdvancedPastOpening(
        { jamesDifferentlyAsked: true },
        SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        transcript,
      ),
    ).toBe(true);
  });

  it('advances to repair-as-James after Q3 is delivered', () => {
    const transcript = [
      { role: 'assistant', content: s2Intro },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      { role: 'user', content: 'He could have listened first.' },
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
    ];
    expect(resolveSituation2ExactModalPrompt(transcript)).toBe(SCENARIO_B_JAMES_REPAIR_CANONICAL);
  });

  it('does not revert to opening when Sarah+James reflection re-triggers scenario detection', () => {
    const reflection =
      'I hear that — James focused on salary details when Sarah needed to feel appreciated.';
    const transcript = [
      { role: 'assistant', content: s2Intro },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      { role: 'user', content: 'He should have validated her feelings.' },
      { role: 'assistant', content: reflection },
    ];
    const delivery = { jamesDifferentlyAsked: true, repairQuestionAsked: false };
    expect(isSituation2ModalAdvancedPastOpening(delivery, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, transcript)).toBe(
      true,
    );
    expect(resolveSituation2ExactModalPrompt(transcript, reflection, delivery)).toBe(
      SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
    );
  });

  it('uses currentSpoken for streaming James-differently and repair probes', () => {
    expect(
      resolveSituation2ExactModalPrompt([], SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL),
    ).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
    expect(resolveSituation2ExactModalPrompt([], SCENARIO_B_JAMES_REPAIR_CANONICAL)).toBe(
      SCENARIO_B_JAMES_REPAIR_CANONICAL,
    );
    expect(
      resolveSituation2ExactModalPrompt(
        [],
        'How do you think James could repair this with Sarah now?',
      ),
    ).toBe(SCENARIO_B_JAMES_REPAIR_CANONICAL);
  });

  it('stays on repair after cut-off retry even when delivery ref only has jamesDifferentlyAsked', () => {
    const transcript = [
      { role: 'assistant', content: s2Intro },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      { role: 'user', content: 'He could have listened first.' },
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      { role: 'user', content: "I'll ask Sarah if she'd like to be celebrated and commit to that." },
      { role: 'assistant', content: IRRELEVANT_ANSWER_RETRY_LINE },
    ];
    const delivery = { jamesDifferentlyAsked: true, repairQuestionAsked: false };
    expect(resolveSituation2ExactModalPrompt(transcript, null, delivery)).toBe(
      SCENARIO_B_JAMES_REPAIR_CANONICAL,
    );
  });

  it('stays on James-differently when cut-off retry follows James-differently answer', () => {
    const transcript = [
      { role: 'assistant', content: s2Intro },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      { role: 'user', content: 'I think that James could have' },
      { role: 'assistant', content: IRRELEVANT_ANSWER_RETRY_LINE },
    ];
    expect(resolveSituation2ExactModalPrompt(transcript)).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });
});
