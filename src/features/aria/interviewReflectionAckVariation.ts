import type { MessageWithScenario } from './interviewScenarioScoringSlice';

export const REFLECTION_OPENERS_SHORT = ['Yeah', 'Mm', 'Fair', 'Noted'] as const;
export const REFLECTION_OPENERS_WARM = [
  'I hear you',
  'I see what you mean',
  'Yeah, I can see that',
  "That's a real read",
] as const;
export const REFLECTION_OPENERS_ALL = [...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_WARM];

export function normalizeLeadingAck(value: string): string {
  return value.toLowerCase().replace(/[.,!?]/g, '').trim();
}

export function extractLeadingAcknowledgment(text: string): string | null {
  const trimmed = text.trim();
  for (const opener of REFLECTION_OPENERS_ALL) {
    const pattern = new RegExp(`^${opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[,:.]|\\s)`, 'i');
    if (pattern.test(trimmed)) return opener;
  }
  return null;
}

export function chooseReflectionOpener(opts: {
  recentOpeners: string[];
  preferWarm: boolean;
}): string {
  const recent = new Set(opts.recentOpeners.map(normalizeLeadingAck));
  const weightedPool = opts.preferWarm
    ? [...REFLECTION_OPENERS_WARM, ...REFLECTION_OPENERS_WARM, ...REFLECTION_OPENERS_SHORT]
    : [...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_WARM];
  const filtered = weightedPool.filter((x) => !recent.has(normalizeLeadingAck(x)));
  const pool = filtered.length > 0 ? filtered : REFLECTION_OPENERS_ALL;
  return pool[Math.floor(Math.random() * pool.length)];
}

const MANDATORY_VALIDATION_LEADS = ['Good', 'Got it', 'Great', 'Nice', 'Makes sense'] as const;

function chooseMandatoryValidationLead(recentAssistant: MessageWithScenario[]): string {
  const used = new Set<string>();
  for (const m of recentAssistant.slice(-4)) {
    const c = typeof m.content === 'string' ? m.content.trim() : '';
    for (const l of MANDATORY_VALIDATION_LEADS) {
      const esc = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^${esc}\\b`, 'i').test(c)) used.add(l);
    }
  }
  const pool = MANDATORY_VALIDATION_LEADS.filter((l) => !used.has(l));
  const pick = pool.length ? pool : [...MANDATORY_VALIDATION_LEADS];
  return pick[Math.floor(Math.random() * pick.length)]!;
}

export function wrapMandatoryAckBodyWithValidationLead(
  body: string,
  recentAssistant: MessageWithScenario[],
): string {
  const v = chooseMandatoryValidationLead(recentAssistant);
  return `${v} — ${body.trim()}`.trim();
}

export function enforceAcknowledgmentVariation(
  text: string,
  recentAssistantMessages: MessageWithScenario[],
  preferWarm: boolean,
): string {
  if (!text) return text;
  const existing = extractLeadingAcknowledgment(text);
  if (!existing) return text;
  const recentOpeners = recentAssistantMessages
    .slice(-4)
    .map((m) => extractLeadingAcknowledgment(typeof m.content === 'string' ? m.content : ''))
    .filter((x): x is string => !!x);
  if (!recentOpeners.map(normalizeLeadingAck).includes(normalizeLeadingAck(existing))) return text;
  const replacement = chooseReflectionOpener({ recentOpeners, preferWarm });
  const escapedExisting = existing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${escapedExisting}`, 'i'), `${replacement}`);
}

export function recentAssistantMessagesForAck(msgs: MessageWithScenario[]): MessageWithScenario[] {
  return msgs.filter((m) => m.role === 'assistant').slice(-4) as MessageWithScenario[];
}

export const BRIEF_SCENARIO_ACKS = [
  'Got it.',
  'Makes sense.',
  'That makes a lot of sense.',
  "I'm with you.",
] as const;

export function extractLeadingBriefScenarioAck(text: string): string | null {
  const t = (text ?? '').trim();
  for (const ack of BRIEF_SCENARIO_ACKS) {
    const esc = ack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${esc}(?:\\s|$)`, 'i').test(t)) return ack;
  }
  if (/^well done\./i.test(t)) return 'Well done.';
  return null;
}

/** Pick a brief acknowledgment for between-question beats (not boundary reflections). */
export function chooseBriefScenarioAck(recentAssistant: MessageWithScenario[]): string {
  const lastAsst = [...recentAssistant].reverse().find((m) => m.role === 'assistant');
  const lastAck = extractLeadingBriefScenarioAck(
    typeof lastAsst?.content === 'string' ? lastAsst.content : '',
  );
  const pool = BRIEF_SCENARIO_ACKS.filter((a) => a !== lastAck);
  const pick = pool.length ? pool : [...BRIEF_SCENARIO_ACKS];
  return pick[Math.floor(Math.random() * pick.length)]!;
}
