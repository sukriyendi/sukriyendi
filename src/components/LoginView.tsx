import React, { useState } from 'react';
import { BookOpen, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { SessionUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: SessionUser, welcomeNotice?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'visitor' | 'admin'>('visitor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Visitor fields
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorInstitution, setVisitorInstitution] = useState('');

  // Admin fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        token: string;
        user: SessionUser;
        isNewMember: boolean;
      }>('/api/auth/login-visitor', {
        method: 'POST',
        body: JSON.stringify({
          name: visitorName,
          email: visitorEmail,
          phone: visitorPhone,
          institution: visitorInstitution,
        }),
      });
      setAuthToken(res.token);
      const notice = res.isNewMember
        ? `Selamat datang, ${res.user.name}. Akun Anda otomatis tercatat ke Data Anggota.`
        : `Selamat datang kembali, ${res.user.name}.`;
      onLoginSuccess(res.user, notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk sebagai pengunjung.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: SessionUser }>(
        '/api/auth/login-admin',
        {
          method: 'POST',
          body: JSON.stringify({
            username: adminUsername,
            password: adminPassword,
          }),
        }
      );
      setAuthToken(res.token);
      onLoginSuccess(res.user, 'Berhasil masuk sebagai Administrator Perpustakaan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login Admin gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Editorial Hero Panel */}
      <div className="relative lg:w-1/2 min-h-[260px] lg:min-h-screen bg-slate-900 overflow-hidden flex flex-col justify-between">
        <img
          src="/src/assets/images/library_hero_archive_1795615405036.jpg"
          alt="Ruang baca Perpustakaan Pribadi Digital AI Indonesia"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/55 to-slate-900/35"
          aria-hidden="true"
        />

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-lg bg-teal-600/90 border border-teal-400/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            Perpustakaan Pribadi Digital AI Indonesia
          </span>
        </div>

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-xl text-white">
          <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight text-balance mb-4">
            Akses Literasi Digital Terkurasi dalam Satu Ruang Baca Terpadu
          </h1>
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
            Kelola katalog e-book lintas disiplin ilmu, pantau riwayat baca dan unduhan anggota, serta verifikasi transaksi koleksi berbayar secara transparan dan aman.
          </p>
        </div>
      </div>

      {/* Right Auth Workspace */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
              Masuk ke Perpustakaan
            </h2>
            <p className="text-sm text-slate-600">
              Pilih mode akses Pengunjung untuk membaca koleksi atau Admin untuk mengelola seluruh sistem.
            </p>
          </div>

          {/* Mode Segmented Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('visitor');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'visitor'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Pengunjung</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {mode === 'visitor' ? (
            <form onSubmit={handleVisitorSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nama Lengkap <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Contoh: Adi Pratama"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Alamat Email <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    No. Telepon
                  </label>
                  <input
                    type="text"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Instansi / Asal
                  </label>
                  <input
                    type="text"
                    value={visitorInstitution}
                    onChange={(e) => setVisitorInstitution(e.target.value)}
                    placeholder="Kampus / Umum"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Pengunjung dapat masuk tanpa password admin. Saat pertama kali masuk, email Anda akan otomatis didaftarkan ke dalam Data Anggota.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Memproses...' : 'Masuk Sebagai Pengunjung'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Username Admin
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Kredensial default: username <span className="font-mono font-semibold text-slate-900">admin</span> dan password <span className="font-mono font-semibold text-slate-900">admin</span>. Password dapat diubah melalui menu Pengaturan.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Memverifikasi...' : 'Masuk Sebagai Admin'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
