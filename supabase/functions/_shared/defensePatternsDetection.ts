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

function userTextForScenario(transcript: readonly DefensePatternTranscriptMsg[] | null | undefined, n: 1 | 2 | 3): string {
  if (!transcript?.length) return '';
  return transcript
    .filter((m) => m.role === 'user' && m.scenarioNumber === n && typeof m.content === 'string')
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
    .filter((m) => m.role === 'user' && m.scenarioNumber === moment && typeof m.content === 'string')
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
  const scenarioNegative = hasNegativeAttributionOnCharacter(scenarioAttributionBlob);

  const personalBlob = [
    userTextMoment4Or5(txArr, 4),
    userTextMoment4Or5(txArr, 5),
    concatKeyEvidenceKeys(moment4Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
    concatKeyEvidenceKeys(moment5Scores, ['accountability', 'mentalizing', 'repair', 'regulation']),
  ]
    .join('\n')
    .toLowerCase();

  const projection_detected = scenarioNegative && PERSONAL_AVOIDANCE_OR_CUTOFF.test(personalBlob);

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
