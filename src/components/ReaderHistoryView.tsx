import React, { useMemo, useState } from 'react';
import { BookOpen, Download, Printer, Search } from 'lucide-react';
import { downloadCsv, formatDateTime } from '../lib/api';
import {
  MemberHistorySummary,
  ReaderHistoryEntry,
  SessionUser,
} from '../types';

interface ReaderHistoryViewProps {
  user: SessionUser;
  entries: ReaderHistoryEntry[];
  memberSummaries: MemberHistorySummary[];
  loading: boolean;
}

export const ReaderHistoryView: React.FC<ReaderHistoryViewProps> = ({
  user,
  entries,
  memberSummaries,
  loading,
}) => {
  const isAdmin = user.role === 'admin';
  const [selectedEmail, setSelectedEmail] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'read' | 'download'>('all');
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const matchMember =
        selectedEmail === 'all' ||
        item.memberEmail.toLowerCase() === selectedEmail.toLowerCase();
      const matchAction =
        actionFilter === 'all' || item.action === actionFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.ebookTitle.toLowerCase().includes(q) ||
        item.memberName.toLowerCase().includes(q) ||
        item.memberEmail.toLowerCase().includes(q) ||
        item.ebookCategory.toLowerCase().includes(q);
      return matchMember && matchAction && matchSearch;
    });
  }, [entries, selectedEmail, actionFilter, search]);

  const handleExportCsv = () => {
    const headers = [
      'Waktu Aktivitas',
      'Nama Anggota',
      'Email Anggota',
      'Judul e-Book',
      'Kategori',
      'Jenis Aktivitas',
    ];
    const rows = filteredEntries.map((e) => [
      formatDateTime(e.timestamp),
      e.memberName,
      e.memberEmail,
      e.ebookTitle,
      e.ebookCategory,
      e.action === 'download' ? 'Mengunduh (Download)' : 'Membaca (Baca)',
    ]);
    downloadCsv('riwayat-pembaca-perpustakaan.csv', headers, rows);
  };

  return (
    <div className="space-y-6 print-only-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Riwayat Pembaca {isAdmin ? 'Per Anggota' : 'Saya'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Setiap aktivitas membuka bacaan dan mengunduh file e-book tercatat otomatis di sini.
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Per Anggota */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Ringkasan Aktivitas Per Anggota
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50/50">
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4 text-right">Total Dibaca</th>
                <th className="py-3 px-4 text-right">Total Diunduh</th>
                <th className="py-3 px-4 text-right">Total Aktivitas</th>
                <th className="py-3 px-4">Aktivitas Terakhir</th>
                {isAdmin && <th className="py-3 px-4 text-right no-print">Filter</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Memuat ringkasan riwayat...
                  </td>
                </tr>
              ) : memberSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Belum ada riwayat aktivitas pembaca.
                  </td>
                </tr>
              ) : (
                memberSummaries.map((s) => (
                  <tr key={s.memberEmail} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{s.memberName}</div>
                      <div className="text-xs text-slate-500">{s.memberEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {s.totalReads}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-800 font-semibold">
                      {s.totalDownloads}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {s.totalActivities}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      {formatDateTime(s.lastActivityAt)}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right no-print">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmail(
                              selectedEmail === s.memberEmail ? 'all' : s.memberEmail
                            )
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                            selectedEmail === s.memberEmail
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {selectedEmail === s.memberEmail ? 'Tampilkan Semua' : 'Lihat Log'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul e-book atau nama anggota..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <select
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">Semua Anggota</option>
              {memberSummaries.map((s) => (
                <option key={s.memberEmail} value={s.memberEmail}>
                  {s.memberName} ({s.memberEmail})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'read', label: 'Baca' },
              { id: 'download', label: 'Download' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActionFilter(tab.id as 'all' | 'read' | 'download')
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  actionFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log Detail */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Catatan Kronologis Baca & Unduh
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {filteredEntries.length} catatan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">Judul e-Book</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Tidak ada catatan aktivitas yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(item.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {item.memberName}
                      </div>
                      <div className="text-xs text-slate-500">{item.memberEmail}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.ebookTitle}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {item.ebookCategory}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.action === 'download' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                          <Download className="w-3.5 h-3.5" />
                          <span>Mengunduh</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Membaca</span>
                        </span>
                      )}
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
