import { SHOW_SCENARIO_3_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';

/** First sentence of Scenario C vignette — client re-insert when model drops repetition frame. */
const SCENARIO_3_REPETITION_OPENING_LINE = SHOW_SCENARIO_3_VIGNETTE_EXACT.split('\n')[0] ?? SHOW_SCENARIO_3_VIGNETTE_EXACT;

/** Text before any Scenario C opener — verifies S2 Q3 repair was reflected before the third vignette. */
function scenario3VignetteMissingOpeningLead(text: string): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (!/\bsophie\b/.test(t) || !/\bdaniel\b/.test(t)) return false;
  if (/same argument for the third|same argument for the third|for the third time|third time they|had the same argument/i.test(raw)) {
    return false;
  }
  return /\bsophie feels unheard\b/i.test(raw);
}

export function ensureScenario3VignetteOpening(text: string): string {
  if (!scenario3VignetteMissingOpeningLead(text)) return text;
  const insert = SCENARIO_3_REPETITION_OPENING_LINE;
  const idx = text.search(/\bSophie feels unheard\b/i);
  if (idx >= 0) {
    const before = text.slice(0, idx).trimEnd();
    const after = text.slice(idx);
    const sep = before ? '\n\n' : '';
    return `${before}${sep}${insert}\n\n${after}`.trim();
  }
  return `${insert}\n\n${text}`.trim();
}
