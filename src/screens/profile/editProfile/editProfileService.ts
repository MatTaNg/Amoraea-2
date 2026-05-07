export function buildHeightWeightProfileFields(input: {
  height?: string;
  height_cm?: number;
  weight?: string;
  weight_kg?: number;
}): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};
  if (input.height_cm != null) {
    out.height = input.height_cm;
    out.heightLabel = `${input.height_cm} cm`;
  } else if (input.height) {
    out.heightLabel = input.height;
  }
  if (input.weight_kg != null) {
    out.weight = input.weight_kg;
    out.weightLabel = `${input.weight_kg} kg`;
  } else if (input.weight) {
    out.weightLabel = input.weight;
  }
  return out;
}

export function mapRelationshipStyleUiToDb(ui: string): string {
  return ui.trim();
}

/** Map stored profile relationship style (often lowercase DB slug) to onboarding picker labels. */
export function mapRelationshipStyleToUi(dbStyle: string | undefined): string {
  if (!dbStyle?.trim()) return '';
  const normalized = dbStyle.trim().toLowerCase();
  const mapping: Record<string, string> = {
    monogamous: 'Monogamous',
    polyamorous: 'Polyamorous',
    'monogamous-ish': 'Monogam-ish',
    monogamish: 'Monogam-ish',
    open: 'Open',
    other: 'Other',
  };
  if (mapping[normalized]) return mapping[normalized];
  const direct = dbStyle.trim();
  if (/^(Monogamous|Polyamorous|Monogam-ish|Open|Other)$/.test(direct)) return direct;
  return direct;
}

export function mapRelationshipStyleUiToRelationshipType(ui: string): string {
  const t = ui.toLowerCase();
  if (/mono/i.test(t)) return 'monogamous';
  if (/poly|open/i.test(t)) return 'open_to_poly';
  return 'exploring';
}
