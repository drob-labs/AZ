import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Web: hap dritaren e shtypjes (ruaje si PDF). Telefon: krijon PDF dhe e ndan. */
export async function exportPdf(html: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Print.printAsync në web shtyp faqen aktuale, jo html-në; prandaj e shtypim vetë në një iframe të fshehur.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) throw new Error('print frame');
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    setTimeout(() => {
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    }, 300);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
}
