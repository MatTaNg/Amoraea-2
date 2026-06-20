/**
 * Audit persisted report markdown for section completeness and closing truncation.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/verifyReportNarrativeTruncation.ts
 *   npx tsx --env-file=.env scripts/verifyReportNarrativeTruncation.ts --limit=5
 */
import { createClient } from '@supabase/supabase-js';

function closingSectionAppearsTruncated(markdown: string): boolean {
  const lower = markdown.toLowerCase();
  const closingIdx = lower.lastIndexOf('## closing');
  if (closingIdx < 0) return false;
  const tail = markdown.slice(closingIdx + '## Closing'.length).trim();
  const contentLines = tail
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('##'));
  if (contentLines.length === 0) return true;
  const lastLine = contentLines[contentLines.length - 1] ?? '';
  if (lastLine.length < 20) return false;
  return !/[.!?](?:['"])?$/.test(lastLine);
}

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 5;

const PERSONAL_PARTIAL_REQUIRED_SECTIONS = [
  '## Overview',
  '## What\'s Working Well For You',
  '## Where You Can Grow',
  '## Practical Next Steps',
  '## What\'s Still to Come',
  '## Closing',
];

const PERSONAL_FULL_REQUIRED_SECTIONS = [
  '## Overview',
  '## Your Relational Strengths',
  '## Where You Have Room to Grow',
  '## Your Relationship Style',
  '## What Tends to Get in the Way',
  '## Practical Steps Forward',
  '## Closing',
];
  '## Overview',
  '## Your Relational Strengths',
  '## Where You Have Room to Grow',
  '## Practical Steps Forward',
  '## Closing',
];

type AuditRow = {
  id: string;
  kind: 'personal_full' | 'personal_partial' | 'relationship';
  generatedAt: string | null;
  markdown: string;
};

function missingSections(markdown: string, required: string[]): string[] {
  return required.filter((heading) => !markdown.includes(heading));
}

function closingTail(markdown: string): string {
  const idx = markdown.toLowerCase().lastIndexOf('## closing');
  if (idx < 0) return '(no closing section)';
  const tail = markdown.slice(idx).trim();
  const lines = tail.split('\n').filter((l) => l.trim().length > 0);
  return lines.slice(-2).join(' / ');
}

function auditMarkdown(row: AuditRow, required: string[]): void {
  const missing = missingSections(row.markdown, required);
  const truncated = closingSectionAppearsTruncated(row.markdown);
  const status = missing.length === 0 && !truncated ? 'OK' : 'ISSUE';

  console.log(`\n[${status}] ${row.kind} ${row.id} (generated ${row.generatedAt ?? 'unknown'})`);
  if (missing.length > 0) {
    console.log('  missing sections:', missing.join(', '));
  }
  if (truncated) {
    console.log('  closing appears truncated (no terminal punctuation on last line)');
  }
  console.log('  closing tail:', closingTail(row.markdown));
  console.log('  length:', row.markdown.length);
}

async function fetchPersonalReports(): Promise<AuditRow[]> {
  const { data: full, error: fullErr } = await supabase
    .from('interview_attempts')
    .select('id, personal_report_markdown, personal_report_generated_at')
    .not('personal_report_markdown', 'is', null)
    .order('personal_report_generated_at', { ascending: false })
    .limit(LIMIT);

  if (fullErr) throw new Error(fullErr.message);

  const { data: partial, error: partialErr } = await supabase
    .from('interview_attempts')
    .select('id, partial_report_markdown, partial_report_generated_at')
    .not('partial_report_markdown', 'is', null)
    .order('partial_report_generated_at', { ascending: false })
    .limit(LIMIT);

  if (partialErr) throw new Error(partialErr.message);

  const rows: AuditRow[] = [];
  for (const row of full ?? []) {
    if (typeof row.personal_report_markdown === 'string' && row.personal_report_markdown.trim()) {
      rows.push({
        id: row.id,
        kind: 'personal_full',
        generatedAt: row.personal_report_generated_at,
        markdown: row.personal_report_markdown,
      });
    }
  }
  for (const row of partial ?? []) {
    if (typeof row.partial_report_markdown === 'string' && row.partial_report_markdown.trim()) {
      rows.push({
        id: row.id,
        kind: 'personal_partial',
        generatedAt: row.partial_report_generated_at,
        markdown: row.partial_report_markdown,
      });
    }
  }
  return rows;
}

async function fetchRelationshipReports(): Promise<AuditRow[]> {
  const { data: comparisons, error: compErr } = await supabase
    .from('relationship_validation_comparisons')
    .select('id, profile_report_markdown, profile_report_generated_at')
    .not('profile_report_markdown', 'is', null)
    .order('profile_report_generated_at', { ascending: false })
    .limit(LIMIT);

  if (compErr) throw new Error(compErr.message);

  const rows = (comparisons ?? [])
    .filter((row) => typeof row.profile_report_markdown === 'string' && row.profile_report_markdown.trim())
    .map((row) => ({
      id: row.id,
      kind: 'relationship' as const,
      generatedAt: row.profile_report_generated_at,
      markdown: row.profile_report_markdown as string,
    }));

  if (rows.length >= LIMIT) return rows;

  const { data: legacy, error: legacyErr } = await supabase
    .from('relationship_validation_records')
    .select('user_id, profile_report_markdown, profile_report_generated_at')
    .not('profile_report_markdown', 'is', null)
    .order('profile_report_generated_at', { ascending: false })
    .limit(LIMIT);

  if (legacyErr) throw new Error(legacyErr.message);

  for (const row of legacy ?? []) {
    if (typeof row.profile_report_markdown !== 'string' || !row.profile_report_markdown.trim()) continue;
    rows.push({
      id: row.user_id,
      kind: 'relationship',
      generatedAt: row.profile_report_generated_at,
      markdown: row.profile_report_markdown,
    });
    if (rows.length >= LIMIT) break;
  }

  return rows;
}

async function main(): Promise<void> {
  console.log(`Auditing up to ${LIMIT} reports per type...\n`);

  const personal = await fetchPersonalReports();
  const relationship = await fetchRelationshipReports();

  console.log(`=== Personal reports (${personal.length}) ===`);
  if (personal.length === 0) {
    console.log('No persisted personal/partial reports found.');
  }
  for (const row of personal) {
    const required =
      row.kind === 'personal_partial' ? PERSONAL_PARTIAL_REQUIRED_SECTIONS : PERSONAL_FULL_REQUIRED_SECTIONS;
    auditMarkdown(row, required);
  }

  console.log(`\n=== Relationship validation reports (${relationship.length}) ===`);
  if (relationship.length === 0) {
    console.log('No persisted relationship reports found.');
  }
  for (const row of relationship) {
    auditMarkdown(row, RELATIONSHIP_REQUIRED_SECTIONS);
  }

  const issues = [
    ...personal.filter((r) => {
      const required =
        r.kind === 'personal_partial' ? PERSONAL_PARTIAL_REQUIRED_SECTIONS : PERSONAL_FULL_REQUIRED_SECTIONS;
      return (
        missingSections(r.markdown, required).length > 0 || closingSectionAppearsTruncated(r.markdown)
      );
    }),
    ...relationship.filter(
      (r) =>
        missingSections(r.markdown, RELATIONSHIP_REQUIRED_SECTIONS).length > 0 ||
        closingSectionAppearsTruncated(r.markdown),
    ),
  ];

  if (issues.length > 0) {
    console.log(`\n${issues.length} report(s) with missing sections or truncated closing.`);
    console.log('Regenerate affected reports after deploying the token-budget fix.');
    process.exit(1);
  }

  console.log('\nAll audited reports have required sections and properly punctuated closings.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
