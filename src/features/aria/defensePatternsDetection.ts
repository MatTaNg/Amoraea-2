import {
  extractScenario3UserCorpusAfterLastRepairPrompt,
  isNoEvidenceText,
  isNotAssessedDueToTechnicalInterruption,
  type ScenarioCorpusMessageSlice,
} from './probeAndScoringUtils';

/** Stored on `interview_attempts.defense_patterns` and echoed in aggregate / gate detail. */
export type DefensePatternsJson = {
  projection_detected: boolean;
  rationalization_detected: boolean;
  splitting_detected: boolean;
  denial_detected: boolean;
};

export const DEFAULT_DEFENSE_PATTERNS: DefensePatternsJson = Object.freeze({
  projection_detected: false,
  rationalization_detected: false,
  splitting_detected: false,
  denial_detected: false,
});

export type DefensePatternTranscriptMsg = {
  role?: string;
  content?: string;
  scenarioNumber?: number | null;
  /** Personal moments 4–5: client tags user turns with `interviewMoment` (not `scenarioNumber`). */
  interviewMoment?: number | null;
};

export type DefensePatternScoreSlice = {
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
} | null | undefined;

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function scoredNumeric(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
  key: string,
): number | null {
  if (!pillarScores) return null;
  const raw = pillarScores[key];
  if (isNotAssessedDueToTechnicalInterruption(keyEvidence?.[key])) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (isNoEvidenceText(keyEvidence?.[key])) return null;
  return raw;
}

/** Scenario contempt signal aligned with aggregate pooling (expression-heavy; legacy scenario A contempt omitted for expression). */
function scenarioContemptParticipantSignal(
  slice: DefensePatternScoreSlice,
  scenarioIndex: 0 | 1 | 2,
): number | null {
  if (!slice?.pillarScores) return null;
  const ps = slice.pillarScores;
  const ke = slice.keyEvidence;
  const expr = scoredNumeric(ps, ke, 'contempt_expression');
  if (expr != null) return expr;
  const legacy = scoredNumeric(ps, ke, 'contempt');
  if (legacy == null) return null;
  if (scenarioIndex === 0) return null;
  return legacy;
}

/** Personal moments 4–5 are often tagged `scenarioNumber: 3`; exclude them from fictional scenario corpora. */
function isPersonalMomentTranscriptTurn(m: DefensePatternTranscriptMsg): boolean {
  const im = m.interviewMoment;
  if (typeof im === 'number' && Number.isFinite(im) && (im === 4 || im === 5)) return true;
  return m.scenarioNumber === 4 || m.scenarioNumber === 5;
}

function userTextForScenario(transcript: readonly DefensePatternTranscriptMsg[] | null | undefined, n: 1 | 2 | 3): string {
  if (!transcript?.length) return '';
  return transcript
    .filter(
      (m) =>
        m.role === 'user' &&
        m.scenarioNumber === n &&
        typeof m.content === 'string' &&
        !isPersonalMomentTranscriptTurn(m),
    )
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

function userBelongsToPersonalMoment(m: DefensePatternTranscriptMsg, moment: 4 | 5): boolean {
  if (m.role !== 'user' || typeof m.content !== 'string') return false;
  const im = m.interviewMoment;
  if (typeof im === 'number' && Number.isFinite(im) && im === moment) return true;
  /** Legacy / mis-tagged rows */
  return m.scenarioNumber === moment;
}

export { isPersonalMomentTranscriptTurn };

/** User spoken text for Moment 4 or 5 (prefers `interviewMoment`; falls back to `scenarioNumber`). */
function userTextMoment4Or5(
  transcript: readonly DefensePatternTranscriptMsg[] | null | undefined,
  moment: 4 | 5,
): string {
  if (!transcript?.length) return '';
  return transcript
    .filter((m) => userBelongsToPersonalMoment(m, moment))
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

type ProjectionPair = { scenarioTerms: string[]; personalTerms: string[] };

/** Cross-slice: harsh scenario read of a character + same quality named in first-person in M4/M5. */
function detectProjectionPairwise(
  scenarioBlobLower: string,
  personalUserText: string,
  personalEvidenceLower: string,
): boolean {
  const personalText = `${personalUserText}\n${personalEvidenceLower}`.toLowerCase();

  const projectionPairs: ProjectionPair[] = [
    {
      scenarioTerms: [
        'avoidant',
        'conflict avoidant',
        'conflict-avoidant',
        'avoidance',
        'goes silent',
        'go silent',
        'goes quiet',
        'go quiet',
        'shuts down',
        'withdraws',
        'leaves',
        "doesn't know what to say",
        'does not know what to say',
      ],
      personalTerms: [
        'go quiet',
        'go silent',
        'shut down',
        'withdraw',
        'avoid',
        'need time',
        "can't engage",
        'cannot engage',
        'pull away',
        'silence',
        'process alone',
        'i leave',
        'i walk away',
        'tend to go quiet',
        'i tend to go quiet',
      ],
    },
    {
      scenarioTerms: [
        'emotionally unavailable',
        "can't be present",
        'cannot be present',
        'does not show up emotionally',
        "doesn't show up emotionally",
        'processes analytically',
      ],
      personalTerms: [
        'not good at emotional',
        'struggle to be present',
        'analytical',
        'in my head',
        "can't express",
        'cannot express',
        'hard for me to open up',
      ],
    },
    {
      scenarioTerms: ['immature', 'emotionally immature', "doesn't know how to handle", 'does not know how to handle'],
      personalTerms: ['i was immature', 'i struggled', "i didn't know how", 'i was young', 'i used to'],
    },
    {
      scenarioTerms: [
        "won't communicate",
        'refuses to talk',
        'shuts down communication',
        'avoids the conversation',
      ],
      personalTerms: [
        'i go quiet',
        'i stop talking',
        'i withdraw',
        'i needed space',
        "couldn't talk about it",
        'could not talk about it',
        'i shut down',
      ],
    },
  ];

  const scenarioText = scenarioBlobLower;

  for (const pair of projectionPairs) {
    const scenarioMatch = pair.scenarioTerms.some((term) => scenarioText.includes(term));
    const personalMatch = pair.personalTerms.some((term) => personalText.includes(term));
    if (scenarioMatch && personalMatch) {
      console.log('[DefensePatterns] projection detected — scenario term matched and personal term matched');
      console.log('[DefensePatterns] scenario match:', pair.scenarioTerms.find((t) => scenarioText.includes(t)));
      console.log('[DefensePatterns] personal match:', pair.personalTerms.find((t) => personalText.includes(t)));
      return true;
    }
  }
  return false;
}

function concatKeyEvidenceKeys(slice: DefensePatternScoreSlice, keys: string[]): string {
  if (!slice?.keyEvidence) return '';
  const parts: string[] = [];
  for (const k of keys) {
    const v = slice.keyEvidence[k];
    if (typeof v === 'string' && v.trim()) parts.push(v);
  }
  return parts.join('\n');
}

const NEGATIVE_CHARACTER_ATTRIBUTION =
  /\b(immature|emotionally immature|childish|avoidant|selfish|narcissistic|toxic|manipulative|unreasonable|heartless|cold|cruel|lazy|self-?absorbed|doesn'?t care|does not care|won'?t take responsibility|refuses? to (own|acknowledge))\b/i;

const CHARACTER_REF =
  /\b(he|she|they|him|her|them|daniel|sophie|emma|ryan|james|character|partner|wife|husband|boyfriend|girlfriend|ex)\b/i;

const PERSONAL_AVOIDANCE_OR_CUTOFF =
  /\b(cut (them |people |everyone |her |him )?off|cutting off|ghost(ed|ing)?|i (just )?ghost|blocked|no contact|went no[- ]?contact|avoid(ed|ing)?|i avoid|never process|didn'?t process|walked away|i walked|shut down|i shut|detached|i detach|walled off|never looked back|don'?t look back)\b/i;

const RATIONALIZATION_FRAMING =
  /\b(because|therefore|since|if (they|she|he|it)|the fact (is|that)|actually|in reality|logically|rational|reasonable (that|for)|not (really )?responsible|wasn'?t (really )?(his|her|their) fault|not (his|her|their) fault|makes sense that|you can'?t blame)\b/i;

const MITIGATING_OR_BILATERAL =
  /\b(both|we each|my part|i (also|too) (own|hurt|mess|regret)|shared responsibility|complicated|nuanced|their perspective|his perspective|her perspective|understandable (on both|from both)|i contributed|i (played|had) a role)\b/i;

const EQUANIMITY_OR_NO_GRUDGE =
  /\b(don'?t|do not) hold (a )?grudge|no grudge|not a grudge|i don'?t have grudges|never hold grudges|moved past|water under the bridge|let it go|not bitter|i'?m over it|doesn'?t bother me|i don'?t resent|no resentment|i forgive\b/i;

function hasNegativeAttributionOnCharacter(text: string): boolean {
  const t = text.replace(/\s+/g, ' ');
  let m: RegExpExecArray | null;
  const re = new RegExp(NEGATIVE_CHARACTER_ATTRIBUTION.source, 'gi');
  while ((m = re.exec(t)) != null) {
    const start = Math.max(0, m.index - 80);
    const end = Math.min(t.length, m.index + m[0].length + 80);
    const window = t.slice(start, end);
    if (CHARACTER_REF.test(window)) return true;
  }
  return false;
}

function repairTurnWordCount(
  scenarioIndex: 0 | 1 | 2,
  slice: DefensePatternScoreSlice,
  transcript: readonly DefensePatternTranscriptMsg[] | null | undefined,
): number {
  const ev = concatKeyEvidenceKeys(slice, ['repair']);
  const wEv = wordCount(ev);
  if (scenarioIndex === 2 && transcript?.length) {
    const s3 = extractScenario3UserCorpusAfterLastRepairPrompt(transcript as readonly ScenarioCorpusMessageSlice[]);
    return Math.max(wEv, wordCount(s3));
  }
  /** Scenarios A–B: no stable repair-turn transcript slice in shared utils — use model repair evidence only. */
  return wEv;
}

/**
 * Cross-scenario defense heuristics (post per-scenario scoring). Requires all three scenario slices;
 * personal moments and transcript strengthen projection/denial/rationalization signals when present.
 */
export function detectDefensePatterns(
  scenarioScores: [DefensePatternScoreSlice, DefensePatternScoreSlice, DefensePatternScoreSlice],
  moment4Scores: DefensePatternScoreSlice,
  moment5Scores: DefensePatternScoreSlice,
  transcript: readonly DefensePatternTranscriptMsg[] | string | null | undefined,
): DefensePatternsJson {
  console.log('[DefensePatterns] detectDefensePatterns called');
  const [s1, s2, s3] = scenarioScores;
  console.log(
    '[DefensePatterns] scenario1 scores present:',
    !!s1?.pillarScores,
    'moment5 scores present:',
    !!moment5Scores?.pillarScores,
  );
  if (!s1?.pillarScores || !s2?.pillarScores || !s3?.pillarScores) {
    console.log('[DefensePatterns] early exit: missing scenario pillarScores');
    return { ...DEFAULT_DEFENSE_PATTERNS };
  }

  const txArr: readonly DefensePatternTranscriptMsg[] | null =
    typeof transcript === 'string'
      ? transcript.trim()
        ? [{ role: 'user', content: transcript }]
        : null
      : Array.isArray(transcript)
        ? transcript
        : null;

  console.log('[DefensePatterns] transcript length:', txArr?.length ?? 0);

  const scenarioBodies = [s1, s2, s3].map((s, i) => {
    const keys = [
      'mentalizing',
      'accountability',
      'attunement',
      'repair',
      'contempt_expression',
      'contempt_recognition',
    ];
    const ke = concatKeyEvidenceKeys(s, keys);
    const sn = (i + 1) as 1 | 2 | 3;
    const ut = userTextForScenario(txArr, sn);
    return `${ke}\n${ut}`;
  });
  const scenarioAttributionBlob = scenarioBodies.join('\n').toLowerCase();
  const scenarioNegative = hasNegativeAttributionOnCharacter(scenarioAttributionBlob);

  const moment4UserText = userTextMoment4Or5(txArr, 4);
  const moment5UserText = userTextMoment4Or5(txArr, 5);
  console.log(
    '[DefensePatterns] moment4Text length:',
    moment4UserText.length,
    'preview:',
    moment4UserText.slice(0, 100),
  );
  console.log(
    '[DefensePatterns] moment5Text length:',
    moment5UserText.length,
    'preview:',
    moment5UserText.slice(0, 100),
  );

  const personalEvidenceLower = [
    concatKeyEvidenceKeys(moment4Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
    concatKeyEvidenceKeys(moment5Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
  ]
    .join('\n')
    .toLowerCase();

  const personalBlob = [moment4UserText, moment5UserText, personalEvidenceLower].join('\n').toLowerCase();

  const pairwiseProjection = detectProjectionPairwise(
    scenarioAttributionBlob,
    `${moment4UserText}\n${moment5UserText}`,
    personalEvidenceLower,
  );
  // Projection requires cross-slice pairing (scenario read + first-person parallel), not merely
  // negative character judgment in scenarios plus avoidance language in personal moments.
  const projection_detected = pairwiseProjection;
  console.log('[DefensePatterns] projection_detected:', projection_detected, {
    pairwiseProjection,
    scenarioNegativeAttribution: scenarioNegative,
  });

  let rationalCount = 0;
  const slices = [s1, s2, s3] as const;
  for (let i = 0; i < 3; i++) {
    const sl = slices[i]!;
    const repair = scoredNumeric(sl.pillarScores, sl.keyEvidence, 'repair');
    const repairWords = repairTurnWordCount(i as 0 | 1 | 2, sl, txArr);
    const repairJustification =
      i === 2 && txArr?.length
        ? `${concatKeyEvidenceKeys(sl, ['repair'])}\n${extractScenario3UserCorpusAfterLastRepairPrompt(txArr as readonly ScenarioCorpusMessageSlice[])}`
        : concatKeyEvidenceKeys(sl, ['repair']);
    if (
      repair != null &&
      repair <= 3 &&
      repairWords > 50 &&
      RATIONALIZATION_FRAMING.test(repairJustification)
    ) {
      rationalCount += 1;
      console.log('[DefensePatterns] rationalization slice hit:', {
        scenarioIndex: i + 1,
        repair,
        repairWords,
        framing: true,
      });
    }
  }
  const rationalization_detected = rationalCount >= 2;
  console.log('[DefensePatterns] rationalization_detected:', rationalization_detected, 'rationalCount:', rationalCount);

  const accScores = slices.map((sl) => scoredNumeric(sl.pillarScores, sl.keyEvidence, 'accountability'));
  const allAccPresent = accScores.every((v) => v != null);
  const allAccLow = allAccPresent && accScores.every((v) => (v as number) <= 3);
  const mitBlob = slices.map((sl) => concatKeyEvidenceKeys(sl, ['accountability', 'mentalizing'])).join('\n');
  const splitting_detected =
    allAccLow && mitBlob.length > 0 && !MITIGATING_OR_BILATERAL.test(mitBlob.toLowerCase());
  console.log('[DefensePatterns] splitting_detected:', splitting_detected, {
    allAccPresent,
    allAccLow,
    accScores,
    mitBlobLen: mitBlob.length,
    mitigating: MITIGATING_OR_BILATERAL.test(mitBlob.toLowerCase()),
  });

  const m4Text = [userTextMoment4Or5(txArr, 4), concatKeyEvidenceKeys(moment4Scores, ['accountability', 'mentalizing'])].join(
    '\n',
  );
  const equanimityClaim = EQUANIMITY_OR_NO_GRUDGE.test(m4Text.toLowerCase());
  const contemptLowAny = [s1, s2, s3].some((sl, idx) => {
    const v = scenarioContemptParticipantSignal(sl, idx as 0 | 1 | 2);
    return v != null && v <= 5;
  });
  const denial_detected = equanimityClaim && contemptLowAny;

  return {
    projection_detected,
    rationalization_detected,
    splitting_detected,
    denial_detected,
  };
}

export function countActiveDefensePatternFlags(p: DefensePatternsJson): number {
  return (
    (p.projection_detected ? 1 : 0) +
    (p.rationalization_detected ? 1 : 0) +
    (p.splitting_detected ? 1 : 0) +
    (p.denial_detected ? 1 : 0)
  );
}
