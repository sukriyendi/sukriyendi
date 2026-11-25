import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CreditCard,
  Download,
  Edit3,
  Megaphone,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, formatDateTime, formatRupiah } from '../lib/api';
import { DashboardData, SessionUser } from '../types';

interface DashboardViewProps {
  user: SessionUser;
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  data,
  loading,
  onNavigate,
  onRefresh,
  onNotify,
}) => {
  const isAdmin = user.role === 'admin';
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annActive, setAnnActive] = useState(true);
  const [savingAnn, setSavingAnn] = useState(false);

  const openAnnouncementEditor = () => {
    if (!data) return;
    setAnnTitle(data.announcement.title);
    setAnnContent(data.announcement.content);
    setAnnActive(data.announcement.isActive);
    setEditingAnnouncement(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnn(true);
    try {
      await apiFetch('/api/settings/announcement', {
        method: 'PUT',
        body: JSON.stringify({
          title: annTitle,
          content: annContent,
          isActive: annActive,
        }),
      });
      setEditingAnnouncement(false);
      onNotify('Papan informasi pengumuman berhasil diperbarui.');
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal memperbarui pengumuman.',
        'error'
      );
    } finally {
      setSavingAnn(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { summary, announcement, recentBooks, recentActivities } = data;

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 text-balance">
            Selamat Datang, {user.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAdmin
              ? 'Ringkasan koleksi e-book, keanggotaan, verifikasi pembayaran, dan aktivitas pembaca perpustakaan.'
              : 'Jelajahi koleksi e-book digital, pantau status pembayaran Anda, dan lihat catatan bacaan pribadi.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('ebooks')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <span>Jelajahi Katalog e-Book</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4-Column KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Total Koleksi e-Book</span>
            <BookOpen className="w-4 h-4 text-teal-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {summary.totalEbooks}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {summary.freeEbooks} Gratis · {summary.paidEbooks} Berbayar
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>{isAdmin ? 'Total Anggota Terdaftar' : 'Status Keanggotaan'}</span>
            <Users className="w-4 h-4 text-teal-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {isAdmin ? summary.totalMembers : 'Aktif'}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {isAdmin
              ? 'Anggota aktif tercatat otomatis'
              : `Terdaftar: ${user.email}`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>{isAdmin ? 'Transaksi Pembayaran' : 'Pembelian e-Book Anda'}</span>
            <CreditCard className="w-4 h-4 text-teal-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {summary.totalTransactions}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {summary.pendingTransactions} Menunggu Verifikasi · {summary.verifiedTransactions} Terverifikasi
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Aktivitas Baca & Unduh</span>
            <Download className="w-4 h-4 text-teal-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {summary.totalReads + summary.totalDownloads}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {summary.totalReads} Kali Dibaca · {summary.totalDownloads} Kali Diunduh
          </p>
        </div>
      </div>

      {/* Papan Informasi Pengumuman */}
      {(announcement.isActive || isAdmin) && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Papan Informasi Pengumuman
              </h2>
              {!announcement.isActive && isAdmin && (
                <span className="text-xs text-amber-700 font-medium">
                  · Disembunyikan dari Pengunjung
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                Diperbarui {formatDateTime(announcement.updatedAt)}
              </span>
              {isAdmin && !editingAnnouncement && (
                <button
                  type="button"
                  onClick={openAnnouncementEditor}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Pengumuman</span>
                </button>
              )}
            </div>
          </div>

          {editingAnnouncement ? (
            <form onSubmit={handleSaveAnnouncement} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Judul Pengumuman
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Isi Pengumuman
                </label>
                <textarea
                  rows={3}
                  required
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annActive}
                    onChange={(e) => setAnnActive(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Tampilkan pengumuman kepada Pengunjung</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncement(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Batal</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingAnn}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingAnn ? 'Menyimpan...' : 'Simpan Pengumuman'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-5">
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
                {announcement.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-4xl">
                {announcement.content}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Recent Collections & Recent Reading Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Koleksi e-Book Terbaru
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('ebooks')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline cursor-pointer whitespace-nowrap"
            >
              Lihat Semua
            </button>
          </div>
          {recentBooks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada koleksi e-book terdaftar.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentBooks.map((book) => (
                <div
                  key={book.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">
                      {book.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {book.author} · {book.category} · {book.year}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(book.price)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {book.inputMethod === 'upload' ? 'Berkas Digital' : 'Tautan URL'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {isAdmin ? 'Aktivitas Pembaca Terbaru' : 'Riwayat Baca Anda'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline cursor-pointer whitespace-nowrap"
            >
              Buka Riwayat
            </button>
          </div>
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada aktivitas baca atau unduhan.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {act.ebookTitle}
                    </span>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        act.action === 'download'
                          ? 'text-teal-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {act.action === 'download' ? 'Diunduh' : 'Dibaca'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {act.memberName} · {formatDateTime(act.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
