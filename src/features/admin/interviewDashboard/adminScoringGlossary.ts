/**
 * Plain-language glossary for admin depth signals and psychometric instruments.
 *
 * Psychometric copy is based on standard published instrument descriptions.
 * Verify against the exact scales administered in Amoraea before external release.
 */

export const DEPTH_SIGNAL_GLOSSARY = {
  ego_development_level:
    'How sophisticated someone\'s reasoning is about relationships — do they see things in strict right/wrong terms, or hold complexity and nuance? Level 1 is black-and-white thinking; levels 3–5 are increasingly nuanced, psychologically complex framing.',
  defense_patterns:
    'Flags recurring signs of psychological defensiveness: Rationalization (over-justifying why repair isn\'t needed), Splitting (one person always 100% right or wrong), Denial (claiming no personal conflicts exist despite contempt or blame showing up elsewhere in the interview).',
  personal_moment_concreteness:
    'Whether someone gave real, specific personal material when asked about their own conflicts — a named person, a real event — versus staying vague or abstract. Catches people who analyze the fictional scenarios well but won\'t open up about themselves.',
  mentalizing_overcertainty:
    'Flags language that states other people\'s inner states as settled fact ("he clearly doesn\'t care") instead of as an inference ("he might be…"). Suggests rigid or defensive thinking about others\' motives. Mentalizing (7% gate weight) is flagged for early review: RFQ-8 is retired, interview evidence is distributed, and the pillar should be evaluated for consistency and incremental prediction — do not auto-change the weight.',
  emotion_recognition_battery:
    'A 3-question task where the user identifies emotions in short vignettes — a quick check on their ability to read emotional cues.',
  disclosure_calibration:
    'Whether personal answers were appropriately open. Currently only flags Underdisclosure — personal answers much shorter and less concrete than scenario answers, suggesting guardedness specifically about themselves.',
  repair_source_signals:
    'Three repair evidence sources rolled into one Repair pillar: hypothetical_repair (Scenario 3 canonical probe), autobiographical_repair (Moment 5 conflict/resolution), and spontaneous_repair (unprompted S1/S2/M4/support). Missing sources are omitted, not scored as zero. Disagreement between hypothetical and autobiographical is kept for later outcome analysis — it is not treated as scoring error and is not auto-penalized.',
  weighted_score_breakdown:
    'Per-pillar contribution to the interview gate (score × renormalized weight), plus raw weighted score, depth-signal modifier, psychometric modifier when applied, and the final modified score.',
  regulation_source_signals:
    'Regulation evidence by interview moment (S1, S3, Moment 4, Moment 5, support). Missing moments are omitted from the Regulation pillar mean.',
} as const;

export type DepthSignalGlossaryKey = keyof typeof DEPTH_SIGNAL_GLOSSARY;

/** Abbreviation shown next to instrument names in Full Assessment. */
export const PSYCHOMETRIC_GLOSSARY = {
  BRS: 'Brief Resilience Scale — measures how well someone bounces back from stress or setbacks.',
  'Anxiety Trait':
    'Measures general disposition toward anxiety as a stable trait, not a momentary state.',
  'SCS-SF':
    'Self-Compassion Scale (Short Form) — measures self-kindness versus harsh self-judgment, especially after failure or difficulty.',
  GASP: 'Guilt and Shame Proneness scale — measures tendency toward guilt (repair-oriented, "I did a bad thing") versus shame (self-focused, avoidant, "I am bad") after wrongdoing.',
  Dweck:
    'Measures fixed versus growth mindset — whether someone believes traits and abilities are static or can be developed.',
  'AAQ-2':
    'Acceptance and Action Questionnaire — measures psychological flexibility and experiential avoidance (how much someone avoids or struggles against difficult thoughts/feelings).',
  RSES: 'Rosenberg Self-Esteem Scale — measures global self-esteem.',
  'SD3 Narcissism':
    'Short Dark Triad, narcissism subscale — measures narcissistic traits.',
  RFQ: 'Reflective Functioning Questionnaire — a self-report measure of mentalizing/reflective capacity, i.e. how well someone understands their own and others\' mental states. Retired from the active pre-interview battery; historical scores remain readable.',
  'Relationship Attitudes':
    'Experimental Amoraea entitlement items (amoraea_entitlement_v1) — not the validated PES. No auto-fail.',
  'Relationship Growth Beliefs':
    'Experimental Amoraea growth/destiny items — not the validated Knee ITR scale. No auto-fail.',
  'Conflict Catastrophizing':
    'Experimental subscale from historical Dweck items 7–10, scored separately. No auto-fail.',
  'Sexual Communication':
    'Measures comfort and openness communicating about sex and intimacy with a partner.',
} as const;

export type PsychometricGlossaryKey = keyof typeof PSYCHOMETRIC_GLOSSARY;
