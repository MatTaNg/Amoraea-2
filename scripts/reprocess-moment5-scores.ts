/**
 * @deprecated Moment 5 was removed from the interview. This script is retained only so
 * `npm run reprocess-moment5-scores` fails fast with a clear message.
 *
 * Usage (repo root):
 *   npm run reprocess-moment5-scores -- --attempt-number=67
 */

function parseArgs(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--attempt-number='));
  const n = arg ? Number(arg.split('=')[1]) : NaN;
  if (!Number.isFinite(n) || n < 1) {
    console.error('Pass --attempt-number=<positive integer> (e.g. --attempt-number=67)');
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  parseArgs(process.argv.slice(2));
  console.error(
    'Moment 5 was removed from the interview; re-scoring Moment 5 is no longer supported. Use archived tooling if needed for legacy rows.'
  );
  process.exit(1);
}

void main();
