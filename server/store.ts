import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  Announcement,
  BankAccount,
  Ebook,
  Member,
  ReaderHistoryEntry,
  Transaction,
} from '../src/types';

export interface StoredEbook extends Ebook {
  storedFile?: string;
}

export interface LibraryDatabase {
  adminConfig: {
    username: string;
    passwordHash: string;
  };
  announcement: Announcement;
  bankAccount: BankAccount;
  ebooks: StoredEbook[];
  members: Member[];
  transactions: Transaction[];
  readerHistory: ReaderHistoryEntry[];
}

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'library-db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function createInitialDatabase(): LibraryDatabase {
  const now = new Date();
  const iso = (daysAgo: number, hoursAgo = 0) =>
    new Date(now.getTime() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();

  const ebooks: StoredEbook[] = [
    {
      id: 'ebk-001',
      title: 'Fondasi Kecerdasan Buatan untuk Ekosistem Nusantara',
      author: 'Dr. Hendra Wijaya, M.Kom.',
      publisher: 'Pustaka Digital Nusantara',
      year: 2025,
      category: 'Sains dan Teknologi',
      description:
        'Panduan komprehensif mengenai arsitektur kecerdasan buatan modern, pemrosesan bahasa alami untuk bahasa daerah Indonesia, serta etika penerapan AI di sektor publik.',
      price: 0,
      inputMethod: 'upload',
      fileName: 'Fondasi-AI-Nusantara.pdf',
      storedFile: 'seeded:ebk-001',
      fileSize: 1843200,
      fileMimeType: 'application/pdf',
      coverImage: '/src/assets/images/cover_tech_indonesia_1795615405528.jpg',
      pages: 214,
      createdAt: iso(18),
      updatedAt: iso(18),
    },
    {
      id: 'ebk-002',
      title: 'Arsitektur Ekonomi Digital & Koperasi Modern Indonesia',
      author: 'Prof. Ratna Dewi Lestari',
      publisher: 'Balai Ekonomi Terapan',
      year: 2025,
      category: 'Ekonomi',
      description:
        'Analisis mendalam transformasi UMKM, sistem pembayaran nasional, dan model pembiayaan mikro berbasis teknologi untuk pemerataan ekonomi daerah.',
      price: 75000,
      inputMethod: 'upload',
      fileName: 'Arsitektur-Ekonomi-Digital.pdf',
      storedFile: 'seeded:ebk-002',
      fileSize: 2457600,
      fileMimeType: 'application/pdf',
      coverImage: '/src/assets/images/cover_economy_law_1795615407195.jpg',
      pages: 268,
      createdAt: iso(14),
      updatedAt: iso(14),
    },
    {
      id: 'ebk-003',
      title: 'Jejak Maritim & Sastra Pesisir Kepulauan',
      author: 'Mochtar Kusumaatmadja Jr.',
      publisher: 'Lembaga Kajian Budaya',
      year: 2024,
      category: 'Sejarah dan Geografi',
      description:
        'Menelusuri jalur niaga rempah, naskah kuno pesisir, dan peradaban bahari yang membentuk identitas kebudayaan maritim Nusantara.',
      price: 0,
      inputMethod: 'upload',
      fileName: 'Jejak-Maritim-Kepulauan.pdf',
      storedFile: 'seeded:ebk-003',
      fileSize: 1520000,
      fileMimeType: 'application/pdf',
      coverImage: '/src/assets/images/cover_culture_archipelago_1795615407016.jpg',
      pages: 192,
      createdAt: iso(11),
      updatedAt: iso(11),
    },
    {
      id: 'ebk-004',
      title: 'Hukum Perlindungan Data Pribadi di Era AI',
      author: 'Arief Rahman Hakim, S.H., LL.M.',
      publisher: 'Media Konstitusi',
      year: 2025,
      category: 'Hukum',
      description:
        'Kajian normatif dan implementasi praktis UU Perlindungan Data Pribadi bagi penyelenggara sistem elektronik, lembaga pendidikan, dan perusahaan rintisan.',
      price: 95000,
      inputMethod: 'upload',
      fileName: 'Hukum-PDP-Era-AI.pdf',
      storedFile: 'seeded:ebk-004',
      fileSize: 2100000,
      fileMimeType: 'application/pdf',
      coverImage: '/src/assets/images/cover_economy_law_1795615407195.jpg',
      pages: 240,
      createdAt: iso(8),
      updatedAt: iso(8),
    },
    {
      id: 'ebk-005',
      title: 'Pedagogi Kurikulum Merdeka & Literasi Digital',
      author: 'Dra. Siti Aminah, M.Pd.',
      publisher: 'Cendekia Edukasi',
      year: 2025,
      category: 'Pendidikan',
      description:
        'Strategi pembelajaran aktif di sekolah menengah dan perguruan tinggi dengan pemanfaatan sumber belajar digital yang inklusif.',
      price: 45000,
      inputMethod: 'url',
      externalUrl: 'https://buku.kemdikbud.go.id/',
      coverImage: '/src/assets/images/cover_tech_indonesia_1795615405528.jpg',
      pages: 156,
      createdAt: iso(5),
      updatedAt: iso(5),
    },
    {
      id: 'ebk-006',
      title: 'Antologi Puisi & Estetika Seni Rupa Nusantara',
      author: 'Dewi Anggraini',
      publisher: 'Sastra Aksara',
      year: 2024,
      category: 'Seni dan Budaya',
      description:
        'Kumpulan esai seni rupa kontemporer dan antologi puisi modern yang memadukan motif tradisi lokal dengan ekspresi visual masa kini.',
      price: 0,
      inputMethod: 'url',
      externalUrl: 'https://repositori.kemdikbud.go.id/',
      coverImage: '/src/assets/images/cover_culture_archipelago_1795615407016.jpg',
      pages: 132,
      createdAt: iso(3),
      updatedAt: iso(3),
    },
  ];

  const members: Member[] = [
    {
      id: 'mbr-001',
      name: 'Budi Santoso',
      email: 'budi.santoso@nusantara.id',
      phone: '081234567890',
      institution: 'Universitas Negeri Yogyakarta',
      status: 'aktif',
      permissions: { canManageBooks: false, canVerifyPayments: false },
      joinedAt: iso(12),
      lastLoginAt: iso(1),
    },
    {
      id: 'mbr-002',
      name: 'Siti Rahmawati',
      email: 'siti.rahma@akademik.id',
      phone: '085611223344',
      institution: 'Institut Teknologi Bandung',
      status: 'aktif',
      permissions: { canManageBooks: false, canVerifyPayments: false },
      joinedAt: iso(6),
      lastLoginAt: iso(0, 4),
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'trx-001',
      memberId: 'mbr-001',
      memberName: 'Budi Santoso',
      memberEmail: 'budi.santoso@nusantara.id',
      ebookId: 'ebk-002',
      ebookTitle: 'Arsitektur Ekonomi Digital & Koperasi Modern Indonesia',
      amount: 75000,
      status: 'verified',
      paymentMethod: 'Transfer Bank',
      paymentNote: 'Transfer BCA an. Budi Santoso Ref #88219',
      createdAt: iso(4),
      verifiedAt: iso(3, 18),
      verifiedBy: 'admin',
    },
    {
      id: 'trx-002',
      memberId: 'mbr-002',
      memberName: 'Siti Rahmawati',
      memberEmail: 'siti.rahma@akademik.id',
      ebookId: 'ebk-004',
      ebookTitle: 'Hukum Perlindungan Data Pribadi di Era AI',
      amount: 95000,
      status: 'pending',
      paymentMethod: 'Transfer Bank',
      paymentNote: 'Transfer Mandiri an. Siti Rahmawati Ref #49102',
      createdAt: iso(0, 3),
    },
  ];

  const readerHistory: ReaderHistoryEntry[] = [
    {
      id: 'his-001',
      memberId: 'mbr-001',
      memberName: 'Budi Santoso',
      memberEmail: 'budi.santoso@nusantara.id',
      ebookId: 'ebk-001',
      ebookTitle: 'Fondasi Kecerdasan Buatan untuk Ekosistem Nusantara',
      ebookCategory: 'Sains dan Teknologi',
      action: 'read',
      timestamp: iso(5, 2),
    },
    {
      id: 'his-002',
      memberId: 'mbr-001',
      memberName: 'Budi Santoso',
      memberEmail: 'budi.santoso@nusantara.id',
      ebookId: 'ebk-002',
      ebookTitle: 'Arsitektur Ekonomi Digital & Koperasi Modern Indonesia',
      ebookCategory: 'Ekonomi',
      action: 'download',
      timestamp: iso(3, 12),
    },
    {
      id: 'his-003',
      memberId: 'mbr-002',
      memberName: 'Siti Rahmawati',
      memberEmail: 'siti.rahma@akademik.id',
      ebookId: 'ebk-003',
      ebookTitle: 'Jejak Maritim & Sastra Pesisir Kepulauan',
      ebookCategory: 'Sejarah dan Geografi',
      action: 'read',
      timestamp: iso(1, 5),
    },
  ];

  return {
    adminConfig: {
      username: 'admin',
      passwordHash: hashPassword('admin'),
    },
    announcement: {
      title: 'Selamat Datang di Perpustakaan Pribadi Digital AI Indonesia',
      content:
        'Koleksi e-book edisi terbaru bidang Sains dan Teknologi, Ekonomi, serta Hukum kini tersedia untuk dibaca dan diunduh. Untuk buku berbayar, silakan lakukan transfer ke rekening resmi Admin yang tertera saat pembayaran, lalu tunggu verifikasi agar tombol unduh terbuka otomatis.',
      isActive: true,
      updatedAt: iso(1),
      updatedBy: 'admin',
    },
    bankAccount: {
      bankName: 'Bank Mandiri',
      accountNumber: '1370019283745',
      accountHolder: 'Perpustakaan Digital AI Indonesia',
      instructions:
        'Cantumkan email anggota atau judul e-book pada berita transfer, lalu tekan tombol Konfirmasi Sudah Transfer agar Admin dapat segera memverifikasi akses Anda.',
    },
    ebooks,
    members,
    transactions,
    readerHistory,
  };
}

let cachedDb: LibraryDatabase | null = null;

export function getDb(): LibraryDatabase {
  ensureDirectories();
  if (cachedDb) return cachedDb;

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      cachedDb = JSON.parse(raw) as LibraryDatabase;
      return cachedDb;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }

  cachedDb = createInitialDatabase();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: LibraryDatabase): void {
  ensureDirectories();
  cachedDb = db;
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}
