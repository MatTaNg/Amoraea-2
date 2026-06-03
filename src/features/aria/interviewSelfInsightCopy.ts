import type { DefensePatternsJson } from '@features/aria/defensePatternsDetection';
import { DEFAULT_DEFENSE_PATTERNS } from '@features/aria/defensePatternsDetection';
import { normalizeResponseConcreteness } from '@features/aria/personalMomentConcreteness';

/** Raw row / API fields used to build user-facing self-insight copy (no clinical labels in output). */
export type InterviewSelfInsightSource = {
  egoDevelopmentLevel?: number | null;
  defensePatterns?: Partial<DefensePatternsJson> | Record<string, unknown> | null;
  emotionRecognitionRawScore?: number | null;
  moment4Concreteness?: string | null;
  moment5Concreteness?: string | null;
  disclosureCalibration?: string | null;
  mentalizingOvercertaintyCount?: number | null;
};

const EGO_COPY: Record<number, string> = {
  1: 'You tend to see situations in clear-cut terms. Developing more comfort with complexity and ambiguity could deepen your relationships.',
  2: 'You can see multiple sides of a situation, though you tend to look for clear resolutions. Learning to hold complexity without resolving it quickly is a growth edge.',
  3: 'You hold complexity well and think in patterns across situations. You have a good foundation for navigating relational nuance.',
  4: 'You demonstrate sophisticated relational understanding, integrating complexity and contradiction with genuine psychological depth.',
  5: 'You show exceptional psychological depth and systemic relational understanding.',
};

const DEFENSE_COPY: Array<{ key: keyof DefensePatternsJson; text: string }> = [
  {
    key: 'projection_detected',
    text: 'You sometimes attribute qualities to others that may reflect your own experience. Exploring this tendency with curiosity rather than judgment can be illuminating.',
  },
  {
    key: 'rationalization_detected',
    text: 'You tend to build logical frameworks around situations that might benefit from more emotional engagement. Your analytical strength is real — pairing it with emotional openness would deepen your connections.',
  },
  {
    key: 'splitting_detected',
    text: 'You sometimes see people or situations in all-or-nothing terms. Developing tolerance for the grey areas in others tends to build richer relationships.',
  },
  {
    key: 'denial_detected',
    text: 'There may be a gap between how you present your emotional life and what surfaces in how you analyze situations. Exploring that gap with a therapist or trusted person can be valuable.',
  },
];

function parseDefensePatterns(raw: InterviewSelfInsightSource['defensePatterns']): DefensePatternsJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_DEFENSE_PATTERNS };
  const o = raw as Record<string, unknown>;
  return {
    projection_detected: o.projection_detected === true,
    rationalization_detected: o.rationalization_detected === true,
    splitting_detected: o.splitting_detected === true,
    denial_detected: o.denial_detected === true,
  };
}

function egoParagraph(level: number | null | undefined): string | null {
  if (level == null || !Number.isFinite(level)) return null;
  const n = Math.round(Number(level));
  if (n < 1 || n > 5) return null;
  return EGO_COPY[n] ?? null;
}

function defenseParagraphs(dp: DefensePatternsJson): string[] {
  const out: string[] = [];
  for (const { key, text } of DEFENSE_COPY) {
    if (dp[key]) out.push(text);
  }
  return out;
}

function emotionParagraph(raw: number | null | undefined): string | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const r = Number(raw);
  if (r >= 0.75) return 'You accurately read emotional situations — this is a real strength in relationships.';
  if (r >= 0.5) return 'You read most emotional situations accurately. There are some contexts where emotional cues are harder to read.';
  return 'Reading emotional cues in others is an area for growth. This is a learnable skill.';
}

function personalMomentParagraph(m4: string | null | undefined, m5: string | null | undefined): string | null {
  const a = normalizeResponseConcreteness(m4);
  const b = normalizeResponseConcreteness(m5);
  if (a == null || b == null) return null;
  const weak = (x: NonNullable<typeof a>) => x === 'absent' || x === 'low';
  const strong = (x: NonNullable<typeof a>) => x === 'moderate' || x === 'high';
  if (weak(a) && weak(b)) {
    return 'You tend toward general frameworks rather than personal narrative when asked about your own experience. This is worth exploring — personal stories are often where the most important self-knowledge lives.';
  }
  if (strong(a) && strong(b)) {
    return 'You engage readily with your own personal experience. This self-access is valuable in relationships.';
  }
  return 'You engage with your own experience in some contexts more than others.';
}

function disclosureParagraph(cal: string | null | undefined): string | null {
  if (cal == null) return null;
  const t = String(cal).trim().toLowerCase();
  if (t === 'underdisclosure') {
    return 'You tend to be more guarded about your personal experience than your analytical capacity suggests. Creating more space for personal disclosure in safe contexts can strengthen intimacy.';
  }
  if (t === 'overdisclosure') {
    return 'You share openly and deeply. Being attentive to pacing and context in how you disclose can help build connection at a rate that works for both people.';
  }
  return null;
}

function mentalizingParagraph(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count)) return null;
  if (Number(count) < 2) return null;
  return "You tend to be quite certain about what others are thinking and feeling. Holding a little more uncertainty about others' inner lives — staying curious rather than conclusive — tends to deepen understanding in relationships.";
}

/**
 * Ordered personal-reflection paragraphs for the post-interview passed UI.
 * Omits clinical / technical labels; intended only after a successful gate pass.
 */
export function buildSelfInsightParagraphs(source: InterviewSelfInsightSource): string[] {
  const parts: string[] = [];
  const ego = egoParagraph(source.egoDevelopmentLevel ?? null);
  if (ego) parts.push(ego);
  parts.push(...defenseParagraphs(parseDefensePatterns(source.defensePatterns)));
  const em = emotionParagraph(source.emotionRecognitionRawScore ?? null);
  if (em) parts.push(em);
  const pm = personalMomentParagraph(source.moment4Concreteness ?? null, source.moment5Concreteness ?? null);
  if (pm) parts.push(pm);
  const disc = disclosureParagraph(source.disclosureCalibration ?? null);
  if (disc) parts.push(disc);
  const ment = mentalizingParagraph(source.mentalizingOvercertaintyCount ?? null);
  if (ment) parts.push(ment);
  return parts;
}
