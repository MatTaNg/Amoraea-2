/**
 * Shared bivariate stats for admin validation analytics.
 * Review flags only — never automatic scoring changes.
 */

export function pearsonR(xs: number[], ys: number[], minN = 3): number | null {
  const pairs: Array<[number, number]> = [];
  const nCap = Math.min(xs.length, ys.length);
  for (let i = 0; i < nCap; i++) {
    const x = xs[i];
    const y = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  const n = pairs.length;
  if (n < minN) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (const [x, y] of pairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (!Number.isFinite(denom) || denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export function meanSd(values: number[]): { n: number; mean: number | null; sd: number | null } {
  const xs = values.filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return { n: 0, mean: null, sd: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, sd: null };
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance) };
}

/** Spearman–Brown split-half reliability from the correlation of two parallel halves. */
export function spearmanBrownFromR(r: number | null): number | null {
  if (r == null || !Number.isFinite(r) || r <= -1) return null;
  return (2 * r) / (1 + r);
}

/**
 * R² increment of adding x2 after x1 when predicting y (two-predictor OLS).
 * Null when correlations are undefined or predictors are collinear.
 */
export function hierarchicalR2Increment(
  x1: number[],
  x2: number[],
  y: number[],
  minN = 10,
): { n: number; r2Base: number | null; r2Full: number | null; deltaR2: number | null } {
  const triples: Array<[number, number, number]> = [];
  const nCap = Math.min(x1.length, x2.length, y.length);
  for (let i = 0; i < nCap; i++) {
    const a = x1[i];
    const b = x2[i];
    const c = y[i];
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) triples.push([a, b, c]);
  }
  const n = triples.length;
  if (n < minN) return { n, r2Base: null, r2Full: null, deltaR2: null };
  const xs1 = triples.map((t) => t[0]);
  const xs2 = triples.map((t) => t[1]);
  const ys = triples.map((t) => t[2]);
  const r1y = pearsonR(xs1, ys, minN);
  const r2y = pearsonR(xs2, ys, minN);
  const r12 = pearsonR(xs1, xs2, minN);
  if (r1y == null) return { n, r2Base: null, r2Full: null, deltaR2: null };
  const r2Base = r1y * r1y;
  if (r2y == null || r12 == null || Math.abs(r12) >= 0.999) {
    return { n, r2Base, r2Full: null, deltaR2: null };
  }
  const r2Full = (r1y * r1y + r2y * r2y - 2 * r1y * r2y * r12) / (1 - r12 * r12);
  if (!Number.isFinite(r2Full)) return { n, r2Base, r2Full: null, deltaR2: null };
  return { n, r2Base, r2Full, deltaR2: r2Full - r2Base };
}
