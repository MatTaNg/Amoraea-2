import type { RelationshipValidationTestMode } from './constants';

type ReframeRule = { pattern: RegExp; replacement: string };

/**
 * Ordered longest-match-first substitutions for platonic validation test mode.
 * Keeps canonical instrument wording in source files; only validation UI applies this layer.
 */
const PLATONIC_STEM_RULES: ReframeRule[] = [
  { pattern: /\byour sexual relationship\b/gi, replacement: 'that past sexual relationship' },
  { pattern: /\bin your relationship\b/gi, replacement: 'in that relationship' },
  { pattern: /\byour current relationship\b/gi, replacement: 'that past relationship' },
  { pattern: /\bmy current relationship\b/gi, replacement: 'that past relationship' },
  { pattern: /\bromantic partners\b/gi, replacement: 'past romantic partners' },
  { pattern: /\bmy partner is\b/gi, replacement: 'my past partner was' },
  { pattern: /\bmy partner was\b/gi, replacement: 'my past partner was' },
  { pattern: /\bmy partner's\b/gi, replacement: "my past partner's" },
  { pattern: /\bmy partner\b/gi, replacement: 'my past partner' },
  { pattern: /\bMy partner\b/g, replacement: 'My past partner' },
  { pattern: /\byour partner\b/gi, replacement: 'your past partner' },
  { pattern: /\bwith a partner\b/gi, replacement: 'with a past partner' },
  { pattern: /\bfrom a partner\b/gi, replacement: 'from a past partner' },
  { pattern: /\ba partner\b/gi, replacement: 'a past partner' },
  { pattern: /\bA partner\b/g, replacement: 'A past partner' },
  { pattern: /\bpartner will\b/gi, replacement: 'partner would' },
  { pattern: /\bpartner doesn't\b/gi, replacement: "partner didn't" },
  { pattern: /\bpartner wants\b/gi, replacement: 'partner wanted' },
  { pattern: /\bpartner wanted\b/gi, replacement: 'partner wanted' },
  { pattern: /\bpartner pushes\b/gi, replacement: 'partner pushed' },
  { pattern: /\bpartner challenged\b/gi, replacement: 'partner challenged' },
  { pattern: /\bpartner said\b/gi, replacement: 'partner said' },
  { pattern: /\bpartner really\b/gi, replacement: 'partner really' },
  { pattern: /\bpartner leaving\b/gi, replacement: 'partner leaving' },
  { pattern: /\bpartner\(s\)\b/gi, replacement: 'past partner(s)' },
  { pattern: /\bpartners won't\b/gi, replacement: "partners wouldn't" },
  { pattern: /\bpartners get\b/gi, replacement: 'partners got' },
  { pattern: /\bwe both want\b/gi, replacement: 'you both wanted' },
  { pattern: /\bwe need to repair\b/gi, replacement: 'you needed to repair' },
  { pattern: /\bwe see a situation\b/gi, replacement: 'you saw a situation' },
  { pattern: /\bwe disagree\b/gi, replacement: 'you disagreed' },
  { pattern: /\bWhen we\b/g, replacement: 'When you' },
  { pattern: /\bwhen we\b/g, replacement: 'when you' },
];

export function reframePlatonicAssessmentStem(
  text: string,
  testMode: RelationshipValidationTestMode | null | undefined,
): string {
  if (testMode !== 'platonic') return text;
  let out = text;
  for (const { pattern, replacement } of PLATONIC_STEM_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
