export function mapGenderToDb(ui: string): string | undefined {
  const t = ui.trim();
  if (/^man$/i.test(t)) return 'man';
  if (/^woman$/i.test(t)) return 'woman';
  if (/non/i.test(t)) return 'non-binary';
  return undefined;
}

export function mapGenderToUi(db: string | undefined): string | undefined {
  if (!db) return undefined;
  const x = db.toLowerCase();
  if (x === 'man' || x === 'male') return 'Man';
  if (x === 'woman' || x === 'female') return 'Woman';
  return 'Non-binary';
}
