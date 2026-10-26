import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

export interface Sheet {
  name: string;
  rows: (string | number)[][];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function workbook(sheets: Sheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const widths = s.rows[0].map((_, c) => ({
      wch: Math.min(40, Math.max(10, ...s.rows.map((r) => String(r[c] ?? '').length + 2))),
    }));
    ws['!cols'] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  return wb;
}

/** Web: shkarkon skedarin. Telefon: e ruan në cache dhe hap dritaren e ndarjes. */
export async function exportXlsx(sheets: Sheet[], filename: string): Promise<void> {
  const wb = workbook(sheets);
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, filename);
    return;
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(new Uint8Array(out));
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: filename,
  });
}

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
