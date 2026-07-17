import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type ExportReportPdfOptions = {
  /** First name or display name for the PDF filename (e.g. "Matt"). */
  participantDisplayName?: string | null;
  /** Defaults to partial → "Matt Partial Report.pdf". */
  reportKind?: 'partial' | 'full';
};

function sanitizePersonNameForFile(name: string | null | undefined): string | null {
  const cleaned = String(name ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Prefer "Matt" from titles like "Matt's Partial Report — Amoraea". */
export function extractParticipantNameFromReportHtml(html: string): string | null {
  const titleMatch = html.match(/<title>\s*([^<]+?)\s*(?:—|-)\s*Amoraea/i);
  const title = (titleMatch?.[1] ?? '').trim();
  if (!title) return null;
  const named = title.match(/^(.+?)(?:'s|’s)\s+(?:Partial|Personal)\s+Report$/i);
  if (named?.[1]) return sanitizePersonNameForFile(named[1]);
  if (/^(?:Your\s+)?(?:Partial\s+)?Personal\s+Report$/i.test(title)) return null;
  return sanitizePersonNameForFile(title);
}

export function buildReportPdfFileBaseName(options?: ExportReportPdfOptions, html?: string): string {
  const person =
    sanitizePersonNameForFile(options?.participantDisplayName) ??
    (html ? extractParticipantNameFromReportHtml(html) : null) ??
    'Amoraea';
  const kindLabel = options?.reportKind === 'full' ? 'Personal Report' : 'Partial Report';
  return `${person} ${kindLabel}`;
}

async function materializeNamedPdfFile(html: string, fileBaseName: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) return uri;

  const dest = `${dir}${fileBaseName}.pdf`;
  try {
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
  } catch {
    // Best-effort replace.
  }

  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.warn('[ReportPdf] rename copy failed, using print output uri:', err);
    return uri;
  }
}

/**
 * Open the PDF for immediate viewing without the share-sheet "Open with" chooser.
 * Uses the system print/preview UI (already in the native binary via expo-print).
 */
async function openPdfImmediately(fileUri: string): Promise<void> {
  try {
    await Print.printAsync({ uri: fileUri });
    return;
  } catch (err) {
    console.warn('[ReportPdf] print preview failed, trying alternate open:', err);
  }

  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await Linking.openURL(contentUri);
      return;
    } catch (linkErr) {
      console.warn('[ReportPdf] Android content URI open failed:', linkErr);
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Your Amoraea Report',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  throw new Error('Unable to open the report on this device');
}

/**
 * Export report HTML as a named PDF and show it immediately on device.
 * Web: opens a print-friendly window (Save as PDF from the browser print dialog).
 */
export async function exportReportPdfFromHtml(
  html: string,
  options?: ExportReportPdfOptions,
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('PDF export is only available in the browser');
    }
    const fileBaseName = buildReportPdfFileBaseName(options, html);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Alert.alert(
        'Popup blocked',
        'Please allow popups for this site, then try Download Report again.',
      );
      throw new Error('Popup blocked');
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = fileBaseName;
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch {
        // User can still use File → Print / Save as PDF from the new tab.
      }
    }, 300);
    return;
  }

  const fileBaseName = buildReportPdfFileBaseName(options, html);
  const fileUri = await materializeNamedPdfFile(html, fileBaseName);
  await openPdfImmediately(fileUri);
}
