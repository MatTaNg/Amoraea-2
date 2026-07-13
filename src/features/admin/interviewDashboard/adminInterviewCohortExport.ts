import { Alert, Platform, Share } from 'react-native';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import {
  adminCohortExportTestDateYmd,
  trimLaunchNotificationPhone,
} from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import { adminCohortExportStatusLine } from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell, pillarScoresForGate } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { UserGroup } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

const ADMIN_EXPORT_SCORE_KEYS = [
  'mentalizing',
  'accountability',
  'contempt',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'commitment_threshold',
] as const;

function escapeCsvField(raw: string): string {
  const s = raw ?? '';
  if (/[",\r\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeCsvPhoneForSpreadsheet(display: string): string {
  if (display === '—') return escapeCsvField(display);
  const innerEscaped = display.replace(/"/g, '""');
  const excelTextFormula = `="${innerEscaped}"`;
  return `"${excelTextFormula.replace(/"/g, '""')}"`;
}

export function buildAdminCohortExportCsv(groups: UserGroup[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Status',
    'Date test was taken',
    'Overall Score',
    'Mentalizing',
    'Accountability / Defensiveness',
    'Contempt / Criticism',
    'Repair',
    'Emotional Regulation',
    'Attunement',
    'Appreciation',
    'Commitment',
  ];
  const lines: string[] = [headers.map(escapeCsvField).join(',')];
  for (const g of groups) {
    const latest = g.latestAttempt;
    const pillars = pillarScoresForGate(latest);
    const phoneDisplay = trimLaunchNotificationPhone(g.user.launch_notification_phone) ?? '—';
    const cells: string[] = [
      escapeCsvField(resolveAdminInterviewIntroDisplayName(g.user)),
      escapeCsvField(g.user.email ?? '—'),
      escapeCsvPhoneForSpreadsheet(phoneDisplay),
      escapeCsvField(adminCohortExportStatusLine(g)),
      escapeCsvField(adminCohortExportTestDateYmd(g)),
      escapeCsvField(formatScoreCell(latest?.weighted_score)),
    ];
    for (const key of ADMIN_EXPORT_SCORE_KEYS) {
      cells.push(escapeCsvField(formatScoreCell(pillars[key])));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}

export function collectFilteredUserEmails(groups: UserGroup[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const g of groups) {
    const raw = g.user.email?.trim();
    if (!raw || !raw.includes('@')) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(raw);
  }
  return emails;
}

export function triggerAdminCohortCsvDownload(filename: string, csvBody: string): void {
  const payload = `\uFEFF${csvBody}`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([payload], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not download CSV.';
      Alert.alert('Export failed', msg);
    }
    return;
  }
  void Share.share({ title: filename, message: payload }).catch(() => {
    Alert.alert('Export failed', 'Could not share the CSV.');
  });
}
