/** Sample standard deviation (n >= 2), Bessel's correction. */
export function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((s, x) => s + (x - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}
