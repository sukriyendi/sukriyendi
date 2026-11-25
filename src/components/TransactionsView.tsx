import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch, formatDateTime, formatRupiah } from '../lib/api';
import { Ebook, Member, SessionUser, Transaction, TransactionStatus } from '../types';

interface TransactionsViewProps {
  user: SessionUser;
  transactions: Transaction[];
  members: Member[];
  paidEbooks: Ebook[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  user,
  transactions,
  members,
  paidEbooks,
  loading,
  onRefresh,
  onNotify,
}) => {
  const isAdmin = user.role === 'admin';
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [search, setSearch] = useState('');

  // Modal Tambah/Edit
  const [showModal, setShowModal] = useState(false);
  const [editingTrx, setEditingTrx] = useState<Transaction | null>(null);
  const [tMemberId, setTMemberId] = useState('');
  const [tEbookId, setTEbookId] = useState('');
  const [tAmount, setTAmount] = useState('0');
  const [tMethod, setTMethod] = useState('Transfer Bank');
  const [tNote, setTNote] = useState('');
  const [tStatus, setTStatus] = useState<TransactionStatus>('pending');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.memberName.toLowerCase().includes(q) ||
        t.memberEmail.toLowerCase().includes(q) ||
        t.ebookTitle.toLowerCase().includes(q) ||
        t.paymentNote.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [transactions, statusFilter, search]);

  const stats = useMemo(() => {
    const pending = transactions.filter((t) => t.status === 'pending').length;
    const verified = transactions.filter((t) => t.status === 'verified');
    const revenue = verified.reduce((sum, t) => sum + t.amount, 0);
    return { total: transactions.length, pending, verifiedCount: verified.length, revenue };
  }, [transactions]);

  const openAddModal = () => {
    setEditingTrx(null);
    const firstMember = members[0]?.id || '';
    const firstBook = paidEbooks[0];
    setTMemberId(firstMember);
    setTEbookId(firstBook?.id || '');
    setTAmount(String(firstBook?.price || 0));
    setTMethod('Transfer Bank');
    setTNote('');
    setTStatus('pending');
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (trx: Transaction) => {
    setEditingTrx(trx);
    setTMemberId(trx.memberId);
    setTEbookId(trx.ebookId);
    setTAmount(String(trx.amount));
    setTMethod(trx.paymentMethod);
    setTNote(trx.paymentNote);
    setTStatus(trx.status);
    setModalError('');
    setShowModal(true);
  };

  const handleBookChange = (bookId: string) => {
    setTEbookId(bookId);
    const found = paidEbooks.find((b) => b.id === bookId);
    if (found) {
      setTAmount(String(found.price));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);
    try {
      const payload = {
        memberId: tMemberId,
        ebookId: tEbookId,
        amount: Number(tAmount) || 0,
        paymentMethod: tMethod,
        paymentNote: tNote,
        status: tStatus,
      };
      if (editingTrx) {
        await apiFetch(`/api/transactions/${editingTrx.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('Data transaksi berhasil diperbarui.');
      } else {
        await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('Transaksi baru berhasil dicatat.');
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (trx: Transaction) => {
    try {
      await apiFetch(`/api/transactions/${trx.id}/verify`, { method: 'POST' });
      onNotify(
        `Pembayaran "${trx.ebookTitle}" oleh ${trx.memberName} diverifikasi. Akses unduh otomatis terbuka.`
      );
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal memverifikasi transaksi.',
        'error'
      );
    }
  };

  const handleReject = async (trx: Transaction) => {
    try {
      await apiFetch(`/api/transactions/${trx.id}/reject`, { method: 'POST' });
      onNotify(`Transaksi oleh ${trx.memberName} ditandai ditolak.`);
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menolak transaksi.',
        'error'
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/transactions/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      onNotify('Data transaksi berhasil dihapus.');
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menghapus transaksi.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Transaksi & Verifikasi Pembayaran
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola pembayaran e-book berbayar dan klik Verifikasi Pembayaran untuk membuka akses unduh pembeli secara otomatis.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Transaksi</span>
          </button>
        )}
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Transaksi</div>
          <div className="font-display text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Menunggu Verifikasi</div>
          <div className="font-display text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Terverifikasi</div>
          <div className="font-display text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {stats.verifiedCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Pendapatan Terverifikasi</div>
          <div className="font-display text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatRupiah(stats.revenue)}
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email pembeli, atau judul buku..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'pending', label: 'Menunggu Verifikasi' },
            { id: 'verified', label: 'Terverifikasi' },
            { id: 'rejected', label: 'Ditolak' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as 'all' | TransactionStatus)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Pembaca / Email</th>
                <th className="py-3 px-4">e-Book Berbayar</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Memuat data transaksi...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Belum ada transaksi pada filter ini.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{t.memberName}</div>
                      <div className="text-xs text-slate-500">{t.memberEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 max-w-xs truncate">
                        {t.ebookTitle}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">
                        {t.paymentMethod} · {t.paymentNote}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(t.amount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {t.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Terverifikasi</span>
                        </span>
                      ) : t.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Ditolak</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Menunggu Verifikasi</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {t.status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => handleVerify(t)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi Pembayaran</span>
                          </button>
                        )}
                        {t.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleReject(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg cursor-pointer"
                          >
                            <span>Tolak</span>
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingTrx ? 'Edit Transaksi' : 'Tambah Transaksi Pembayaran'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pembeli (Anggota) <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={tMemberId}
                  onChange={(e) => setTMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="">-- Pilih Anggota --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  e-Book Berbayar <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={tEbookId}
                  onChange={(e) => handleBookChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="">-- Pilih e-Book --</option>
                  {paidEbooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({formatRupiah(b.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nominal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tAmount}
                    onChange={(e) => setTAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status Transaksi
                  </label>
                  <select
                    value={tStatus}
                    onChange={(e) =>
                      setTStatus(e.target.value as TransactionStatus)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                  >
                    <option value="pending">Menunggu Verifikasi</option>
                    <option value="verified">Terverifikasi</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Metode Pembayaran
                </label>
                <input
                  type="text"
                  value={tMethod}
                  onChange={(e) => setTMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan / Referensi
                </label>
                <input
                  type="text"
                  value={tNote}
                  onChange={(e) => setTNote(e.target.value)}
                  placeholder="Contoh: Transfer Mandiri Ref #9910"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
              Hapus Transaksi?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              Transaksi untuk <strong className="text-slate-900">{deleteTarget.ebookTitle}</strong> oleh {deleteTarget.memberName} akan dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
