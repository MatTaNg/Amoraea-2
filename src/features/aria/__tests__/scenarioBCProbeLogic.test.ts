import {
  coerceScenarioBQ1QuestionForTts,
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
  assistantTextLooksLikeScenarioBPrematureAnswerRedirect,
  collapseScenarioBJamesSayToJamesWithRepairDuplicate,
  isBeforeFightOnlyScenarioBJamesQ2Paraphrase,
  isDeliveredScenarioBJamesDifferentlyProbe,
  isIncompleteScenarioBPrematureRepairRedirectLeadSentence,
  isIncompleteScenarioBQ1LeadSentence,
  isIncompleteScenarioBJamesDifferentlyLeadSentence,
  isIncompleteScenarioBJamesRepairLeadSentence,
  isIncompleteScenarioBJamesRepairUserAnswer,
  isIncompleteScenarioBJamesSayToJamesLeadSentence,
  looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBJamesSayToJamesRolePlayQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
  isScenarioBBoundaryReflectionWithoutNextVignette,
  isScenarioBQ1Prompt,
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
  scenarioBJamesRepairProbeAlreadySatisfied,
  streamMissedScenarioBScriptedProbeDelivery,
  userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1,
  userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1,
  shouldSkipScenarioBRepairAsJamesProbe,
  userSidesEntirelyWithJames,
  shouldSuppressPrematureScenarioBJamesQ2Coercion,
  prepareScenarioBEmotionAfterModalForTts,
} from '../scenarioBProbeLogic';
import { isGenericTruncatedAssistantDraft } from '../interviewTruncatedAssistantDraft';
import { isScenarioCQ2Prompt } from '../scenarioCProbeLogic';
import {
  coerceScenarioCRepairAsDanielQuestionForTts,
  coerceScenarioCRepairQuestionForTts,
  coerceScenarioCQ1PrescriptiveStripForTts,
  coerceScenarioCSophiePerspectiveQuestionForTts,
  isIncompleteScenarioCSophiePerspectiveLeadSentence,
  looksLikeScenarioCSophiePerspectiveQuestion,
  looksLikeScenarioCSophieRolePlayMisparaphraseQuestion,
  coerceScenarioCSophieRolePlayQuestionForTts,
  looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion,
  looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion,
  isIncompleteScenarioCSophieSayToLeadSentence,
  scenarioCRepairConstructStillPending,
  shouldSuppressScenarioCSophiePerspectiveReplay,
  scenarioCSophiePerspectivePrerequisiteMet,
  scenarioCUserAnswerHasSubstantiveRepairContent,
  shouldForceScenarioCRepairProbe,
  shouldForceScenarioCSophiePerspectiveProbe,
  userAnswerSatisfiesScenarioCQ1Interpretation,
  scenarioCQ1InterpretationSatisfiedInTranscript,
  resolveScenarioCNextProbeAfterSatisfiedQ1,
  shouldSuppressScenarioCQ1VerbatimReplay,
  looksLikeScenarioCRepairWithUserAnswerEcho,
  looksLikeScenarioCRepairAsDanielQuestion,
  userAnswerSatisfiesScenarioCSophiePerspectiveProbe,
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  scenarioCSophiePerspectiveAnsweredInTranscript,
  shouldSuppressScenarioCRepairReplay,
  shouldSuppressScenarioCQ1UntilVignetteSetup,
} from '../scenarioCPromptDetection';
import { SHOW_SCENARIO_3_VIGNETTE_EXACT } from '../interviewShowScenarioExactCopy';
import { SKIP_REQUEST_CONFIRMATION_PROMPT_LINE } from '../metaCommentSkipFrustration';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '../interviewDisengagementProbeCopy';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '../scenarioCPromptDetection';

describe('scenarioC Sophie role-play misparaphrase', () => {
  const sessionLogQuestion =
    'Makes sense. Now, how would you handle it if you were Sophie in this moment';

  it('detects off-script Sophie role-play', () => {
    expect(looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(sessionLogQuestion)).toBe(true);
    expect(looksLikeScenarioCSophiePerspectiveQuestion(sessionLogQuestion)).toBe(false);
  });

  it('coerces Sophie role-play to canonical Sophie-perspective probe', () => {
    expect(coerceScenarioCSophieRolePlayQuestionForTts(sessionLogQuestion)).toBe(
      `Makes sense. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`,
    );
  });
});

describe('scenarioC Sophie perspective TTS coercion', () => {
  it('coerceScenarioCSophiePerspectiveQuestionForTts expands Got it what do you think cutoff', () => {
    expect(
      coerceScenarioCSophiePerspectiveQuestionForTts('Got it what do you think'),
    ).toBe(`Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`);
    expect(
      coerceScenarioCSophiePerspectiveQuestionForTts(
        'Got it. What do you think this pattern of leaving has been like for Sophie',
      ),
    ).toBe(`Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`);
    expect(isIncompleteScenarioCSophiePerspectiveLeadSentence('Got it what do you think')).toBe(true);
  });

  it('detects and coerces off-script next-steps follow-up to canonical Sophie probe', () => {
    const sessionLogQuestion = 'Got it. And what should happen next between them?';
    expect(looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(sessionLogQuestion)).toBe(true);
    expect(looksLikeScenarioCSophiePerspectiveQuestion(sessionLogQuestion)).toBe(false);
    expect(coerceScenarioCSophiePerspectiveQuestionForTts(sessionLogQuestion)).toBe(
      `Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`,
    );
  });

  it('detects and coerces off-script say-to-Sophie follow-up to canonical Sophie probe', () => {
    const sessionLogQuestion = 'Still upset — what would you say to Sophie?';
    expect(looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(sessionLogQuestion)).toBe(true);
    expect(looksLikeScenarioCSophiePerspectiveQuestion(sessionLogQuestion)).toBe(false);
    expect(coerceScenarioCSophiePerspectiveQuestionForTts(sessionLogQuestion)).toBe(
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );
    expect(isIncompleteScenarioCSophieSayToLeadSentence('What would you say to Soph')).toBe(true);
  });
});

describe('scenarioC repair Q2 skip', () => {
  const sophiePerspective = SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  const scenarioCQ1 =
    "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";

  it('shouldSuppressScenarioCQ1UntilVignetteSetup blocks Q1 when Sophie/Daniel setup missing', () => {
    expect(
      shouldSuppressScenarioCQ1UntilVignetteSetup({
        spoken: scenarioCQ1,
        fullStreamText: scenarioCQ1,
        spokenCompleteText: '',
        messages: [],
      }),
    ).toBe(true);
    expect(
      shouldSuppressScenarioCQ1UntilVignetteSetup({
        spoken: scenarioCQ1,
        fullStreamText: `${SHOW_SCENARIO_3_VIGNETTE_EXACT}\n\n${scenarioCQ1}`,
        spokenCompleteText: '',
        messages: [],
      }),
    ).toBe(false);
    expect(
      shouldSuppressScenarioCQ1UntilVignetteSetup({
        spoken: scenarioCQ1,
        fullStreamText: scenarioCQ1,
        spokenCompleteText: '',
        messages: [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
      }),
    ).toBe(false);
  });

  const repairAnswer =
    "Daniel needs to stop leaving. They need to figure out why he's leaving, otherwise they'll never be repaired.";

  it('scenarioCUserAnswerHasSubstantiveRepairContent detects repair prescriptions', () => {
    expect(scenarioCUserAnswerHasSubstantiveRepairContent(repairAnswer)).toBe(true);
  });

  it('scenarioCUserAnswerHasSubstantiveRepairContent detects honest-conversation repair from session logs', () => {
    const sessionAnswer =
      'A sit down and honest conversation is the only way the situation can be repaired when this was just a stay as a sticking point for our';
    expect(scenarioCUserAnswerHasSubstantiveRepairContent(sessionAnswer)).toBe(true);
  });

  it('scenarioCUserAnswerHasSubstantiveRepairContent detects figure-out-leaving repair without explicit repair keyword', () => {
    const sessionAnswer =
      'They need to figure out why Daniel keeps leaving, and he needs tools to self-regulate himself.';
    expect(scenarioCUserAnswerHasSubstantiveRepairContent(sessionAnswer)).toBe(true);
    expect(
      scenarioCRepairConstructStillPending([
        { role: 'assistant', content: scenarioCQ1 },
        { role: 'user', content: 'Daniel felt at a loss about what to say next.' },
        { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
        { role: 'user', content: 'Sophie probably felt dismissed when he walked out.' },
        { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
        { role: 'user', content: sessionAnswer },
      ]),
    ).toBe(false);
  });

  it('shouldForceScenarioCSophiePerspectiveProbe fires after Q1 when Sophie not yet delivered', () => {
    const danielOnlyAnswer =
      "Daniel felt genuinely at a loss about what to say next. He had unresolved things he wanted to say out loud, but he doesn't know how to say them.";
    expect(
      shouldForceScenarioCSophiePerspectiveProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: scenarioCQ1 },
          { role: 'user', content: danielOnlyAnswer },
        ],
        lastAssistantContent: scenarioCQ1,
        userAnswer: danielOnlyAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(true);
  });

  it('shouldForceScenarioCRepairProbe does not fire after Q1 when Sophie perspective not yet satisfied', () => {
    const danielOnlyAnswer =
      "Daniel felt genuinely at a loss about what to say next. He had unresolved things he wanted to say out loud, but he doesn't know how to say them.";
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: scenarioCQ1 },
          { role: 'user', content: 'Earlier partial answer in same scenario.' },
          { role: 'assistant', content: scenarioCQ1 },
          { role: 'user', content: danielOnlyAnswer },
        ],
        lastAssistantContent: scenarioCQ1,
        userAnswer: danielOnlyAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(false);
    expect(scenarioCSophiePerspectivePrerequisiteMet([{ role: 'assistant', content: scenarioCQ1 }])).toBe(
      false,
    );
  });

  it('shouldForceScenarioCRepairProbe returns false when repairProbeDelivered and construct satisfied', () => {
    const repairAnswer =
      'Daniel could come back and say he was overwhelmed, then ask Sophie what she needs from him when things get heated.';
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: scenarioCQ1 },
          { role: 'user', content: 'Daniel was overwhelmed.' },
          { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
          { role: 'user', content: 'Sophie felt abandoned when Daniel walked away.' },
          { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
          { role: 'user', content: repairAnswer },
        ],
        lastAssistantContent: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
        userAnswer: repairAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
        repairProbeDelivered: true,
      }),
    ).toBe(false);
  });

  it('shouldForceScenarioCRepairProbe re-fires when repair was delivered but construct still pending', () => {
    const sophieAnswer =
      'Just really a lot of hurt and rejection and abandonment. It would really suck to have someone keep leaving in a resolution.';
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: scenarioCQ1 },
          { role: 'user', content: 'Daniel was overwhelmed.' },
          { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
          { role: 'user', content: sophieAnswer },
          { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
        ],
        lastAssistantContent: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
        userAnswer: sophieAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
        repairProbeDelivered: true,
      }),
    ).toBe(true);
  });

  it('shouldForceScenarioCRepairProbe fires after Q1 when user already inferred Sophie experience', () => {
    const answerWithSophie =
      "Daniel feels overwhelmed when he comes back, and Sophie has probably felt abandoned each time he leaves — waiting for him to finally stay.";
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [{ role: 'assistant', content: scenarioCQ1 }],
        lastAssistantContent: scenarioCQ1,
        userAnswer: answerWithSophie,
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(true);
    expect(scenarioCSophiePerspectivePrerequisiteMet([], answerWithSophie)).toBe(true);
  });

  it('scenarioCRepairConstructStillPending blocks advance when repair answered before Sophie probe', () => {
    const prematureRepairAnswer =
      'A sit down and honest conversation is the only way the situation can be repaired, or this would just stand as a sticking point forever.';
    expect(
      scenarioCRepairConstructStillPending([
        { role: 'assistant', content: scenarioCQ1 },
        { role: 'user', content: 'Daniel felt at a loss about what to say next.' },
        { role: 'assistant', content: 'How do you think this situation could be repaired?' },
        { role: 'user', content: prematureRepairAnswer },
      ]),
    ).toBe(true);
  });

  it('scenarioCRepairConstructStillPending is false when a personal grudge answer follows repair Q2', () => {
    expect(
      scenarioCRepairConstructStillPending([
        { role: 'assistant', content: scenarioCQ1 },
        { role: 'user', content: 'Daniel felt at a loss about what to say next.' },
        { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
        { role: 'user', content: 'They should talk honestly about how leaving makes her feel.' },
        {
          role: 'user',
          content:
            'My former roommate and I had a huge falling out over rent and we have not spoken in two years.',
        },
      ]),
    ).toBe(false);
  });

  it('scenarioCRepairConstructStillPending is false when grudge question was delivered after repair', () => {
    expect(
      scenarioCRepairConstructStillPending([
        { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
        { role: 'user', content: 'Daniel should apologize and stay to talk.' },
        {
          role: 'assistant',
          content:
            "Have you ever held a grudge against someone, or had someone in your life you really did not like?",
        },
      ]),
    ).toBe(false);
  });

  it('shouldForceScenarioCRepairProbe skips when Sophie-perspective answer already repairs', () => {
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: sophiePerspective },
          { role: 'user', content: repairAnswer },
        ],
        lastAssistantContent: sophiePerspective,
        userAnswer: repairAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(false);
  });

  it('shouldForceScenarioCRepairProbe fires after Sophie answer when last assistant is skip confirmation', () => {
    const sophieWithAck = `Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    const thinAnswer = "She's probably annoyed.";
    expect(
      shouldForceScenarioCRepairProbe({
        currentMoment: 3,
        currentScenario: 3,
        messages: [
          { role: 'assistant', content: sophieWithAck },
          { role: 'assistant', content: SKIP_REQUEST_CONFIRMATION_PROMPT_LINE },
          { role: 'user', content: thinAnswer },
        ],
        lastAssistantContent: SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
        lastQuestionText: sophieWithAck,
        userAnswer: thinAnswer,
        suppressForcedConstructProbesForMetaFrustration: false,
      }),
    ).toBe(true);
  });

  it('scenarioCRepairConstructStillPending is true after Sophie answer without repair Q2', () => {
    const sophieWithAck = `Got it. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    expect(
      scenarioCRepairConstructStillPending([
        { role: 'assistant', content: sophieWithAck },
        { role: 'user', content: "She's probably annoyed." },
      ]),
    ).toBe(true);
  });

  it('userAnswerSatisfiesScenarioCQ1Interpretation accepts tools/EQ read from session logs', () => {
    const sessionAnswer =
      "Yeah, I may give it that he needs some help and knowing how some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoided";
    expect(userAnswerSatisfiesScenarioCQ1Interpretation(sessionAnswer)).toBe(true);
  });

  it('scenarioCQ1InterpretationSatisfiedInTranscript detects prior interpretive answer before Q1 replay', () => {
    const sessionAnswer =
      "Yeah, I may give it that he needs some help and knowing how some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoided";
    const messages = [
      { role: 'user', content: sessionAnswer, scenarioNumber: 3 },
      {
        role: 'assistant',
        content:
          "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
        scenarioNumber: 3,
      },
    ];
    expect(scenarioCQ1InterpretationSatisfiedInTranscript(messages)).toBe(true);
    expect(resolveScenarioCNextProbeAfterSatisfiedQ1(messages)).toBe(
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );
  });

  it('scenarioCQ1InterpretationSatisfiedInTranscript accepts user after Q1 without scenarioNumber tag', () => {
    const sessionAnswer =
      "Yeah, I make of it that he needs some help in knowing some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoided.";
    const messages = [
      {
        role: 'assistant',
        content:
          "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
      },
      { role: 'user', content: sessionAnswer },
    ];
    expect(scenarioCQ1InterpretationSatisfiedInTranscript(messages)).toBe(true);
    expect(resolveScenarioCNextProbeAfterSatisfiedQ1(messages)).toBe(
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );
  });

  it('resolveScenarioCNextProbeAfterSatisfiedQ1 advances to repair Q2 after Sophie inferred', () => {
    const sessionAnswer =
      "Yeah, he needs tools and techniques because he's avoided real conversation.";
    const messages = [
      { role: 'user', content: sessionAnswer, scenarioNumber: 3 },
      {
        role: 'user',
        content: 'Sophie probably feels abandoned every time he walks out.',
        scenarioNumber: 3,
      },
    ];
    expect(resolveScenarioCNextProbeAfterSatisfiedQ1(messages)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('shouldSuppressScenarioCSophiePerspectiveReplay is true after repair Q2 is satisfied', () => {
    const repairQ = 'How do you think this situation could be repaired?';
    expect(
      shouldSuppressScenarioCSophiePerspectiveReplay([
        { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
        { role: 'user', content: "She felt dismissed over time." },
        { role: 'assistant', content: repairQ },
        {
          role: 'user',
          content:
            'A sit-down and honest conversation is the only way the situation can be repaired.',
        },
      ]),
    ).toBe(true);
  });
});

describe('scenarioBProbeLogic', () => {
  it('isScenarioBQ1Prompt matches Sarah/James opening', () => {
    expect(isScenarioBQ1Prompt('What do you think is going on here?')).toBe(true);
    expect(isScenarioBQ1Prompt("What's going on between these two?")).toBe(false);
  });

  it('isIncompleteScenarioBPrematureRepairRedirectLeadSentence detects session-log redirect cutoff', () => {
    const truncated =
      "Got it — that sounds like you're already thinking as James. Before we";
    expect(isIncompleteScenarioBPrematureRepairRedirectLeadSentence(truncated)).toBe(true);
    expect(isGenericTruncatedAssistantDraft(truncated)).toBe(true);
  });

  it('coerces premature James-repair redirect cutoff to mandatory Q2 (not another Q1)', () => {
    const truncated =
      "Got it — that sounds like you're already thinking as James. Before we";
    expect(coerceScenarioBQ1QuestionForTts(truncated)).toBe(
      `Got it — that sounds like you're already thinking as James. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`,
    );
    expect(coerceScenarioBJamesDifferentlyQuestionForTts(truncated)).toBe(
      `Got it — that sounds like you're already thinking as James. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`,
    );
  });

  it('assistantTextLooksLikeScenarioBPrematureAnswerRedirect detects good-answer-for-where-we-are-heading redirect', () => {
    const redirect =
      "Got it — that's a good answer for where we're heading. First though, what do you think is actually going on between Sarah and James in this situation?";
    expect(assistantTextLooksLikeScenarioBPrematureAnswerRedirect(redirect)).toBe(true);
    expect(coerceScenarioBQ1QuestionForTts(redirect)).toContain(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1 detects repair-as-James and James-differently jumps', () => {
    expect(
      userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1(
        'If I were James, I would apologize and assure her I will be better in the future.',
      ),
    ).toBe(true);
    expect(
      userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1('If I were James, I would...'),
    ).toBe(false);
    expect(
      userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(
        'James should have celebrated with her and listened before asking about salary.',
      ),
    ).toBe(true);
    expect(
      userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1(
        'Sarah felt unseen because James focused on logistics instead of her emotions.',
      ),
    ).toBe(false);
  });

  it('isIncompleteScenarioBJamesRepairUserAnswer rejects truncated James role-play openers', () => {
    expect(isIncompleteScenarioBJamesRepairUserAnswer('If I were James, I would...')).toBe(true);
    expect(isIncompleteScenarioBJamesRepairUserAnswer('If I were James, I would')).toBe(true);
    expect(
      isIncompleteScenarioBJamesRepairUserAnswer(
        'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      ),
    ).toBe(false);
  });

  it('looksLikeScenarioBJamesDifferentlyQuestion detects Q2 and full appreciation probe', () => {
    expect(
      looksLikeScenarioBJamesDifferentlyQuestion(
        "What do you think James could've done differently so Sarah feels better?",
      ),
    ).toBe(true);
    expect(
      looksLikeScenarioBJamesDifferentlyQuestion(
        'Before things blew up, is there anything James could have done differently?',
      ),
    ).toBe(true);
    expect(
      looksLikeScenarioBJamesDifferentlyQuestion(
        'What could james have done before the fight even',
      ),
    ).toBe(false);
  });

  it('looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion flags S3 handoff without Q2', () => {
    expect(
      looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(
        "Here's the third situation — Sophie and Daniel…",
      ),
    ).toBe(true);
    expect(
      looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(
        'What could James have done differently before the fight?',
      ),
    ).toBe(false);
  });

  it('shouldSkipScenarioBRepairAsJamesProbe when Q2 answer already has repair content', () => {
    const messages = [
      { role: 'assistant', content: 'What could James have done differently before things blew up?' },
      {
        role: 'user',
        content:
          "If I were James I would have acknowledged Sarah's feelings instead of jumping to logistics.",
      },
      { role: 'assistant', content: 'If you were James, how would you repair this?' },
    ];
    expect(
      shouldSkipScenarioBRepairAsJamesProbe(
        messages,
        'If you were James, how would you repair this?',
        2,
      ),
    ).toBe(true);
  });

  it('scenarioBJamesRepairProbeAlreadySatisfied after concrete repair-as-James answer', () => {
    const messages = [
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    expect(scenarioBJamesRepairProbeAlreadySatisfied(messages)).toBe(true);
    expect(
      shouldSkipScenarioBRepairAsJamesProbe(
        messages,
        'And if you were James, how would you repair?',
        2,
      ),
    ).toBe(true);
  });

  it('scenarioBJamesRepairProbeAlreadySatisfied when Q2 is transcript prior but repair Q3 was only spoken', () => {
    const messages = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      },
      {
        role: 'user',
        content:
          'I would apologize and in the future I will be more mindful to my partner needs me to be more appreciative.',
      },
    ];
    expect(scenarioBJamesRepairProbeAlreadySatisfied(messages)).toBe(true);
  });

  it('scenarioBJamesRepairProbeAlreadySatisfied is false when user jumped ahead with repair-as-James on Q1 only', () => {
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will be better in the future.',
      },
    ];
    expect(scenarioBJamesRepairProbeAlreadySatisfied(messages)).toBe(false);
    expect(
      shouldSkipScenarioBRepairAsJamesProbe(
        messages,
        'And if you were James, how would you repair?',
        2,
      ),
    ).toBe(false);
  });

  it('shouldSuppressPrematureScenarioBJamesQ2Coercion does not strip Q2 after S2 Q1 answered', () => {
    const messages = [
      { role: 'assistant', content: 'What do you think is going on here?' },
      { role: 'user', content: 'Sarah felt unappreciated when James focused on logistics.' },
      { role: 'assistant', content: 'And if you were James, how would you repair?' },
      {
        role: 'user',
        content:
          'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
      },
    ];
    expect(
      shouldSuppressPrematureScenarioBJamesQ2Coercion({
        messages,
        interviewMoment: 2,
        s2CanonicalPlaybackConfirmed: true,
      }),
    ).toBe(false);
  });

  it('coerces truncated James-differently streaming fragments to canonical Q2', () => {
    expect(
      isIncompleteScenarioBJamesDifferentlyLeadSentence(
        'What could just have done differently before the fight even',
      ),
    ).toBe(true);
    expect(
      coerceScenarioBJamesDifferentlyQuestionForTts(
        'What could just have done differently before the fight even',
      ),
    ).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('coerces ack + truncated "What could James" mid-stream to canonical Q2 with ack preserved', () => {
    const truncated = "That's a real read on it. What could James";
    expect(isIncompleteScenarioBJamesDifferentlyLeadSentence(truncated)).toBe(true);
    expect(coerceScenarioBJamesDifferentlyQuestionForTts(truncated)).toBe(
      `That's a real read on it. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`,
    );
  });

  it('treats truncated James before-fight fragment as incomplete even with james name present', () => {
    const truncated = 'What could james have done before the fight even';
    expect(isIncompleteScenarioBJamesDifferentlyLeadSentence(truncated)).toBe(true);
    expect(coerceScenarioBJamesDifferentlyQuestionForTts(truncated)).toBe(
      SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
    );
  });

  it('coerces complete before-the-fight Q2 paraphrase to canonical appreciation prompt', () => {
    const paraphrase =
      'What do you think James could have done before the fight even started?';
    expect(isBeforeFightOnlyScenarioBJamesQ2Paraphrase(paraphrase)).toBe(true);
    expect(isDeliveredScenarioBJamesDifferentlyProbe(paraphrase)).toBe(false);
    expect(coerceScenarioBJamesDifferentlyQuestionForTts(paraphrase)).toBe(
      SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
    );
  });

  it('coerces before-the-fight Q2 paraphrase when scenario ref still reads as Situation 1', () => {
    const paraphrase =
      'Got it. What do you think James could have done before the fight even started?';
    const messages = [
      {
        role: 'assistant',
        content:
          "Sarah has been job hunting for four months. She gets an offer and calls James from the street. What do you think is going on here?",
        scenarioNumber: 2,
      },
      {
        role: 'user',
        content: 'James is not listening to how excited Sarah is about the job offer.',
        scenarioNumber: 2,
      },
    ];
    expect(
      coerceScenarioBJamesDifferentlyQuestionForTts(paraphrase, {
        messages,
        interviewMoment: 2,
      }),
    ).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('treats canonical appreciation Q2 as delivered in transcript', () => {
    expect(isDeliveredScenarioBJamesDifferentlyProbe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL)).toBe(
      true,
    );
    expect(
      isDeliveredScenarioBJamesDifferentlyProbe(
        'What do you think James could have done differently to help Sarah feel appreciated?',
      ),
    ).toBe(true);
    expect(
      isDeliveredScenarioBJamesDifferentlyProbe(
        'What do you think James could have done before the fight even started?',
      ),
    ).toBe(false);
  });

  it('coerces truncated James-repair streaming cutoff from session logs', () => {
    const truncated = 'Got it. And if you were James, how would you repair things now that';
    expect(isIncompleteScenarioBJamesRepairLeadSentence(truncated)).toBe(true);
    expect(coerceScenarioBJamesRepairQuestionForTts(truncated)).toBe(
      `Got it. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
    );
  });

  it('detects truncated off-script say-to-James role-play from session logs', () => {
    const truncated = 'How would you actually say that to james what';
    expect(looksLikeScenarioBJamesSayToJamesRolePlayQuestion(truncated)).toBe(true);
    expect(isIncompleteScenarioBJamesSayToJamesLeadSentence(truncated)).toBe(true);
    expect(coerceScenarioBJamesSayToJamesQuestionForTts(truncated)).toBe(
      SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
    );
  });

  it('collapses truncated say-to-James plus repair duplicate into one canonical Q3', () => {
    const combined =
      'How would you actually say that to james what\n\nAnd if you were James, how would you repair?';
    expect(collapseScenarioBJamesSayToJamesWithRepairDuplicate(combined, true)).toBe(
      SCENARIO_B_JAMES_REPAIR_CANONICAL,
    );
  });

  it('coerces truncated S2 Q1 redirect from session logs (what do you think caused)', () => {
    const truncated =
      "I hear you — and I'll get to that. But first, what do you think caused";
    expect(isIncompleteScenarioBQ1LeadSentence(truncated)).toBe(true);
    expect(coerceScenarioBQ1QuestionForTts(truncated)).toBe(
      "I hear you — and I'll get to that. What do you think is going on here?",
    );
  });

  it('normalizes complete James-repair paraphrases to canonical Q3', () => {
    const paraphrase = 'Got it. And if you were James, how would you repair things now that things blew up?';
    expect(coerceScenarioBJamesRepairQuestionForTts(paraphrase)).toBe(
      `Got it. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
    );
  });

  it('userSidesEntirelyWithJames detects James-only-right reads', () => {
    expect(userSidesEntirelyWithJames('James did nothing wrong; Sarah is too sensitive.')).toBe(true);
    expect(
      scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(
        'James should have comforted her when she cried.',
      ),
    ).toBe(false);
    expect(
      scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(
        "If I were James I would apologize and ask what she needed to feel celebrated.",
      ),
    ).toBe(true);
  });
});

describe('scenarioC repair-as-Daniel TTS coercion', () => {
  it('coerces Daniel role-play paraphrases to canonical repair Q2', () => {
    expect(
      coerceScenarioCRepairAsDanielQuestionForTts(
        'How would you repair if you were Daniel coming back into',
      ),
    ).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
    expect(
      coerceScenarioCRepairAsDanielQuestionForTts(
        "Yet if you were in Daniel's shoes how would you repair things with Sophie",
      ),
    ).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
    expect(
      coerceScenarioCRepairQuestionForTts(
        "Yet if you were in Daniel's shoes how would you repair things with Sophie",
      ),
    ).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('streamMissedScenarioBScriptedProbeDelivery when prior handoff is in spokenCompleteText but Q2 was not spoken', () => {
    const priorHandoff =
      "That's a wrap on this situation. Here's the next situation.\n\nSarah has been job hunting for four months.";
    expect(
      streamMissedScenarioBScriptedProbeDelivery(
        priorHandoff,
        SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      ),
    ).toBe(true);
    expect(
      streamMissedScenarioBScriptedProbeDelivery(
        `Got it. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`,
        SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      ),
    ).toBe(false);
  });

  it('does not treat James Q2 as missed when S2 opening was delivered and user has not answered Q1', () => {
    const s2Opening =
      "Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. What do you think is going on here?";
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const ctx = {
      messages,
      interviewMoment: 2,
      streamSpokeS2Opening: true,
      s2CanonicalPlaybackConfirmed: true,
    };
    expect(
      streamMissedScenarioBScriptedProbeDelivery(
        s2Opening,
        SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        ctx,
      ),
    ).toBe(false);
  });

  it('coerceScenarioBJamesDifferentlyQuestionForTts strips premature James Q2 on S1→S2 transition', () => {
    const wrapPlusQ2 =
      "Got it. That's a wrap on this situation. Nice work, Matt — you picked up on Ryan's pattern. What do you think James could have done differently to help Sarah feel appreciated?";
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    const out = coerceScenarioBJamesDifferentlyQuestionForTts(wrapPlusQ2, {
      messages,
      interviewMoment: 2,
      s2CanonicalPlaybackConfirmed: true,
    });
    expect(out).toBe('');
  });

  it('shouldSuppressPrematureScenarioBJamesQ2Coercion returns true when interviewMoment is still 1 on S1→S2 transition', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    expect(
      shouldSuppressPrematureScenarioBJamesQ2Coercion({
        messages,
        interviewMoment: 1,
        s2CanonicalPlaybackConfirmed: true,
        streamSpokeS2Opening: true,
      }),
    ).toBe(true);
  });

  it('prepareScenarioBEmotionAfterModalForTts skips afterModal when canonical S2 opening already played in stream', () => {
    const afterModal = SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    expect(
      prepareScenarioBEmotionAfterModalForTts(afterModal, {
        messages,
        interviewMoment: 1,
        s2CanonicalPlaybackConfirmed: true,
        streamSpokeS2Opening: true,
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
      }),
    ).toBe('');
  });

  it('treats S2 closing reflection naming Sarah/James/celebrate as boundary reflection without vignette', () => {
    const reflection =
      "Nice work, Matt — you recognized that James's instinct to ask practical questions missed what Sarah actually needed in that moment, which was for him to just be present and celebrate her.";
    expect(isScenarioBBoundaryReflectionWithoutNextVignette(reflection)).toBe(true);
  });
});

describe('duplicate question suppression', () => {
  const scenarioCQ1 =
    "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";

  it('shouldSuppressScenarioCQ1VerbatimReplay after partial user answer', () => {
    const messages = [
      { role: 'assistant', content: scenarioCQ1, scenarioNumber: 3 },
      { role: 'user', content: "he's just really a", scenarioNumber: 3 },
    ];
    expect(shouldSuppressScenarioCQ1VerbatimReplay(messages, scenarioCQ1)).toBe(true);
  });

  it('coerceScenarioBJamesRepairQuestionForTts maps legacy third-person repair to canonical', () => {
    const legacy =
      'Got it. How would James go about repairing this with Sarah now that the fight has started?';
    expect(coerceScenarioBJamesRepairQuestionForTts(legacy)).toBe(
      `Got it. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
    );
  });
});

describe('scenarioCProbeLogic isScenarioCQ2Prompt', () => {
  it('delegates to repair assistant matcher', () => {
    expect(isScenarioCQ2Prompt('How do you think this situation could be repaired?')).toBe(true);
    expect(isScenarioCQ2Prompt('At what point would you say Daniel or Sophie should decide…')).toBe(false);
  });
});

describe('scenarioC repair echo and Sophie replay guards', () => {
  const sophieProbe = SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  const hurtAnswer =
    "There's really a lot of hurt and rejection and abandonment, it would really suck to have someone keep leaving without resolution.";
  const hurtAnswerLivingInResolution =
    "There's really a lot of hurt and rejection and abandonment and it would really suck to have someone keep living in a resolution.";
  const echoRepair =
    "You're right — you said there's a lot of hurt, rejection, and abandonment from someone who keeps leaving without resolution. How would you repair this as Daniel?";

  it('detects repair this as Daniel phrasing', () => {
    expect(looksLikeScenarioCRepairAsDanielQuestion('How would you repair this as Daniel?')).toBe(true);
  });

  it('detects user-answer echo before repair re-ask', () => {
    expect(looksLikeScenarioCRepairWithUserAnswerEcho(echoRepair)).toBe(true);
    expect(coerceScenarioCRepairQuestionForTts(echoRepair)).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('treats hurt/abandonment answer as satisfying Sophie perspective without naming Sophie', () => {
    expect(userAnswerSatisfiesScenarioCSophiePerspectiveProbe(hurtAnswer)).toBe(true);
    expect(userAnswerSatisfiesScenarioCSophiePerspectiveProbe(hurtAnswerLivingInResolution)).toBe(true);
  });

  it('accepts thin Sophie affect reads on the perspective probe', () => {
    expect(looksLikeScenarioCSophiePerspectiveAssessableShortAnswer('Probably annoying.')).toBe(true);
    expect(looksLikeScenarioCSophiePerspectiveAssessableShortAnswer("It must've been frustrating")).toBe(
      true,
    );
    expect(
      looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(
        'I think it was probably very frustrating for so',
      ),
    ).toBe(true);
    expect(userAnswerSatisfiesScenarioCSophiePerspectiveProbe('Probably annoying.')).toBe(true);
    expect(userAnswerSatisfiesScenarioCSophiePerspectiveProbe('I think that')).toBe(false);
  });

  it('resolveScenarioCNextProbeAfterSatisfiedQ1 returns repair after Sophie answered', () => {
    const messages = [
      { role: 'assistant', content: sophieProbe, scenarioNumber: 3 },
      { role: 'user', content: hurtAnswer, scenarioNumber: 3 },
    ];
    expect(scenarioCSophiePerspectiveAnsweredInTranscript(messages)).toBe(true);
    expect(resolveScenarioCNextProbeAfterSatisfiedQ1(messages)).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('shouldSuppressScenarioCRepairReplay when repair already delivered', () => {
    const messages = [
      { role: 'assistant', content: sophieProbe, scenarioNumber: 3 },
      { role: 'user', content: hurtAnswer, scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
    ];
    expect(
      shouldSuppressScenarioCRepairReplay(messages, echoRepair, {
        repairProbeDeliveredRef: true,
      }),
    ).toBe(true);
  });

  it('does not suppress first repair delivery after Sophie answer', () => {
    const messages = [
      { role: 'assistant', content: sophieProbe, scenarioNumber: 3 },
      { role: 'user', content: hurtAnswer, scenarioNumber: 3 },
    ];
    expect(
      shouldSuppressScenarioCRepairReplay(messages, echoRepair, {
        repairProbeDeliveredRef: false,
      }),
    ).toBe(false);
  });
});
