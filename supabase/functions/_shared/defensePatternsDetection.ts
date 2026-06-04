/**
 * Keep logic aligned with `src/features/aria/defensePatternsDetection.ts` (Edge bundle has no app `probe` import).
 * Inlined: technical non-assessment / no-evidence checks + minimal Scenario C post-repair user corpus.
 */

const SKIPPED_BY_USER_FRUSTRATION_EVIDENCE =
  'Not scored — participant chose to skip the remaining prompt in this segment after a frustration signal.';

const NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE =
  'Not assessed — session ended due to technical difficulties before this prompt was delivered.';

function isNotAssessedDueToTechnicalInterruption(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim().toLowerCase();
  if (t === NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE.trim().toLowerCase()) return true;
  return (
    /\bnot assessed\b/.test(t) &&
    (/\b(session ended|ended early)\b.*\btechnical\b/.test(t) ||
      /\btechnical (difficult|interruption|failure)\b/.test(t) ||
      /\bbefore this prompt (was )?delivered\b/.test(t) ||
      /\binterview (ended|terminated)\b.*\btechnical\b/.test(t))
  );
}

function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.trim() === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return true;
  const t = text.trim().toLowerCase();
  return (
    /no\s+[a-z_ ]+\s+content\s+in\s+this\s+(scenario|moment|interview)/i.test(t) ||
    /not\s+directly\s+assessed/i.test(t) ||
    /insufficient\s+evidence/i.test(t) ||
    /no\s+evidence\s+(was\s+)?(available|observed|surfaced)/i.test(t) ||
    /no substantive engagement with (the )?grudge/i.test(t) ||
    /moment 4[:\s]+no substantive engagement/i.test(t) ||
    /deflection, avoidance, or absent signal/i.test(t) ||
    /appreciation (was )?not assessed from this moment/i.test(t) ||
    /not assessed from this moment.*appreciation/i.test(t) ||
    /limited (close[- ]relationship|lived) (experience|opportunity)/i.test(t) ||
    /\bnot scored\b.*\bskip\b.*\bfrustration\b/i.test(t)
  );
}

function extractScenario3UserCorpusAfterLastRepairPrompt(
  msgs: readonly { role?: string; content?: string; scenarioNumber?: number | null }[],
): string {
  let lastRepairIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!;
    if (m.role === 'assistant' && typeof m.content === 'string') {
      const t = m.content.replace(/\s+/g, ' ').trim().toLowerCase();
      if (
        t.includes('how do you think this situation could be repaired') ||
        t.includes('how do you think this could be repaired') ||
        /\bhow (might|could|would|should) this situation be repaired\b/.test(t) ||
        /\bhow (might|could|would) this be repaired\b/.test(t)
      ) {
        lastRepairIdx = i;
        break;
      }
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = lastRepairIdx + 1; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.role === 'assistant' && m.scenarioNumber === 3 && typeof m.content === 'string') {
      const t = m.content.toLowerCase();
      if (t.includes('at what point would you say') && t.includes('relationship')) break;
      continue;
    }
    if (m.role === 'user' && m.scenarioNumber === 3 && typeof m.content === 'string') {
      const t = String(m.content).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

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

function scenarioContemptParticipantSignal(slice: DefensePatternScoreSlice, scenarioIndex: 0 | 1 | 2): number | null {
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

function userTextMoment4Or5(
  transcript: readonly DefensePatternTranscriptMsg[] | null | undefined,
  moment: 4 | 5,
): string {
  if (!transcript?.length) return '';
  return transcript
    .filter((m) => {
      if (m.role !== 'user' || typeof m.content !== 'string') return false;
      const im = m.interviewMoment;
      if (typeof im === 'number' && Number.isFinite(im) && im === moment) return true;
      return m.scenarioNumber === moment;
    })
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
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

  for (const pair of projectionPairs) {
    const scenarioMatch = pair.scenarioTerms.some((term) => scenarioBlobLower.includes(term));
    const personalMatch = pair.personalTerms.some((term) => personalText.includes(term));
    if (scenarioMatch && personalMatch) return true;
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
    const s3 = extractScenario3UserCorpusAfterLastRepairPrompt(transcript);
    return Math.max(wEv, wordCount(s3));
  }
  return wEv;
}

export function detectDefensePatterns(
  scenarioScores: [DefensePatternScoreSlice, DefensePatternScoreSlice, DefensePatternScoreSlice],
  moment4Scores: DefensePatternScoreSlice,
  moment5Scores: DefensePatternScoreSlice,
  transcript: readonly DefensePatternTranscriptMsg[] | string | null | undefined,
): DefensePatternsJson {
  const [s1, s2, s3] = scenarioScores;
  if (!s1?.pillarScores || !s2?.pillarScores || !s3?.pillarScores) {
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

  const scenarioBodies = [s1, s2, s3].map((s, i) => {
    const keys = ['mentalizing', 'accountability', 'attunement', 'repair'];
    const ke = concatKeyEvidenceKeys(s, keys);
    const sn = (i + 1) as 1 | 2 | 3;
    const ut = userTextForScenario(txArr, sn);
    return `${ke}\n${ut}`;
  });
  const scenarioAttributionBlob = scenarioBodies.join('\n').toLowerCase();

  const moment4UserText = userTextMoment4Or5(txArr, 4);
  const moment5UserText = userTextMoment4Or5(txArr, 5);
  const personalEvidenceLower = [
    concatKeyEvidenceKeys(moment4Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
    concatKeyEvidenceKeys(moment5Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
  ]
    .join('\n')
    .toLowerCase();

  const projection_detected = detectProjectionPairwise(
    scenarioAttributionBlob,
    `${moment4UserText}\n${moment5UserText}`,
    personalEvidenceLower,
  );

  let rationalCount = 0;
  const slices = [s1, s2, s3] as const;
  for (let i = 0; i < 3; i++) {
    const sl = slices[i]!;
    const repair = scoredNumeric(sl.pillarScores, sl.keyEvidence, 'repair');
    const repairWords = repairTurnWordCount(i as 0 | 1 | 2, sl, txArr);
    const repairJustification =
      i === 2 && txArr?.length
        ? `${concatKeyEvidenceKeys(sl, ['repair'])}\n${extractScenario3UserCorpusAfterLastRepairPrompt(txArr)}`
        : concatKeyEvidenceKeys(sl, ['repair']);
    if (repair != null && repair <= 3 && repairWords > 50 && RATIONALIZATION_FRAMING.test(repairJustification)) {
      rationalCount += 1;
    }
  }
  const rationalization_detected = rationalCount >= 2;

  const accScores = slices.map((sl) => scoredNumeric(sl.pillarScores, sl.keyEvidence, 'accountability'));
  const allAccPresent = accScores.every((v) => v != null);
  const allAccLow = allAccPresent && accScores.every((v) => (v as number) <= 3);
  const mitBlob = slices.map((sl) => concatKeyEvidenceKeys(sl, ['accountability', 'mentalizing'])).join('\n');
  const splitting_detected =
    allAccLow && mitBlob.length > 0 && !MITIGATING_OR_BILATERAL.test(mitBlob.toLowerCase());

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
