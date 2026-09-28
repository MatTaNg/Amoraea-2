import { triggerAdminCohortCsvDownload } from '@features/admin/interviewDashboard/adminInterviewCohortExport';
import type {
  AdminBatchMatchResult,
  AdminCompatDirectoryUser,
} from '@features/compatibility/adminCompatibilityMatching';

function escapeCsvField(raw: string): string {
  const s = raw ?? '';
  if (/[",\r\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function userContact(user: AdminCompatDirectoryUser | undefined): string {
  if (!user) return '—';
  return user.email ?? user.phone ?? user.id;
}

function compatibilityPercentForExport(score: number): string {
  return `${Math.round(score * 1000) / 10}`;
}

export function buildAdminBatchMatchExportCsv(result: AdminBatchMatchResult): string {
  const headers = [
    'Row type',
    'Rank',
    'User A name',
    'User A email/phone',
    'User B name',
    'User B email/phone',
    'Compatibility %',
    'Dealbreaker fail',
    'Attachment',
    'Values',
    'Concrete life',
    'Finance',
    'Domain importance',
    'Interview (diagnostic)',
    'Detail',
  ];
  const lines: string[] = [headers.map(escapeCsvField).join(',')];

  const pushRow = (cells: string[]) => {
    lines.push(cells.map(escapeCsvField).join(','));
  };

  if (result.mode === 'one_vs_list' && result.anchor) {
    pushRow([
      'anchor',
      '',
      result.anchor.displayLabel,
      userContact(result.anchor),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Anchor user for one-vs-list ranking',
    ]);
  }

  for (const pair of result.pairs) {
    const displayScore = pair.dealbreakerFailed ? pair.preDealbreakerScore : pair.result.finalScore;
    pushRow([
      result.mode === 'one_vs_list' ? 'ranked_match' : 'matched_pair',
      String(pair.rank),
      pair.userA.displayLabel,
      userContact(pair.userA),
      pair.userB.displayLabel,
      userContact(pair.userB),
      compatibilityPercentForExport(displayScore),
      pair.dealbreakerFailed ? 'yes' : 'no',
      compatibilityPercentForExport(pair.result.subscores.attachment),
      compatibilityPercentForExport(pair.result.subscores.values),
      compatibilityPercentForExport(pair.result.subscores.concreteLifeFit),
      compatibilityPercentForExport(pair.result.subscores.finance),
      compatibilityPercentForExport(pair.result.subscores.lifeDomainImportanceAlignment),
      compatibilityPercentForExport(pair.result.subscores.interviewProcess),
      '',
    ]);
  }

  for (const user of result.unmatched) {
    pushRow([
      'unmatched',
      '',
      user.displayLabel,
      userContact(user),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'No pair assigned in greedy batch matching',
    ]);
  }

  for (const identifier of result.notFound) {
    pushRow([
      'not_found',
      '',
      identifier,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Identifier not found in user directory',
    ]);
  }

  for (const identifier of result.profileIncomplete) {
    pushRow([
      'profile_incomplete',
      '',
      identifier,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Skipped — interview not complete/passed or profile incomplete',
    ]);
  }

  for (const identifier of result.duplicateIdentifiers) {
    pushRow([
      'duplicate_skip',
      '',
      identifier,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Duplicate identifier in pasted list',
    ]);
  }

  return lines.join('\r\n');
}

export function triggerAdminBatchMatchCsvDownload(filename: string, result: AdminBatchMatchResult): void {
  triggerAdminCohortCsvDownload(filename, buildAdminBatchMatchExportCsv(result));
}
