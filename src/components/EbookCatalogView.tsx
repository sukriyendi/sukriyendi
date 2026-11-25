import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  FileUp,
  Link2,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  apiFetch,
  apiFetchBlob,
  formatFileSize,
  formatRupiah,
  isSafeHttpUrl,
} from '../lib/api';
import {
  BankAccount,
  BOOK_CATEGORIES,
  BookCategory,
  Ebook,
  SessionUser,
} from '../types';

interface EbookCatalogViewProps {
  user: SessionUser;
  ebooks: Ebook[];
  bankAccount: BankAccount;
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const EbookCatalogView: React.FC<EbookCatalogViewProps> = ({
  user,
  ebooks,
  bankAccount,
  loading,
  onRefresh,
  onNotify,
}) => {
  const canManageBooks =
    user.role === 'admin' || Boolean(user.permissions?.canManageBooks);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  // Add/Edit modal state
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Ebook | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formPublisher, setFormPublisher] = useState('');
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formPages, setFormPages] = useState('120');
  const [formCategory, setFormCategory] = useState<BookCategory>('Pendidikan');
  const [formPrice, setFormPrice] = useState('0');
  const [formDescription, setFormDescription] = useState('');
  const [formInputMethod, setFormInputMethod] = useState<'upload' | 'url'>('upload');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [submittingBook, setSubmittingBook] = useState(false);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<Ebook | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Payment modal
  const [paymentBook, setPaymentBook] = useState<Ebook | null>(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Reader modal
  const [readingBook, setReadingBook] = useState<Ebook | null>(null);
  const [readerMode, setReaderMode] = useState<
    'uploaded-pdf' | 'seeded-pdf' | 'uploaded-other' | 'url' | null
  >(null);
  const [readerBlobUrl, setReaderBlobUrl] = useState<string | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [brokenCovers, setBrokenCovers] = useState<Record<string, boolean>>({});

  const filteredBooks = useMemo(() => {
    return ebooks.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);
      const matchesCat =
        selectedCategory === 'Semua' || b.category === selectedCategory;
      const matchesPrice =
        priceFilter === 'all' ||
        (priceFilter === 'free' && b.price <= 0) ||
        (priceFilter === 'paid' && b.price > 0);
      return matchesSearch && matchesCat && matchesPrice;
    });
  }, [ebooks, searchQuery, selectedCategory, priceFilter]);

  const openAddModal = () => {
    setEditingBook(null);
    setFormTitle('');
    setFormAuthor('');
    setFormPublisher('');
    setFormYear(String(new Date().getFullYear()));
    setFormPages('120');
    setFormCategory('Pendidikan');
    setFormPrice('0');
    setFormDescription('');
    setFormInputMethod('upload');
    setFormExternalUrl('');
    setFormFile(null);
    setFormError('');
    setShowBookModal(true);
  };

  const openEditModal = (book: Ebook) => {
    setEditingBook(book);
    setFormTitle(book.title);
    setFormAuthor(book.author);
    setFormPublisher(book.publisher);
    setFormYear(String(book.year));
    setFormPages(String(book.pages || 120));
    setFormCategory(book.category);
    setFormPrice(String(book.price));
    setFormDescription(book.description);
    setFormInputMethod(book.inputMethod);
    setFormExternalUrl(book.externalUrl || '');
    setFormFile(null);
    setFormError('');
    setShowBookModal(true);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Client-side duplicate check for immediate feedback (server enforces as well)
    const duplicate = ebooks.find(
      (b) =>
        b.id !== editingBook?.id &&
        b.title.trim().toLowerCase() === formTitle.trim().toLowerCase()
    );
    if (duplicate) {
      setFormError(
        `Buku dengan judul "${formTitle.trim()}" sudah terdaftar di Master Data.`
      );
      return;
    }

    if (formInputMethod === 'upload' && !editingBook && !formFile) {
      setFormError('Silakan pilih file e-book untuk diunggah.');
      return;
    }

    if (formInputMethod === 'url' && !isSafeHttpUrl(formExternalUrl.trim())) {
      setFormError('Masukkan tautan URL yang valid diawali http:// atau https://.');
      return;
    }

    setSubmittingBook(true);
    try {
      const fd = new FormData();
      fd.append('title', formTitle.trim());
      fd.append('author', formAuthor.trim());
      fd.append('publisher', formPublisher.trim() || 'Pustaka Digital');
      fd.append('year', formYear);
      fd.append('pages', formPages);
      fd.append('category', formCategory);
      fd.append('price', formPrice || '0');
      fd.append('description', formDescription.trim());
      fd.append('inputMethod', formInputMethod);
      if (formInputMethod === 'url') {
        fd.append('externalUrl', formExternalUrl.trim());
      } else if (formFile) {
        fd.append('file', formFile);
      }

      if (editingBook) {
        await apiFetch(`/api/ebooks/${editingBook.id}`, {
          method: 'PUT',
          body: fd,
        });
        onNotify('Data e-book berhasil diperbarui.');
      } else {
        await apiFetch('/api/ebooks', {
          method: 'POST',
          body: fd,
        });
        onNotify('e-Book baru berhasil ditambahkan ke Master Data.');
      }
      setShowBookModal(false);
      onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan e-book.');
    } finally {
      setSubmittingBook(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/ebooks/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      onNotify(`e-Book "${deleteTarget.title}" berhasil dihapus.`);
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menghapus e-book.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenPayModal = (book: Ebook) => {
    setPaymentBook(book);
    setPaymentNote('');
    setCopiedAccount(false);
  };

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(bankAccount.accountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } catch {
      onNotify('Nomor rekening siap disalin manual.', 'error');
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBook) return;
    setSubmittingPayment(true);
    try {
      await apiFetch('/api/transactions/pay', {
        method: 'POST',
        body: JSON.stringify({
          ebookId: paymentBook.id,
          paymentNote: paymentNote.trim(),
        }),
      });
      setPaymentBook(null);
      onNotify(
        'Konfirmasi pembayaran dikirim. Menunggu verifikasi Admin sebelum file dapat diunduh.'
      );
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal mengirim konfirmasi pembayaran.',
        'error'
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const closeReader = () => {
    if (readerBlobUrl) {
      URL.revokeObjectURL(readerBlobUrl);
    }
    setReaderBlobUrl(null);
    setReadingBook(null);
    setReaderMode(null);
  };

  const handleReadBook = async (book: Ebook) => {
    setReadingBook(book);
    setReaderLoading(true);
    setReaderBlobUrl(null);
    try {
      const res = await apiFetch<{
        ebook: Ebook;
        mode: 'uploaded-pdf' | 'seeded-pdf' | 'uploaded-other' | 'url';
      }>(`/api/ebooks/${book.id}/read`, { method: 'POST' });

      setReaderMode(res.mode);
      if (res.mode === 'uploaded-pdf' || res.mode === 'seeded-pdf') {
        const { blob } = await apiFetchBlob(`/api/ebooks/${book.id}/file`);
        const url = URL.createObjectURL(blob);
        setReaderBlobUrl(url);
      }
      onRefresh();
    } catch (err) {
      setReadingBook(null);
      onNotify(
        err instanceof Error ? err.message : 'Tidak dapat membuka e-book.',
        'error'
      );
    } finally {
      setReaderLoading(false);
    }
  };

  const handleDownloadBook = async (book: Ebook) => {
    try {
      if (book.inputMethod === 'url') {
        const res = await apiFetch<{ type: string; url: string }>(
          `/api/ebooks/${book.id}/download`
        );
        if (res.url && isSafeHttpUrl(res.url)) {
          const anchor = document.createElement('a');
          anchor.href = res.url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
        onNotify(`Mengakses tautan unduhan "${book.title}". Riwayat tercatat.`);
        onRefresh();
        return;
      }

      const { blob, filename } = await apiFetchBlob(
        `/api/ebooks/${book.id}/download`
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || book.fileName || `${book.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onNotify(`Berhasil mengunduh "${book.title}". Tercatat di Riwayat Pembaca.`);
      onRefresh();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal mengunduh e-book.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Data e-Book Perpustakaan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {canManageBooks
              ? 'Kelola koleksi e-book digital (unggah file atau tautan eksternal) beserta kategori dan harga.'
              : 'Baca koleksi gratis atau lakukan pembayaran transfer untuk membuka akses unduh e-book berbayar.'}
          </p>
        </div>

        {canManageBooks && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah e-Book</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul buku, penulis, atau kategori..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter kategori e-book"
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700 text-slate-700"
          >
            <option value="Semua">Semua Kategori (11)</option>
            {BOOK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'free', label: 'Gratis' },
              { id: 'paid', label: 'Berbayar' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPriceFilter(item.id as 'all' | 'free' | 'paid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  priceFilter === item.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
            Tidak Ada e-Book Ditemukan
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Sesuaikan kata kunci pencarian atau pilih kategori lain untuk melihat koleksi yang tersedia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredBooks.map((book) => {
            const isFree = book.price <= 0;
            const access = book.accessStatus || (isFree ? 'free' : 'unpaid');
            const isUnlocked = user.role === 'admin' || isFree || access === 'verified';
            const isPending = user.role !== 'admin' && access === 'pending';
            const isRejected = user.role !== 'admin' && access === 'rejected';

            return (
              <article
                key={book.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
              >
                <div className="p-5 flex gap-4 flex-1">
                  {/* Cover Thumbnail */}
                  <div className="w-20 h-28 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {book.coverImage && !brokenCovers[book.id] ? (
                      <img
                        src={book.coverImage}
                        alt={`Sampul ${book.title}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenCovers((prev) => ({ ...prev, [book.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Metadata (Zero-pill clean inline typography) */}
                  <div className="min-w-0 flex-1 flex flex-col">
                    <div className="text-xs text-teal-800 font-medium truncate">
                      {book.category}
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                      {book.title}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1 truncate">
                      {book.author} · {book.year}
                    </div>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {book.description}
                    </p>

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2 text-xs border-t border-slate-100">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(book.price)}
                      </span>
                      <span className="text-slate-500 truncate">
                        {book.inputMethod === 'upload'
                          ? `File · ${formatFileSize(book.fileSize)}`
                          : 'Tautan Eksternal'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  {/* Primary Reader / Payment Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isUnlocked ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReadBook(book)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Baca</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadBook(book)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {book.inputMethod === 'url' ? (
                            <ExternalLink className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download</span>
                        </button>
                        {!isFree && user.role !== 'admin' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terverifikasi</span>
                          </span>
                        )}
                      </>
                    ) : isPending ? (
                      <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Menunggu Verifikasi Admin</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(book)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{isRejected ? 'Bayar Ulang' : 'Bayar'}</span>
                        </button>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Lock className="w-3 h-3" />
                          <span>
                            {isRejected
                              ? 'Ditolak · Perlu pembayaran ulang'
                              : 'Terkunci hingga dibayar'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Admin / Authorized Manager Edit & Delete Actions (Hidden for standard Visitors) */}
                  {canManageBooks && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(book)}
                        title="Edit e-Book"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(book)}
                        title="Hapus e-Book"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Tambah / Edit e-Book */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl my-8 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingBook ? 'Edit Data e-Book' : 'Tambah e-Book Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Judul e-Book <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Masukkan judul lengkap e-book"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Penulis <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="Nama penulis"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Penerbit
                  </label>
                  <input
                    type="text"
                    value={formPublisher}
                    onChange={(e) => setFormPublisher(e.target.value)}
                    placeholder="Nama penerbit"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as BookCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 bg-white"
                  >
                    {BOOK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tahun Terbit
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Harga (Rp, 0 = Gratis)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 tabular-nums"
                  />
                </div>
              </div>

              {/* 2 Metode Input Buku */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Metode Input Sumber e-Book <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormInputMethod('upload')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      formInputMethod === 'upload'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileUp className="w-4 h-4" />
                    <span>1. Upload File e-Book</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormInputMethod('url')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      formInputMethod === 'url'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>2. Input Tautan URL Eksternal</span>
                  </button>
                </div>

                {formInputMethod === 'upload' ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
                    <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center">
                      <Upload className="w-5 h-5 text-teal-700" />
                      <span className="text-xs font-medium text-slate-700">
                        {formFile
                          ? `File dipilih: ${formFile.name} (${formatFileSize(formFile.size)})`
                          : editingBook?.fileName
                          ? `File saat ini: ${editingBook.fileName} (Klik untuk mengganti)`
                          : 'Pilih file PDF, EPUB, TXT, atau DOCX (maks. 50 MB)'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.epub,.txt,.doc,.docx"
                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={formExternalUrl}
                    onChange={(e) => setFormExternalUrl(e.target.value)}
                    placeholder="https://contoh-sumber-buku.id/dokumen.pdf"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi / Sinopsis Singkat
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ringkasan isi buku..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingBook}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {submittingBook
                    ? 'Menyimpan...'
                    : editingBook
                    ? 'Simpan Perubahan'
                    : 'Simpan e-Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
              Hapus Data e-Book?
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              Anda akan menghapus <strong className="text-slate-900">{deleteTarget.title}</strong> dari Master Data. Tindakan ini tidak dapat dibatalkan.
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
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Instruksi Pembayaran Transfer Bank */}
      {paymentBook && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Pembayaran Koleksi e-Book
              </h2>
              <button
                type="button"
                onClick={() => setPaymentBook(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Item e-Book</div>
                <div className="font-display font-semibold text-slate-900 mt-0.5">
                  {paymentBook.title}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-600">Total Nominal Transfer</span>
                  <span className="font-display text-lg font-bold text-teal-800 tabular-nums">
                    {formatRupiah(paymentBook.price)}
                  </span>
                </div>
              </div>

              {/* Detail Rekening Tujuan Admin */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  Rekening Tujuan Transfer Admin
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Bank</span>
                  <span className="font-semibold text-slate-900">
                    {bankAccount.bankName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Nomor Rekening</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {bankAccount.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedAccount ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Atas Nama</span>
                  <span className="font-medium text-slate-900">
                    {bankAccount.accountHolder}
                  </span>
                </div>
                <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 leading-relaxed">
                  {bankAccount.instructions}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan / Referensi Transfer Anda
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Contoh: Transfer BCA an. Budi Santoso Ref #12345"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentBook(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {submittingPayment
                    ? 'Mengirim...'
                    : 'Konfirmasi Sudah Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pembaca e-Book */}
      {readingBook && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-slate-900 truncate">
                  {readingBook.title}
                </h2>
                <div className="text-xs text-slate-500 truncate">
                  {readingBook.author} · {readingBook.category}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadBook(readingBook)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={closeReader}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center">
              {readerLoading ? (
                <div className="text-sm text-slate-600">Memuat dokumen digital...</div>
              ) : (readerMode === 'uploaded-pdf' || readerMode === 'seeded-pdf') &&
                readerBlobUrl ? (
                <iframe
                  src={readerBlobUrl}
                  title={readingBook.title}
                  className="w-full h-full border-0 bg-white"
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-8 m-6 text-center space-y-4">
                  <BookOpen className="w-10 h-10 text-teal-700 mx-auto" />
                  <h3 className="font-display text-xl font-bold text-slate-900">
                    {readingBook.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {readingBook.description}
                  </p>
                  {readingBook.inputMethod === 'url' &&
                  isSafeHttpUrl(readingBook.externalUrl) ? (
                    <a
                      href={readingBook.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Buka Sumber e-Book Eksternal</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownloadBook(readingBook)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Berkas ({readingBook.fileName || 'e-Book'})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
