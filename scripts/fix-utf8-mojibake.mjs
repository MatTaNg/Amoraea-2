/**
 * Fix UTF-8 punctuation mis-read as Windows-1252 (â€" → —, â"'€ → ─, etc.).
 * Run: node scripts/fix-utf8-mojibake.mjs
 */
import fs from 'fs';
import path from 'path';

/** Longest / more specific sequences first. Each [wrong, fixed]. */
const MOJIBAKE_REPLACEMENTS = [
  // Double-encoded UTF-8 for ━ (U+2501): â"\u0081
  ['\u00e2\u201d\u0081', '\u2501'],
  ['\u00e2\u201d\u20ac', '\u2500'],
  ['\u00e2\u2020\u0090', '\u2190'],
  ['\u00e2\u2020\u2018', '\u2190'],
  ['\u00e2\u2020\u201d', '\u2194'],
  ['\u00e2\u2020\u201c', '\u2194'],
  ['\u00e2\u2020\u2019', '\u2192'],
  ['\u00e2\u2030\u00a4', '\u2264'],
  ['\u00e2\u2030\u00a5', '\u2265'],
  ['\u00e2\u2030\u02c6', '\u2248'],
  ['\u00e2\u02c6\u2019', '\u2212'],
  ['\u00e2\u0153\u201c', '\u2713'],
  ['\u00e2\u0153\u2014', '\u2717'],
  ['\u00e2\u0153\u00a6', '\u2726'],
  ['\u00e2\u2014\u008f', '\u25cf'],
  ['\u00e2\u2014\u2020', '\u25c6'],
  ['\u00e2\u0161\u00a0', '\u26a0'],
  ['\u00c3\u2014', '\u00d7'],
  ['\u00e2\u20ac\u009c', '\u201c'],
  ['\u00e2\u20ac\u009d', '\u201d'],
  ['\u00e2\u20ac\u00a2', '\u2022'],
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u201c', '\u2013'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u0153', '\u201c'],
  ['\u00e2\u20ac\u017e', '\u201d'],
  ['\u00e2\u20ac\u00a6', '\u2026'],
];

function fixString(s) {
  let out = s;
  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    if (!out.includes(bad)) continue;
    out = out.split(bad).join(good);
  }
  return out;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules') walk(p, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const roots = [path.join(process.cwd(), 'src'), path.join(process.cwd(), 'scripts')];
const extra = [path.join(process.cwd(), 'App.tsx')].filter((p) => fs.existsSync(p));

let changed = 0;
const files = [...new Set([...roots.flatMap((r) => walk(r)), ...extra])];
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const next = fixString(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    changed++;
    console.log(path.relative(process.cwd(), file));
  }
}
console.log(`fixed ${changed} file(s).`);
