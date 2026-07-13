import { NPI_ENTITLEMENT_ENABLED } from './psychometricsFeatureFlags';

export type PsychometricQuestion = {
  id: number;
  text?: string;
  scenario?: string;
  response?: string;
  reverse?: boolean;
  subscale?: string;
  optionA?: string;
  optionB?: string;
  optionAEntitlement?: boolean;
  optionBEntitlement?: boolean;
};

type LikertAssessmentDef = {
  id: string;
  name: string;
  description: string;
  preamble?: string;
  estimatedMinutes: number;
  scale: {
    min: number;
    max: number;
    labels: Record<number, string>;
  };
  questions: PsychometricQuestion[];
  scoring: {
    method: 'mean' | 'sum' | 'subscale_sum';
    reverseItems: number[];
    reverseScale?: Record<number, number>;
  };
};

type ForcedChoiceAssessmentDef = {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  format: 'forced_choice';
  questions: Array<{
    id: number;
    optionA: string;
    optionB: string;
    optionAEntitlement: boolean;
    optionBEntitlement: boolean;
  }>;
  scoring: {
    method: 'entitlement_count';
    entitlementPole: 'optionA' | 'optionB';
  };
};

type AssessmentDef = LikertAssessmentDef | ForcedChoiceAssessmentDef;

export type NpiEntitlementResponse = {
  selectedOptionIndex: 0 | 1;
  wasEntitlement: boolean;
};

export type PsychometricResponseValue = number | NpiEntitlementResponse;

export type PsychometricResponsesMap = Record<number, PsychometricResponseValue>;

export function isForcedChoiceAssessment(
  assessment: AssessmentDef,
): assessment is ForcedChoiceAssessmentDef {
  return 'format' in assessment && assessment.format === 'forced_choice';
}

export function hasPsychometricQuestionResponse(
  value: PsychometricResponseValue | undefined,
): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return value.selectedOptionIndex === 0 || value.selectedOptionIndex === 1;
}

/** Published GASP externalization vignettes (battery ids 1–4). Unchanged for floor/modifier compatibility. */
export const GASP_GUILT_REPAIR_ITEM_IDS = [1, 3] as const;
export const GASP_SHAME_WITHDRAW_ITEM_IDS = [2, 4] as const;
export const GASP_EXTERNALIZATION_ITEM_IDS = [5, 6, 7, 8] as const;

export const GASP_EXTERNALIZATION_ITEM_COUNT = GASP_EXTERNALIZATION_ITEM_IDS.length;

/** Reverse-scored Emotional Patterns Assessment items (calm / low-tension statements). */
export const ANXIETY_TRAIT_REVERSE_ITEMS = [2, 4] as const;

/** SCS-SF 8-item battery — published subscale ids (full-scale numbering retained). */
export const SCS_SF_SELF_KINDNESS_ITEM_IDS = [2, 6, 11] as const;
export const SCS_SF_COMMON_HUMANITY_ITEM_IDS = [5] as const;
export const SCS_SF_MINDFULNESS_ITEM_IDS = [1, 3, 7] as const;

export const ASSESSMENTS = {
  brs: {
    id: 'brs',
    name: 'Resilience Assessment',
    description: 'A few questions about how you typically respond to difficult experiences.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 5,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Neutral',
        4: 'Agree',
        5: 'Strongly Agree',
      },
    },
    questions: [
      { id: 1, text: 'I tend to bounce back quickly after hard times.', reverse: false },
      { id: 2, text: 'I have a hard time making it through stressful events.', reverse: true },
      { id: 3, text: 'It does not take me long to recover from a stressful event.', reverse: false },
      { id: 4, text: 'It is hard for me to snap back when something bad happens.', reverse: true },
      { id: 5, text: 'I usually come through difficult times with little trouble.', reverse: false },
      { id: 6, text: 'I tend to take a long time to get over set-backs in my life.', reverse: true },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [2, 4, 6],
    },
  },

  anxiety_trait: {
    id: 'anxiety_trait',
    name: 'Emotional Patterns Assessment',
    description: 'How much do you agree with the following statements about yourself?',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 5,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Neutral',
        4: 'Agree',
        5: 'Strongly Agree',
      },
    },
    questions: [
      {
        id: 1,
        text: 'I am someone who tends to worry about things even when there is no clear reason to.',
        reverse: false,
      },
      {
        id: 2,
        text: 'I am someone who generally feels calm and at ease in daily life.',
        reverse: true,
      },
      {
        id: 3,
        text: 'I am someone who finds it hard to let go of worries even after the situation has passed.',
        reverse: false,
      },
      {
        id: 4,
        text: 'I am someone who rarely feels tense or on edge without a specific cause.',
        reverse: true,
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [...ANXIETY_TRAIT_REVERSE_ITEMS],
    },
  },

  scs_sf: {
    id: 'scs_sf',
    name: 'Self-Compassion Assessment',
    description: 'A brief questionnaire about how you treat yourself when things go wrong.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 5,
      labels: {
        1: 'Almost Never',
        2: 'Rarely',
        3: 'Sometimes',
        4: 'Often',
        5: 'Almost Always',
      },
    },
    questions: [
      {
        id: 1,
        text: 'When I fail at something important to me I become consumed by feelings of inadequacy.',
        subscale: 'mindfulness',
        reverse: true,
      },
      {
        id: 2,
        text: "I try to be understanding and patient towards those aspects of my personality I don't like.",
        subscale: 'self_kindness',
        reverse: false,
      },
      {
        id: 3,
        text: 'When something painful happens I try to keep things in perspective rather than catastrophizing.',
        subscale: 'mindfulness',
        reverse: false,
      },
      {
        id: 5,
        text: 'I try to see my failings as part of the human condition.',
        subscale: 'common_humanity',
        reverse: false,
      },
      {
        id: 6,
        text: "When I'm going through a very hard time, I give myself the caring and tenderness I need.",
        subscale: 'self_kindness',
        reverse: false,
      },
      {
        id: 7,
        text: 'When something upsets me I try to stay aware of my feelings without getting overwhelmed by them.',
        subscale: 'mindfulness',
        reverse: false,
      },
      {
        id: 9,
        text: "When I'm feeling down I tend to obsess and fixate on everything that's wrong.",
        reverse: true,
      },
      {
        id: 11,
        text: "I'm disapproving and judgmental about my own flaws and inadequacies.",
        subscale: 'self_kindness',
        reverse: true,
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [1, 9, 11],
    },
  },

  gasp: {
    id: 'gasp',
    name: 'Responsibility Assessment',
    description: 'Brief scenarios about how you might interpret difficult situations.',
    preamble:
      'The following questions describe everyday situations. For each one, imagine your honest first reaction — not what you think you should feel, but what would genuinely come to mind in the moment.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 7,
      labels: {
        1: 'Very Unlikely',
        2: 'Unlikely',
        3: 'Slightly Unlikely',
        4: 'Neither Likely nor Unlikely',
        5: 'Slightly Likely',
        6: 'Likely',
        7: 'Very Likely',
      },
    },
    questions: [
      {
        id: 1,
        subscale: 'guilt_repair',
        scenario: 'You do something that might harm another person.',
        response: 'You would say "I\'m sorry" and try to make things right.',
      },
      {
        id: 2,
        subscale: 'shame_withdraw',
        scenario: 'You do something that you know is wrong.',
        response: 'You would feel like you are a bad person.',
      },
      {
        id: 3,
        subscale: 'guilt_repair',
        scenario: 'You make a mistake at work.',
        response: 'You would try to fix it right away.',
      },
      {
        id: 4,
        subscale: 'shame_withdraw',
        scenario: 'You do something that hurts a friend.',
        response: 'You would feel ashamed of yourself.',
      },
      {
        id: 5,
        subscale: 'externalization',
        scenario: 'You make a mistake at work and your supervisor criticizes you.',
        response: 'You think your supervisor is being unfair.',
      },
      {
        id: 6,
        subscale: 'externalization',
        scenario: 'You are driving and you hit a parked car.',
        response: 'You find yourself thinking the other driver could have parked better.',
      },
      {
        id: 7,
        subscale: 'externalization',
        scenario:
          'At a party, you make a negative comment about a mutual friend and then realize they overheard you.',
        response: "You think they shouldn't have been listening to your conversation.",
      },
      {
        id: 8,
        subscale: 'externalization',
        scenario: 'You and a coworker get in an argument and they get visibly upset.',
        response: 'You think they are overreacting.',
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [],
    },
  },

  dweck: {
    id: 'dweck',
    name: 'Relationship Beliefs Assessment',
    description: 'Questions about whether people can change as partners and how you think about disagreement in relationships.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 6,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Slightly Disagree',
        4: 'Slightly Agree',
        5: 'Agree',
        6: 'Strongly Agree',
      },
    },
    questions: [
      {
        id: 1,
        text: 'The kind of partner someone is while in a relationship is something very basic about them and it can\'t be changed very much.',
        reverse: true,
      },
      {
        id: 2,
        text: 'People can do things differently in relationships, but the important parts of who they are as a partner can\'t really be changed.',
        reverse: true,
      },
      {
        id: 3,
        text: 'Everyone is a certain kind of relationship partner and there is not much that can be done to really change that.',
        reverse: true,
      },
      {
        id: 4,
        text: 'No matter what kind of partner someone is, they can always change substantially.',
        reverse: false,
      },
      {
        id: 5,
        text: 'People can substantially change the kind of partner they are.',
        reverse: false,
      },
      {
        id: 6,
        text: 'Everyone, no matter who they are, can significantly change their fundamental relationship qualities.',
        reverse: false,
      },
      {
        id: 7,
        text: 'If partners disagree about something it means their relationship is in trouble.',
        reverse: true,
      },
      {
        id: 8,
        text: 'Arguing is a sign that two people are not compatible.',
        reverse: true,
      },
      {
        id: 9,
        text: 'When I disagree with a partner I worry that the relationship is falling apart.',
        reverse: true,
      },
      {
        id: 10,
        text: 'Couples who argue frequently do not truly love each other.',
        reverse: true,
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [1, 2, 3, 7, 8, 9, 10],
    },
  },

  aaq2: {
    id: 'aaq2',
    name: 'Emotional Flexibility Assessment',
    description: 'A brief questionnaire about how you relate to your thoughts and feelings.',
    preamble:
      'The following questions ask about your relationship with difficult thoughts and feelings — things like worry, sadness, frustration, or painful memories. Try to answer based on your general pattern, not a specific situation.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 7,
      labels: {
        1: 'Never true',
        2: 'Very rarely true',
        3: 'Rarely true',
        4: 'Sometimes true',
        5: 'Often true',
        6: 'Almost always true',
        7: 'Always true',
      },
    },
    questions: [
      { id: 1, text: 'My painful experiences and memories make it difficult for me to live a life that I would value.' },
      { id: 2, text: 'I try to push away difficult feelings rather than letting myself experience them.' },
      { id: 3, text: "I worry about not being able to control my worries and feelings." },
      { id: 4, text: 'My painful memories prevent me from having a fulfilling life.' },
      { id: 5, text: 'Difficult emotions regularly get in the way of things that matter to me.' },
      { id: 6, text: 'It seems like most people are handling their lives better than I am.' },
      { id: 7, text: 'Worries get in the way of my success.' },
    ],
    scoring: {
      method: 'sum',
      reverseItems: [] as number[],
    },
  },

  rses: {
    id: 'rses',
    name: 'Self-Esteem Assessment',
    description: 'A brief questionnaire about how you feel about yourself.',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 4,
      labels: {
        1: 'Strongly disagree',
        2: 'Disagree',
        3: 'Agree',
        4: 'Strongly agree',
      },
    },
    questions: [
      { id: 1, text: 'I feel that I am a person of worth, at least on an equal basis with others.', reverse: false },
      { id: 2, text: 'I feel that I have a number of good qualities.', reverse: false },
      { id: 3, text: 'All in all, I am inclined to feel that I am a failure.', reverse: true },
      { id: 4, text: 'I am able to do things as well as most other people.', reverse: false },
      { id: 5, text: 'I feel I do not have much to be proud of.', reverse: true },
      { id: 6, text: 'I take a positive attitude toward myself.', reverse: false },
      { id: 7, text: 'On the whole, I am satisfied with myself.', reverse: false },
      { id: 8, text: 'I wish I could have more respect for myself.', reverse: true },
      { id: 9, text: 'I certainly feel useless at times.', reverse: true },
      { id: 10, text: 'At times I think I am no good at all.', reverse: true },
    ],
    scoring: {
      method: 'sum',
      reverseItems: [3, 5, 8, 9, 10],
      reverseScale: { 1: 4, 2: 3, 3: 2, 4: 1 },
    },
  },

  sd3_narcissism: {
    id: 'sd3_narcissism',
    name: 'Social Perceptions Assessment',
    description: 'How much do you agree with the following statements?',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 5,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Neither Agree nor Disagree',
        4: 'Agree',
        5: 'Strongly Agree',
      },
    },
    questions: [
      { id: 1, text: 'People see me as a natural leader.', reverse: false },
      { id: 2, text: 'I hate being the center of attention.', reverse: true },
      { id: 3, text: 'Many group activities tend to be dull without me.', reverse: false },
      { id: 4, text: 'I know that I am special because everyone keeps telling me so.', reverse: false },
      { id: 5, text: 'I like to get acquainted with important people.', reverse: false },
      { id: 6, text: 'I feel embarrassed if someone compliments me.', reverse: true },
      { id: 7, text: 'I have been compared to famous people.', reverse: false },
      { id: 8, text: 'I am an average person.', reverse: true },
      { id: 9, text: 'I insist on getting the respect I deserve.', reverse: false },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [2, 6, 8],
    },
  },

  npi_entitlement: {
    id: 'npi_entitlement',
    name: 'Values Assessment',
    description: 'For each pair, choose the statement that sounds more like you.',
    estimatedMinutes: 2,
    format: 'forced_choice',
    questions: [
      {
        id: 1,
        optionA: 'I expect a great deal from other people.',
        optionAEntitlement: true,
        optionB: 'I like to do things for other people.',
        optionBEntitlement: false,
      },
      {
        id: 2,
        optionA: 'I find it easy to manipulate people.',
        optionAEntitlement: true,
        optionB: "I don't like it when I find myself manipulating people.",
        optionBEntitlement: false,
      },
      {
        id: 3,
        optionA: 'I can make anybody believe anything I want them to.',
        optionAEntitlement: true,
        optionB: 'People sometimes believe what I tell them.',
        optionBEntitlement: false,
      },
      {
        id: 4,
        optionA: 'I insist upon getting the respect that is due to me.',
        optionAEntitlement: true,
        optionB: 'I usually get the respect that I deserve.',
        optionBEntitlement: false,
      },
      {
        id: 5,
        optionA: 'I am going to be a great person.',
        optionAEntitlement: true,
        optionB: 'I hope I am going to be successful.',
        optionBEntitlement: false,
      },
      {
        id: 6,
        optionA: 'If I ruled the world it would be a better place.',
        optionAEntitlement: true,
        optionB: 'The thought of ruling the world frightens the hell out of me.',
        optionBEntitlement: false,
      },
      {
        id: 7,
        optionA: 'Everybody likes to hear my story.',
        optionAEntitlement: true,
        optionB: 'I try not to be a show off.',
        optionBEntitlement: false,
      },
    ],
    scoring: {
      method: 'entitlement_count',
      entitlementPole: 'optionA',
    },
  },

  rfq: {
    id: 'rfq',
    name: 'Self-Reflection Assessment',
    description: 'How much do you agree with the following statements?',
    estimatedMinutes: 1,
    scale: {
      min: 1,
      max: 7,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Somewhat Disagree',
        4: 'Neither Agree nor Disagree',
        5: 'Somewhat Agree',
        6: 'Agree',
        7: 'Strongly Agree',
      },
    },
    questions: [
      { id: 1, text: "People's feelings are often a mystery to me.", reverse: true },
      {
        id: 2,
        text: 'I can usually understand what motivates others to behave the way they do.',
        reverse: false,
      },
      { id: 3, text: 'I find it hard to understand why people behave the way they do.', reverse: true },
      {
        id: 4,
        text: 'I can usually see the link between my past experiences and how I feel now.',
        reverse: false,
      },
      { id: 5, text: "I often don't know what I think about complex matters.", reverse: true },
      { id: 6, text: 'I can usually understand how other people are feeling.', reverse: false },
      {
        id: 7,
        text: "I often act without thinking about why I'm doing what I'm doing.",
        reverse: true,
      },
      { id: 8, text: 'I can usually recognize when I misunderstand someone.', reverse: false },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [1, 3, 5, 7],
    },
  },
} as const satisfies Record<string, AssessmentDef>;

/** Retired pre-interview instruments — preserved for legacy scoring and admin display only. */
export const RETIRED_ASSESSMENTS = {
  scs: {
    id: 'scs',
    name: 'Self-Awareness Assessment',
    description: 'A brief questionnaire about how you tend to think about yourself.',
    estimatedMinutes: 2,
    scale: {
      min: 0,
      max: 3,
      labels: {
        0: 'Not at all like me',
        1: 'A little like me',
        2: 'Somewhat like me',
        3: 'Very much like me',
      },
    },
    questions: [
      { id: 1, text: "I'm concerned about what other people think of me.", subscale: 'public', reverse: false },
      { id: 2, text: 'I usually worry about making a good impression.', subscale: 'public', reverse: false },
      { id: 3, text: 'One of the last things I do before leaving my house is look in the mirror.', subscale: 'public', reverse: false },
      { id: 4, text: "I'm concerned about my style of doing things.", subscale: 'public', reverse: false },
      { id: 5, text: "I'm self-conscious about the way I look.", subscale: 'public', reverse: false },
      { id: 6, text: "I'm usually aware of my appearance.", subscale: 'public', reverse: false },
      { id: 7, text: "I'm aware of the way I present myself.", subscale: 'public', reverse: false },
      { id: 8, text: "I'm always trying to figure myself out.", subscale: 'private', reverse: false },
      { id: 9, text: "Generally, I'm not very aware of myself.", subscale: 'private', reverse: true },
      { id: 10, text: 'I reflect about myself a lot.', subscale: 'private', reverse: false },
      { id: 11, text: "I'm often the subject of my own fantasies.", subscale: 'private', reverse: false },
      { id: 12, text: 'I never scrutinize myself.', subscale: 'private', reverse: true },
      { id: 13, text: "I'm generally attentive to my inner feelings.", subscale: 'private', reverse: false },
    ],
    scoring: {
      method: 'subscale_sum',
      reverseItems: [9, 12],
      reverseScale: { 0: 3, 1: 2, 2: 1, 3: 0 },
    },
  },

  mspss: {
    id: 'mspss',
    name: 'Social Support Assessment',
    description:
      'Questions about the emotional support and help you feel you receive from family and friends.',
    estimatedMinutes: 2,
    scale: {
      min: 1,
      max: 7,
      labels: {
        1: 'Very Strongly Disagree',
        2: 'Strongly Disagree',
        3: 'Somewhat Disagree',
        4: 'Neither Agree nor Disagree',
        5: 'Somewhat Agree',
        6: 'Strongly Agree',
        7: 'Very Strongly Agree',
      },
    },
    questions: [
      { id: 1, text: 'My family really tries to help me.', subscale: 'family', reverse: false },
      {
        id: 2,
        text: 'I get the emotional help and support I need from my family.',
        subscale: 'family',
        reverse: false,
      },
      { id: 3, text: 'I can talk about my problems with my family.', subscale: 'family', reverse: false },
      {
        id: 4,
        text: 'My family is willing to help me make decisions.',
        subscale: 'family',
        reverse: false,
      },
      { id: 5, text: 'My friends really try to help me.', subscale: 'friends', reverse: false },
      {
        id: 6,
        text: 'I can count on my friends when things go wrong.',
        subscale: 'friends',
        reverse: false,
      },
      {
        id: 7,
        text: 'I have friends with whom I can share my joys and sorrows.',
        subscale: 'friends',
        reverse: false,
      },
      {
        id: 8,
        text: 'I can talk about my problems with my friends.',
        subscale: 'friends',
        reverse: false,
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [],
    },
  },
} as const satisfies Record<string, AssessmentDef>;

export type RetiredAssessmentId = keyof typeof RETIRED_ASSESSMENTS;

/** Post-interview instruments — never included in {@link ASSESSMENT_ORDER}. */
export const POST_INTERVIEW_ASSESSMENTS = {
  sexual_communication: {
    id: 'sexual_communication',
    name: 'Sexual Communication',
    description:
      'How comfortable are you communicating about the following topics with a partner? Your answers are only used to improve your matches and are never shown to other users.',
    estimatedMinutes: 3,
    scale: {
      min: 1,
      max: 5,
      labels: {
        1: 'Very Uncomfortable',
        2: 'Uncomfortable',
        3: 'Neutral',
        4: 'Comfortable',
        5: 'Very Comfortable',
      },
    },
    questions: [
      { id: 1, text: 'Telling a partner what you enjoy sexually.', reverse: false },
      { id: 2, text: 'Asking a partner about their sexual preferences.', reverse: false },
      { id: 3, text: "Telling a partner when something doesn't feel good.", reverse: false },
      { id: 4, text: 'Saying no to a sexual request from a partner.', reverse: false },
      { id: 5, text: 'Bringing up sexual concerns or dissatisfactions.', reverse: false },
      { id: 6, text: "Discussing what you are and aren't willing to try sexually.", reverse: false },
      { id: 7, text: 'Expressing what emotional experience you want from sex.', reverse: false },
      { id: 8, text: 'Discussing sexual health topics with a partner.', reverse: false },
      {
        id: 9,
        text: 'Initiating a conversation about changing something in your sexual relationship.',
        reverse: false,
      },
      {
        id: 10,
        text: 'Telling a partner what you need to feel emotionally safe during intimacy.',
        reverse: false,
      },
    ],
    scoring: {
      method: 'mean',
      reverseItems: [] as number[],
    },
  },
} as const satisfies Record<string, AssessmentDef>;

export type PostInterviewAssessmentId = keyof typeof POST_INTERVIEW_ASSESSMENTS;

function compareAssessmentsByDuration(
  lengths: Record<string, { questions: { length: number }; estimatedMinutes: number }>,
  a: string,
  b: string,
): number {
  const qa = lengths[a];
  const qb = lengths[b];
  const lenDiff = qa.questions.length - qb.questions.length;
  if (lenDiff !== 0) return lenDiff;
  return qa.estimatedMinutes - qb.estimatedMinutes;
}

/** Post-interview psychometrics — shortest instruments first. */
export const POST_INTERVIEW_ASSESSMENT_ORDER: PostInterviewAssessmentId[] = (
  Object.keys(POST_INTERVIEW_ASSESSMENTS) as PostInterviewAssessmentId[]
).sort((a, b) => compareAssessmentsByDuration(POST_INTERVIEW_ASSESSMENTS, a, b));

export type AssessmentId = keyof typeof ASSESSMENTS;

/** Pre-interview psychometrics — 9 instruments in battery flow order. */
export const ASSESSMENT_ORDER: AssessmentId[] = [
  'brs',
  'anxiety_trait',
  'scs_sf',
  'gasp',
  'dweck',
  'aaq2',
  'rses',
  NPI_ENTITLEMENT_ENABLED ? 'npi_entitlement' : 'sd3_narcissism',
  'rfq',
];

/** Total question count across all instruments in {@link ASSESSMENT_ORDER}. */
export function psychometricBatteryTotalQuestions(): number {
  return ASSESSMENT_ORDER.reduce(
    (total, id) => total + ASSESSMENTS[id].questions.length,
    0,
  );
}

/** Questions already answered before each instrument index in {@link ASSESSMENT_ORDER}. */
export function psychometricBatteryQuestionOffsets(): readonly number[] {
  const offsets: number[] = [];
  let sum = 0;
  for (const id of ASSESSMENT_ORDER) {
    offsets.push(sum);
    sum += ASSESSMENTS[id].questions.length;
  }
  return offsets;
}

/** 1-based position within the full battery (not per-instrument). */
export function psychometricBatteryProgressPosition(
  assessmentIndex: number,
  questionIndex: number,
): { current: number; total: number } {
  const offsets = psychometricBatteryQuestionOffsets();
  const total = psychometricBatteryTotalQuestions();
  const current = (offsets[assessmentIndex] ?? 0) + questionIndex + 1;
  return { current, total };
}

/** User-facing estimate for Part 1 on the psychometrics welcome screen (9 questionnaires). */
export const PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES = 10;

/** User-facing estimate for the AI interview when shown as Part 1 (interview-first flow). */
export const PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES_LABEL = '20–30';

/** User-facing estimate for Part 2 on the psychometrics welcome screen. */
export const PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES = 20;

/** Resume targets for instruments removed from the active battery. */
const DEPRECATED_ASSESSMENT_RESUME_TARGET: Record<string, AssessmentId> = {
  paq: 'gasp',
  narq_s: NPI_ENTITLEMENT_ENABLED ? 'npi_entitlement' : 'sd3_narcissism',
  mspss: NPI_ENTITLEMENT_ENABLED ? 'npi_entitlement' : 'sd3_narcissism',
  scs: 'rfq',
  sd3_narcissism: NPI_ENTITLEMENT_ENABLED ? 'npi_entitlement' : 'sd3_narcissism',
};

/** @deprecated Use ASSESSMENT_ORDER */
export const ASSESSMENT_SEQUENCE = ASSESSMENT_ORDER;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function scoreLikertItemValue(
  assessment: Pick<LikertAssessmentDef, 'scale' | 'scoring'>,
  questionId: number,
  raw: number,
): number {
  const isReverse = assessment.scoring.reverseItems.includes(questionId);
  if (!isReverse) return raw;
  if (assessment.scoring.reverseScale) {
    return (assessment.scoring.reverseScale as Record<number, number>)[raw] ?? raw;
  }
  return assessment.scale.max + assessment.scale.min - raw;
}

/** Whether a higher keyed item score indicates a healthier construct (vs. more pathology). */
export const ASSESSMENT_HIGHER_SCORE_IS_FAVORABLE: Record<string, boolean> = {
  brs: true,
  scs_sf: true,
  rses: true,
  rfq: true,
  dweck: true,
  aaq2: false,
  anxiety_trait: false,
  gasp: true,
  sd3_narcissism: false,
  sexual_communication: true,
};

/** True when an item is negatively keyed (reverse-scored): agreement indicates pathology. */
export function isNegativelyKeyedLikertItem(
  assessment: Pick<LikertAssessmentDef, 'scoring'>,
  questionId: number,
): boolean {
  return assessment.scoring.reverseItems.includes(questionId);
}

/** True when the raw response sits at the unfavorable pole for that item's keying direction. */
export function isUnfavorableLikertItemResponse(
  assessmentId: string,
  assessment: Pick<LikertAssessmentDef, 'scale' | 'scoring'>,
  questionId: number,
  raw: number,
): boolean {
  const negativelyKeyed = isNegativelyKeyedLikertItem(assessment, questionId);
  const higherConstructIsFavorable = ASSESSMENT_HIGHER_SCORE_IS_FAVORABLE[assessmentId] ?? true;

  if (negativelyKeyed) {
    if (higherConstructIsFavorable) {
      // Reverse-scored pathological statement (e.g. "I am a failure"): agreement is unfavorable.
      return raw >= assessment.scale.max - 1;
    }
    // Reverse-scored healthy statement on a pathology scale (e.g. "I am calm"): disagreement is unfavorable.
    return raw <= assessment.scale.min + 1;
  }
  if (assessmentId === 'gasp' && questionId >= 5) {
    // GASP items 5-8 are externalization subscale: pathology-worded non-reverse items.
    // Endorsement at top of scale is unfavorable.
    return raw >= assessment.scale.max - 1;
  }

  if (higherConstructIsFavorable) {
    // Agreement is favorable — Disagree / Strongly Disagree (bottom of scale) is unfavorable.
    return raw <= assessment.scale.min + 1;
  }
  // Pathology-worded non-reverse items (e.g. chronic worry): endorsement at top of scale is unfavorable.
  return raw >= assessment.scale.max - 1;
}

function scoreItemValue(
  assessment: LikertAssessmentDef,
  questionId: number,
  raw: number,
): number {
  return scoreLikertItemValue(assessment, questionId, raw);
}

export function scoreBRS(responses: Record<number, number>): number {
  const assessment = ASSESSMENTS.brs;
  let total = 0;
  let count = 0;
  for (const q of assessment.questions) {
    const response = responses[q.id];
    if (response == null) continue;
    total += scoreItemValue(assessment, q.id, response);
    count++;
  }
  if (count === 0) return 0;
  return round3(total / count);
}

function meanOfItems(
  assessment: LikertAssessmentDef,
  responses: Record<number, number>,
  itemIds: number[],
): number {
  let sum = 0;
  let count = 0;
  for (const id of itemIds) {
    const raw = responses[id];
    if (raw == null) continue;
    sum += scoreItemValue(assessment, id, raw);
    count++;
  }
  return count === 0 ? 0 : round3(sum / count);
}

export type PsychometricsResumePosition = {
  assessmentIndex: number;
  questionIndex: number;
  allQuestionsAnswered: boolean;
};

export function resolvePsychometricsResumePosition(
  assessmentIdRaw: AssessmentId | string,
  questionIndex: number,
): PsychometricsResumePosition {
  let assessmentId = assessmentIdRaw as AssessmentId;
  let qIndex = Math.max(0, questionIndex);

  if (!(assessmentId in ASSESSMENTS)) {
    const fallback = DEPRECATED_ASSESSMENT_RESUME_TARGET[assessmentIdRaw];
    if (!fallback) {
      return { assessmentIndex: 0, questionIndex: 0, allQuestionsAnswered: false };
    }
    assessmentId = fallback;
    qIndex = 0;
  }

  let assessmentIndex = ASSESSMENT_ORDER.indexOf(assessmentId);
  if (assessmentIndex < 0) {
    return { assessmentIndex: 0, questionIndex: 0, allQuestionsAnswered: false };
  }

  while (assessmentIndex < ASSESSMENT_ORDER.length) {
    const assessment = ASSESSMENTS[ASSESSMENT_ORDER[assessmentIndex]];
    const maxIndex = assessment.questions.length - 1;
    if (qIndex <= maxIndex) {
      return { assessmentIndex, questionIndex: qIndex, allQuestionsAnswered: false };
    }
    qIndex -= assessment.questions.length;
    assessmentIndex += 1;
  }

  const lastAssessmentIndex = ASSESSMENT_ORDER.length - 1;
  const lastAssessment = ASSESSMENTS[ASSESSMENT_ORDER[lastAssessmentIndex]];
  return {
    assessmentIndex: lastAssessmentIndex,
    questionIndex: lastAssessment.questions.length - 1,
    allQuestionsAnswered: true,
  };
}

export function scoreNpiEntitlement(responses: Record<number, NpiEntitlementResponse>): number {
  const assessment = ASSESSMENTS.npi_entitlement;
  let count = 0;
  for (const q of assessment.questions) {
    const response = responses[q.id];
    if (response?.wasEntitlement === true) count++;
  }
  return count;
}

export function scoreAssessment(
  assessmentId: AssessmentId,
  responses: PsychometricResponsesMap,
): Record<string, number> {
  const assessment = ASSESSMENTS[assessmentId];

  if (assessmentId === 'npi_entitlement') {
    return {
      total: scoreNpiEntitlement(responses as Record<number, NpiEntitlementResponse>),
    };
  }

  if (isForcedChoiceAssessment(assessment)) {
    return { total: 0 };
  }

  if (assessmentId === 'brs') {
    return { total: scoreBRS(responses) };
  }

  if (assessmentId === 'anxiety_trait') {
    const score = meanOfItems(
      assessment,
      responses,
      assessment.questions.map((q) => q.id),
    );
    return { total: score };
  }

  if (assessmentId === 'scs_sf') {
    const total = meanOfItems(
      assessment,
      responses,
      assessment.questions.map((q) => q.id),
    );
    return {
      total,
      self_kindness: meanOfItems(assessment, responses, [...SCS_SF_SELF_KINDNESS_ITEM_IDS]),
      common_humanity: meanOfItems(assessment, responses, [...SCS_SF_COMMON_HUMANITY_ITEM_IDS]),
      mindfulness: meanOfItems(assessment, responses, [...SCS_SF_MINDFULNESS_ITEM_IDS]),
    };
  }

  if (assessmentId === 'gasp') {
    const guilt_repair = meanOfItems(assessment, responses, [...GASP_GUILT_REPAIR_ITEM_IDS]);
    const shame_withdraw = meanOfItems(assessment, responses, [...GASP_SHAME_WITHDRAW_ITEM_IDS]);
    const externalization = meanOfItems(assessment, responses, [...GASP_EXTERNALIZATION_ITEM_IDS]);
    // GASP total score traditionally focuses on the prosocial subscales (Guilt-Proneness and Shame-Proneness)
    const total = (guilt_repair + shame_withdraw) / 2;
    return {
      total,
      guilt_repair,
      shame_withdraw,
      externalization,
    };
  }

  if (assessmentId === 'dweck') {
    const growth = meanOfItems(assessment, responses, [1, 2, 3, 4, 5, 6]);
    const rbi_disagreement = meanOfItems(assessment, responses, [7, 8, 9, 10]);
    const total = meanOfItems(
      assessment,
      responses,
      assessment.questions.map((q) => q.id),
    );
    return { total, growth, rbi_disagreement };
  }

  if (assessmentId === 'sd3_narcissism' || assessmentId === 'rfq') {
    const total = meanOfItems(
      assessment,
      responses,
      assessment.questions.map((q) => q.id),
    );
    return { total };
  }

  let total = 0;
  assessment.questions.forEach((q) => {
    const raw = responses[q.id] ?? 1;
    total += scoreItemValue(assessment, q.id, raw);
  });
  return { total };
}

export function mergeScsResponses(
  publicResponses: Record<number, number> | null | undefined,
  privateResponses: Record<number, number> | null | undefined,
): Record<number, number> {
  return { ...(publicResponses ?? {}), ...(privateResponses ?? {}) };
}

/** Score retired instruments for legacy admin / historical data only. */
export function scoreRetiredAssessment(
  assessmentId: RetiredAssessmentId,
  responses: Record<number, number>,
): Record<string, number> {
  const assessment = RETIRED_ASSESSMENTS[assessmentId];

  if (assessmentId === 'scs') {
    let publicScore = 0;
    let privateScore = 0;
    assessment.questions.forEach((q) => {
      const raw = responses[q.id] ?? 0;
      const value = scoreItemValue(assessment, q.id, raw);
      if (q.subscale === 'public') publicScore += value;
      else privateScore += value;
    });
    return { public: publicScore, private: privateScore };
  }

  const family = meanOfItems(assessment, responses, [1, 2, 3, 4]);
  const friends = meanOfItems(assessment, responses, [5, 6, 7, 8]);
  const total = meanOfItems(
    assessment,
    responses,
    assessment.questions.map((q) => q.id),
  );
  return { total, family, friends };
}

export function splitScsResponses(responses: Record<number, number>): {
  public: Record<number, number>;
  private: Record<number, number>;
} {
  const assessment = RETIRED_ASSESSMENTS.scs;
  const pub: Record<number, number> = {};
  const priv: Record<number, number> = {};
  assessment.questions.forEach((q) => {
    const val = responses[q.id];
    if (val === undefined) return;
    if (q.subscale === 'public') pub[q.id] = val;
    else priv[q.id] = val;
  });
  return { public: pub, private: priv };
}

export function scorePostInterviewAssessment(
  assessmentId: PostInterviewAssessmentId,
  responses: Record<number, number>,
): Record<string, number> {
  const assessment = POST_INTERVIEW_ASSESSMENTS[assessmentId];
  if (assessmentId === 'sexual_communication') {
    const total = meanOfItems(
      assessment,
      responses,
      assessment.questions.map((q) => q.id),
    );
    const out: Record<string, number> = { total };
    for (const q of assessment.questions) {
      const val = responses[q.id];
      if (val !== undefined) out[`item_${q.id}`] = val;
    }
    return out;
  }
  return { total: 0 };
}

export function getPostInterviewAssessment(
  assessmentId: PostInterviewAssessmentId,
): AssessmentDef {
  return POST_INTERVIEW_ASSESSMENTS[assessmentId];
}
