/** Maps onboarding "Attracted to" choices (Men / Women / Non-binary) for profile JSON storage. */
const ALLOWED = new Set(['Men', 'Women', 'Non-binary']);

type AttractionUiLabel = 'Men' | 'Women' | 'Non-binary';

/** Map legacy / DB-looking strings onto onboarding UI labels so chips match and toggles work. */
const RAW_TO_UI: Record<string, AttractionUiLabel> = {
  men: 'Men',
  man: 'Men',
  male: 'Men',
  women: 'Women',
  woman: 'Women',
  female: 'Women',
  'non-binary': 'Non-binary',
  nonbinary: 'Non-binary',
  enby: 'Non-binary',
};

export function normalizeAttractedToUiLabels(raw: string[] | undefined | null): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (ALLOWED.has(t)) {
      if (!out.includes(t)) out.push(t);
      continue;
    }
    const ui = RAW_TO_UI[t.toLowerCase()];
    if (ui && !out.includes(ui)) out.push(ui);
  }
  return out;
}

export function mapAttractionToDb(ui: string[] | undefined | null): string[] | null {
  if (!ui || !Array.isArray(ui) || ui.length === 0) return null;
  const out = ui.filter((x) => typeof x === 'string' && ALLOWED.has(x));
  return out.length > 0 ? out : null;
}
