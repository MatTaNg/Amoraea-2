import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * On native, renders HTML to a PDF file via expo-print.
 * On web, expo-print calls window.print() on the current page — we open a dedicated
 * report document and print that instead.
 */
export async function exportReportPdfFromHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Report export is not available in this environment');
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Pop-up blocked — allow pop-ups to download your report');
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    // Fallback if onload already fired
    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // User can print manually from the new tab
      }
    }, 500);

    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Your Amoraea Report',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  throw new Error('Sharing is not available on this device');
}
