import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { apiFetch, formatDateOnly, formatDateTime } from '../lib/api';
import { Member, SessionUser } from '../types';

interface MembersViewProps {
  user: SessionUser;
  members: Member[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  user,
  members,
  loading,
  onRefresh,
  onNotify,
}) => {
  const isAdmin = user.role === 'admin';
  const [search, setSearch] = useState('');

  // Visitor own profile edit state
  const ownMember = members[0] || null;
  const [editingOwn, setEditingOwn] = useState(false);
  const [ownName, setOwnName] = useState('');
  const [ownPhone, setOwnPhone] = useState('');
  const [ownInstitution, setOwnInstitution] = useState('');
  const [savingOwn, setSavingOwn] = useState(false);

  // Admin add/edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mInstitution, setMInstitution] = useState('');
  const [mStatus, setMStatus] = useState<'aktif' | 'nonaktif'>('aktif');
  const [mCanBooks, setMCanBooks] = useState(false);
  const [mCanVerify, setMCanVerify] = useState(false);
  const [savingAdminMember, setSavingAdminMember] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.institution.toLowerCase().includes(q)
    );
  }, [members, search]);

  const startEditOwn = () => {
    if (!ownMember) return;
    setOwnName(ownMember.name);
    setOwnPhone(ownMember.phone === '-' ? '' : ownMember.phone);
    setOwnInstitution(ownMember.institution);
    setEditingOwn(true);
  };

  const handleSaveOwn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownMember) return;
    setSavingOwn(true);
    try {
      await apiFetch(`/api/members/${ownMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: ownName.trim(),
          phone: ownPhone.trim() || '-',
          institution: ownInstitution.trim() || 'Pembaca Umum',
        }),
      });
      setEditingOwn(false);
      onNotify('Profil keanggotaan Anda berhasil diperbarui.');
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal memperbarui profil.',
        'error'
      );
    } finally {
      setSavingOwn(false);
    }
  };

  const openAdminAdd = () => {
    setEditingMember(null);
    setMName('');
    setMEmail('');
    setMPhone('');
    setMInstitution('');
    setMStatus('aktif');
    setMCanBooks(false);
    setMCanVerify(false);
    setModalError('');
    setShowModal(true);
  };

  const openAdminEdit = (m: Member) => {
    setEditingMember(m);
    setMName(m.name);
    setMEmail(m.email);
    setMPhone(m.phone === '-' ? '' : m.phone);
    setMInstitution(m.institution);
    setMStatus(m.status);
    setMCanBooks(Boolean(m.permissions?.canManageBooks));
    setMCanVerify(Boolean(m.permissions?.canVerifyPayments));
    setModalError('');
    setShowModal(true);
  };

  const handleSaveAdminMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSavingAdminMember(true);
    try {
      const payload = {
        name: mName.trim(),
        email: mEmail.trim(),
        phone: mPhone.trim() || '-',
        institution: mInstitution.trim() || 'Pembaca Umum',
        status: mStatus,
        permissions: {
          canManageBooks: mCanBooks,
          canVerifyPayments: mCanVerify,
        },
      };

      if (editingMember) {
        await apiFetch(`/api/members/${editingMember.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('Data anggota berhasil diperbarui.');
      } else {
        await apiFetch('/api/members', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('Anggota baru berhasil ditambahkan.');
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : 'Gagal menyimpan data anggota.'
      );
    } finally {
      setSavingAdminMember(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/members/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      onNotify(`Anggota "${deleteTarget.name}" berhasil dihapus.`);
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menghapus anggota.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  // VISITOR VIEW: Only see & edit own membership profile, NO delete action
  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Profil Keanggotaan Saya
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Anda terdaftar otomatis sebagai anggota perpustakaan. Anda dapat memperbarui data diri Anda di bawah ini.
          </p>
        </div>

        {loading || !ownMember ? (
          <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-teal-700" />
                <span className="font-display font-semibold text-slate-900">
                  Kartu Anggota Digital
                </span>
              </div>
              {!editingOwn && (
                <button
                  type="button"
                  onClick={startEditOwn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profil</span>
                </button>
              )}
            </div>

            {editingOwn ? (
              <form onSubmit={handleSaveOwn} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={ownName}
                    onChange={(e) => setOwnName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Terdaftar
                  </label>
                  <input
                    type="email"
                    disabled
                    value={ownMember.email}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      No. Telepon
                    </label>
                    <input
                      type="text"
                      value={ownPhone}
                      onChange={(e) => setOwnPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Instansi / Asal
                    </label>
                    <input
                      type="text"
                      value={ownInstitution}
                      onChange={(e) => setOwnInstitution(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingOwn(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingOwn}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingOwn ? 'Menyimpan...' : 'Simpan Profil'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Nama Lengkap</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {ownMember.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Alamat Email</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {ownMember.email}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Nomor Telepon</div>
                  <div className="font-mono text-slate-900 mt-0.5">
                    {ownMember.phone}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Instansi / Asal</div>
                  <div className="text-slate-900 mt-0.5">{ownMember.institution}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status Keanggotaan</div>
                  <div className="font-medium text-emerald-700 mt-0.5">
                    {ownMember.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Terdaftar Sejak</div>
                  <div className="text-slate-900 mt-0.5 tabular-nums">
                    {formatDateOnly(ownMember.joinedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ADMIN VIEW: Full Data Anggota management
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Data Anggota Perpustakaan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola seluruh anggota terdaftar otomatis maupun manual, status keanggotaan, dan hak akses tambahan.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdminAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Anggota</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, atau instansi anggota..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">Instansi & Kontak</th>
                <th className="py-3 px-4">Tanggal Bergabung</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Kewenangan Tambahan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Memuat data anggota...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Tidak ada anggota yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{m.institution}</div>
                      <div className="text-xs font-mono text-slate-500">{m.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      <div>{formatDateOnly(m.joinedAt)}</div>
                      <div className="text-slate-400">
                        Login: {formatDateTime(m.lastLoginAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium ${
                          m.status === 'aktif' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {m.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {!m.permissions?.canManageBooks &&
                      !m.permissions?.canVerifyPayments ? (
                        <span className="text-slate-400">Pengunjung Standar</span>
                      ) : (
                        <span>
                          {[
                            m.permissions?.canManageBooks && 'Kelola e-Book',
                            m.permissions?.canVerifyPayments && 'Verifikasi Transaksi',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdminEdit(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Anggota (Admin) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingMember ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminMember} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    No. Telepon
                  </label>
                  <input
                    type="text"
                    value={mPhone}
                    onChange={(e) => setMPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status Keanggotaan
                  </label>
                  <select
                    value={mStatus}
                    onChange={(e) =>
                      setMStatus(e.target.value as 'aktif' | 'nonaktif')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instansi / Asal
                </label>
                <input
                  type="text"
                  value={mInstitution}
                  onChange={(e) => setMInstitution(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Pemberian Kewenangan Akses Tambahan */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Shield className="w-3.5 h-3.5 text-teal-700" />
                  <span>Kewenangan Akses Tambahan (Opsional)</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mCanBooks}
                    onChange={(e) => setMCanBooks(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Izinkan kelola katalog e-Book (Tambah/Edit/Hapus)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mCanVerify}
                    onChange={(e) => setMCanVerify(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Izinkan akses verifikasi pembayaran Transaksi</span>
                </label>
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
                  disabled={savingAdminMember}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {savingAdminMember ? 'Menyimpan...' : 'Simpan Anggota'}
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
              Hapus Data Anggota?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              Anda yakin ingin menghapus anggota{' '}
              <strong className="text-slate-900">{deleteTarget.name}</strong> ({deleteTarget.email})?
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
                disabled={deleting}
                onClick={handleDeleteMember}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
