import React from 'react';
import { Download, Printer } from 'lucide-react';
import { downloadCsv, formatDateTime, formatRupiah } from '../lib/api';
import { Member, ReaderHistoryEntry, SessionUser, Transaction } from '../types';

export interface LibraryReportPayload {
  generatedAt: string;
  scope: 'all' | 'personal';
  totals: {
    ebooks: number;
    members: number;
    transactions: number;
    verifiedTransactions: number;
    pendingTransactions: number;
    verifiedRevenue: number;
    reads: number;
    downloads: number;
  };
  categoryBreakdown: {
    category: string;
    totalBooks: number;
    freeBooks: number;
    paidBooks: number;
  }[];
  bookStats: {
    id: string;
    title: string;
    category: string;
    price: number;
    reads: number;
    downloads: number;
  }[];
  members: Member[];
  transactions: Transaction[];
  history: ReaderHistoryEntry[];
}

interface ReportsViewProps {
  user: SessionUser;
  report: LibraryReportPayload | null;
  loading: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  user,
  report,
  loading,
}) => {
  const isAdmin = user.role === 'admin';

  const handleDownloadFullCsv = () => {
    if (!report) return;
    const headers = [
      'Bagian Laporan',
      'Keterangan / Judul',
      'Kategori / Email',
      'Detail 1',
      'Detail 2',
      'Nilai / Jumlah',
    ];

    const rows: (string | number)[][] = [
      ['RINGKASAN', 'Total e-Book', '-', '-', '-', report.totals.ebooks],
      ['RINGKASAN', 'Total Anggota', '-', '-', '-', report.totals.members],
      [
        'RINGKASAN',
        'Transaksi Terverifikasi',
        '-',
        '-',
        '-',
        report.totals.verifiedTransactions,
      ],
      [
        'RINGKASAN',
        'Pendapatan Terverifikasi',
        '-',
        '-',
        '-',
        report.totals.verifiedRevenue,
      ],
      ['RINGKASAN', 'Total Aktivitas Baca', '-', '-', '-', report.totals.reads],
      [
        'RINGKASAN',
        'Total Aktivitas Unduh',
        '-',
        '-',
        '-',
        report.totals.downloads,
      ],
      ...report.categoryBreakdown.map((c) => [
        'KATEGORI E-BOOK',
        c.category,
        `Gratis: ${c.freeBooks}`,
        `Berbayar: ${c.paidBooks}`,
        '-',
        c.totalBooks,
      ]),
      ...report.bookStats.map((b) => [
        'STATISTIK E-BOOK',
        b.title,
        b.category,
        `Dibaca: ${b.reads}`,
        `Diunduh: ${b.downloads}`,
        b.price,
      ]),
      ...report.transactions.map((t) => [
        'TRANSAKSI',
        t.ebookTitle,
        t.memberEmail,
        t.memberName,
        t.status,
        t.amount,
      ]),
    ];

    downloadCsv('laporan-perpustakaan-digital-ai.csv', headers, rows);
  };

  if (loading || !report) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print-only-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Laporan Perpustakaan Digital
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            {isAdmin
              ? 'Rekapitulasi menyeluruh koleksi e-book, anggota, transaksi pembayaran, dan aktivitas pembaca.'
              : 'Ringkasan koleksi katalog, transaksi pribadi, dan aktivitas literasi Anda.'}{' '}
            · Dicetak: {formatDateTime(report.generatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadFullCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Laporan CSV</span>
          </button>
        </div>
      </div>

      {/* Print Letterhead */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="font-display text-xl font-bold text-slate-900">
          PERPUSTAKAAN PRIBADI DIGITAL AI INDONESIA
        </div>
        <div className="text-xs text-slate-600 mt-1">
          Laporan Resmi Sistem Perpustakaan · Tanggal Cetak:{' '}
          {formatDateTime(report.generatedAt)}
        </div>
      </div>

      {/* Rekapitulasi Angka Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Koleksi e-Book</div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {report.totals.ebooks}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">
            {isAdmin ? 'Total Anggota' : 'Akun Terdaftar'}
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {report.totals.members}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Pendapatan Terverifikasi</div>
          <div className="font-display text-xl font-bold text-teal-800 mt-1 tabular-nums">
            {formatRupiah(report.totals.verifiedRevenue)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {report.totals.verifiedTransactions} transaksi terverifikasi
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Aktivitas Literasi</div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {report.totals.reads + report.totals.downloads}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {report.totals.reads} Baca · {report.totals.downloads} Unduh
          </div>
        </div>
      </div>

      {/* Kategori & Statistik Buku */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Rekap e-Book per Kategori
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Kategori</th>
                  <th className="py-2.5 px-4 text-right">Gratis</th>
                  <th className="py-2.5 px-4 text-right">Berbayar</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.categoryBreakdown.map((row) => (
                  <tr key={row.category}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {row.category}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.freeBooks}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.paidBooks}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.totalBooks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Statistik Baca & Unduh per e-Book
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Judul e-Book</th>
                  <th className="py-2.5 px-4">Kategori</th>
                  <th className="py-2.5 px-4 text-right">Harga</th>
                  <th className="py-2.5 px-4 text-right">Baca</th>
                  <th className="py-2.5 px-4 text-right">Unduh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.bookStats.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {b.title}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {b.category}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums text-slate-700">
                      {formatRupiah(b.price)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {b.reads}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-800">
                      {b.downloads}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Rekap Transaksi */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {isAdmin ? 'Rekapitulasi Transaksi Pembayaran' : 'Riwayat Transaksi Anda'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Anggota</th>
                <th className="py-2.5 px-4">Judul e-Book</th>
                <th className="py-2.5 px-4 text-right">Nominal</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Belum ada catatan transaksi.
                  </td>
                </tr>
              ) : (
                report.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{t.memberName}</div>
                      <div className="text-xs text-slate-500">{t.memberEmail}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">{t.ebookTitle}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatRupiah(t.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium">
                      {t.status === 'verified'
                        ? 'Terverifikasi'
                        : t.status === 'rejected'
                        ? 'Ditolak'
                        : 'Menunggu Verifikasi'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
