import { Ebook } from '../src/types';

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function generateBookSamplePdf(book: Ebook): Buffer {
  const lines: { text: string; size: number; y: number }[] = [];
  let y = 760;

  const pushLines = (text: string, size: number, gap: number, maxChars = 76) => {
    const wrapped = wrapText(text, maxChars);
    for (const line of wrapped) {
      if (y < 70) break;
      lines.push({ text: line, size, y });
      y -= gap;
    }
  };

  pushLines('PERPUSTAKAAN PRIBADI DIGITAL AI INDONESIA', 10, 18);
  y -= 6;
  pushLines(book.title, 18, 24, 50);
  y -= 4;
  pushLines(`Penulis: ${book.author}`, 11, 16);
  pushLines(`Kategori: ${book.category} | Penerbit: ${book.publisher} (${book.year})`, 10, 18);
  y -= 10;
  pushLines('Ringkasan Karya Digital', 13, 20);
  pushLines(book.description, 11, 16);
  y -= 10;
  pushLines('Bab 1: Pengantar Materi', 13, 20);
  pushLines(
    `Naskah digital "${book.title}" disusun sebagai bahan referensi ilmiah dan literasi praktis bagi anggota Perpustakaan Pribadi Digital AI Indonesia. Pembahasan di dalamnya dirancang sistematis agar mudah dipelajari baik oleh pelajar, peneliti, maupun praktisi di Indonesia.`,
    11,
    16
  );
  y -= 8;
  pushLines(
    'Dokumen ini didistribusikan secara resmi melalui sistem akses terkendali perpustakaan. Penggunaan kutipan wajib mencantumkan nama penulis serta sumber publikasi secara akurat sesuai kaidah akademik yang berlaku.',
    11,
    16
  );

  const streamOps = [
    'BT',
    ...lines.map((item) => `/F1 ${item.size} Tf 1 0 0 1 56 ${item.y} Tm (${escapePdfText(item.text)}) Tj`),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamOps, 'utf8')} >>\nstream\n${streamOps}\nendstream\nendobj\n`
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
