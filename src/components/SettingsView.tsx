import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Landmark, Megaphone } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Announcement, BankAccount } from '../types';

interface SettingsViewProps {
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefresh,
  onNotify,
}) => {
  const [loading, setLoading] = useState(true);

  // Announcement state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annActive, setAnnActive] = useState(true);
  const [savingAnn, setSavingAnn] = useState(false);

  // Bank state
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [instructions, setInstructions] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{
          announcement: Announcement;
          bankAccount: BankAccount;
        }>('/api/settings');
        if (!active) return;
        setAnnTitle(res.announcement.title);
        setAnnContent(res.announcement.content);
        setAnnActive(res.announcement.isActive);
        setBankName(res.bankAccount.bankName);
        setAccountNumber(res.bankAccount.accountNumber);
        setAccountHolder(res.bankAccount.accountHolder);
        setInstructions(res.bankAccount.instructions);
      } catch (err) {
        onNotify(
          err instanceof Error ? err.message : 'Gagal memuat pengaturan.',
          'error'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onNotify]);

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
      onNotify('Papan Informasi Pengumuman berhasil diperbarui.');
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menyimpan pengumuman.',
        'error'
      );
    } finally {
      setSavingAnn(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await apiFetch('/api/settings/bank', {
        method: 'PUT',
        body: JSON.stringify({
          bankName,
          accountNumber,
          accountHolder,
          instructions,
        }),
      });
      onNotify('Detail rekening bank Admin berhasil diperbarui.');
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menyimpan detail rekening.',
        'error'
      );
    } finally {
      setSavingBank(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/settings/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify(res.message || 'Password Admin berhasil diubah.');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal mengganti password.',
        'error'
      );
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Pengaturan Sistem Perpustakaan
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola Papan Informasi Pengumuman, rekening tujuan transfer Admin, dan keamanan password Administrator.
        </p>
      </div>

      {/* 1. Papan Informasi Pengumuman */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <Megaphone className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Kelola Papan Informasi Pengumuman
          </h2>
        </div>
        <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
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
                className="rounded border-slate-300 text-teal-700"
              />
              <span>Tampilkan di Dashboard untuk Pengunjung</span>
            </label>
            <button
              type="submit"
              disabled={savingAnn}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{savingAnn ? 'Menyimpan...' : 'Simpan Pengumuman'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Detail Rekening Bank Admin */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <Landmark className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Detail Rekening Bank Pembayaran Admin
          </h2>
        </div>
        <form onSubmit={handleSaveBank} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Bank
              </label>
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Contoh: Bank Mandiri"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor Rekening
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Atas Nama Pemilik
              </label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Instruksi Tambahan Transfer
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingBank}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{savingBank ? 'Menyimpan...' : 'Simpan Rekening Bank'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Ganti Password Admin */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Ganti Password Admin
          </h2>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password Saat Ini
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password Baru
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPass}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{savingPass ? 'Memperbarui...' : 'Perbarui Password'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
