import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { generateBookSamplePdf } from './server/pdfHelper';
import {
  getDb,
  hashPassword,
  saveDb,
  StoredEbook,
  UPLOADS_DIR,
  verifyPassword,
} from './server/store';
import {
  BOOK_CATEGORIES,
  BookAccessStatus,
  BookCategory,
  Ebook,
  Member,
  MemberHistorySummary,
  SessionUser,
  Transaction,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

interface TokenPayload {
  role: 'admin' | 'visitor';
  memberId?: string;
  username?: string;
  email: string;
  exp: number;
}

function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveUploadedFilePath(storedFile: string): string | null {
  const resolved = path.resolve(UPLOADS_DIR, storedFile);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function removeUploadedFileIfLocal(storedFile?: string) {
  if (!storedFile || storedFile.startsWith('seeded:')) return;
  const safePath = resolveUploadedFilePath(storedFile);
  if (safePath && fs.existsSync(safePath)) {
    try {
      fs.unlinkSync(safePath);
    } catch {
      // Ignore cleanup error
    }
  }
}

function getBookAccessForUser(
  book: StoredEbook,
  user: SessionUser,
  transactions: Transaction[]
): { accessStatus: BookAccessStatus; transactionId?: string } {
  if (book.price <= 0) {
    return { accessStatus: 'free' };
  }
  if (user.role === 'admin') {
    return { accessStatus: 'verified' };
  }
  const userTrx = transactions
    .filter(
      (t) =>
        t.ebookId === book.id &&
        t.memberEmail.toLowerCase() === user.email.toLowerCase()
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (userTrx.length === 0) {
    return { accessStatus: 'unpaid' };
  }
  const latest = userTrx[0];
  return {
    accessStatus: latest.status,
    transactionId: latest.id,
  };
}

function sanitizeBookForClient(
  book: StoredEbook,
  user: SessionUser,
  transactions: Transaction[]
): Ebook {
  const { storedFile: _omit, ...rest } = book;
  const { accessStatus, transactionId } = getBookAccessForUser(
    book,
    user,
    transactions
  );
  return {
    ...rest,
    accessStatus,
    transactionId,
  };
}

function hasBookAccess(
  book: StoredEbook,
  user: SessionUser,
  transactions: Transaction[]
): boolean {
  if (user.role === 'admin' || book.price <= 0) return true;
  return transactions.some(
    (t) =>
      t.ebookId === book.id &&
      t.memberEmail.toLowerCase() === user.email.toLowerCase() &&
      t.status === 'verified'
  );
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk kembali.' });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi telah berakhir. Silakan masuk kembali.' });
    return;
  }

  const db = getDb();
  if (payload.role === 'admin') {
    req.user = {
      role: 'admin',
      username: db.adminConfig.username,
      name: 'Administrator Perpustakaan',
      email: 'admin@perpustakaan-ai.id',
      permissions: { canManageBooks: true, canVerifyPayments: true },
    };
    next();
    return;
  }

  const member = db.members.find((m) => m.id === payload.memberId);
  if (!member) {
    res.status(401).json({ error: 'Akun anggota tidak ditemukan.' });
    return;
  }
  if (member.status !== 'aktif') {
    res.status(403).json({ error: 'Status keanggotaan Anda sedang nonaktif.' });
    return;
  }

  req.user = {
    role: 'visitor',
    memberId: member.id,
    name: member.name,
    email: member.email,
    permissions: member.permissions || {
      canManageBooks: false,
      canVerifyPayments: false,
    },
  };
  next();
}

function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Akses khusus Administrator.' });
    return;
  }
  next();
}

function requireBookManager(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (
    !req.user ||
    (req.user.role !== 'admin' && !req.user.permissions?.canManageBooks)
  ) {
    res.status(403).json({ error: 'Anda tidak memiliki izin mengelola data e-book.' });
    return;
  }
  next();
}

function requirePaymentVerifier(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (
    !req.user ||
    (req.user.role !== 'admin' && !req.user.permissions?.canVerifyPayments)
  ) {
    res.status(403).json({ error: 'Akses khusus verifikasi transaksi.' });
    return;
  }
  next();
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.epub', '.txt', '.doc', '.docx']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      getDb();
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(
        new Error(
          'Format file tidak didukung. Gunakan PDF, EPUB, TXT, DOC, atau DOCX.'
        )
      );
      return;
    }
    cb(null, true);
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize DB & uploads dir at startup
  getDb();

  // --- AUTH ROUTES ---
  app.post('/api/auth/login-admin', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    const db = getDb();
    if (
      username !== db.adminConfig.username ||
      !verifyPassword(password, db.adminConfig.passwordHash)
    ) {
      res.status(401).json({ error: 'Username atau password Admin tidak valid.' });
      return;
    }

    const token = signToken({
      role: 'admin',
      username: db.adminConfig.username,
      email: 'admin@perpustakaan-ai.id',
    });

    const user: SessionUser = {
      role: 'admin',
      username: db.adminConfig.username,
      name: 'Administrator Perpustakaan',
      email: 'admin@perpustakaan-ai.id',
      permissions: { canManageBooks: true, canVerifyPayments: true },
    };

    res.json({ token, user });
  });

  app.post('/api/auth/login-visitor', (req: Request, res: Response) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const institution = String(req.body?.institution || '').trim();

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    let member = db.members.find((m) => m.email.toLowerCase() === email);
    let isNewMember = false;

    if (!member) {
      isNewMember = true;
      member = {
        id: `mbr-${crypto.randomUUID().slice(0, 8)}`,
        name,
        email,
        phone: phone || '-',
        institution: institution || 'Pembaca Umum',
        status: 'aktif',
        permissions: { canManageBooks: false, canVerifyPayments: false },
        joinedAt: now,
        lastLoginAt: now,
      };
      db.members.unshift(member);
    } else {
      if (member.status !== 'aktif') {
        res.status(403).json({
          error:
            'Keanggotaan Anda sedang dinonaktifkan oleh Admin. Hubungi pengelola perpustakaan.',
        });
        return;
      }
      member.lastLoginAt = now;
      if (name) member.name = name;
      if (phone) member.phone = phone;
      if (institution) member.institution = institution;
    }

    saveDb(db);

    const token = signToken({
      role: 'visitor',
      memberId: member.id,
      email: member.email,
    });

    const user: SessionUser = {
      role: 'visitor',
      memberId: member.id,
      name: member.name,
      email: member.email,
      permissions: member.permissions,
    };

    res.json({ token, user, member, isNewMember });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const member = req.user?.memberId
      ? db.members.find((m) => m.id === req.user?.memberId) || null
      : null;
    res.json({ user: req.user, member });
  });

  // --- DASHBOARD ---
  app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const visibleHistory = isAdmin
      ? db.readerHistory
      : db.readerHistory.filter(
          (h) => h.memberEmail.toLowerCase() === user.email.toLowerCase()
        );

    const visibleTransactions = isAdmin
      ? db.transactions
      : db.transactions.filter(
          (t) => t.memberEmail.toLowerCase() === user.email.toLowerCase()
        );

    const verifiedTrx = visibleTransactions.filter((t) => t.status === 'verified');
    const pendingTrx = visibleTransactions.filter((t) => t.status === 'pending');

    res.json({
      summary: {
        totalEbooks: db.ebooks.length,
        freeEbooks: db.ebooks.filter((b) => b.price <= 0).length,
        paidEbooks: db.ebooks.filter((b) => b.price > 0).length,
        totalMembers: isAdmin ? db.members.length : 1,
        totalTransactions: visibleTransactions.length,
        pendingTransactions: pendingTrx.length,
        verifiedTransactions: verifiedTrx.length,
        verifiedRevenue: verifiedTrx.reduce((sum, t) => sum + t.amount, 0),
        totalReads: visibleHistory.filter((h) => h.action === 'read').length,
        totalDownloads: visibleHistory.filter((h) => h.action === 'download').length,
      },
      announcement: db.announcement,
      bankAccount: db.bankAccount,
      recentBooks: db.ebooks
        .slice(0, 4)
        .map((b) => sanitizeBookForClient(b, user, db.transactions)),
      recentActivities: visibleHistory.slice(0, 6),
    });
  });

  // --- EBOOKS ---
  app.get('/api/ebooks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const list = db.ebooks.map((b) =>
      sanitizeBookForClient(b, user, db.transactions)
    );
    res.json({ ebooks: list, bankAccount: db.bankAccount });
  });

  app.post(
    '/api/ebooks',
    requireAuth,
    requireBookManager,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const db = getDb();
        const title = String(req.body?.title || '').trim();
        const author = String(req.body?.author || '').trim();
        const publisher = String(req.body?.publisher || '').trim() || 'Pustaka Digital';
        const year = Number(req.body?.year) || new Date().getFullYear();
        const category = String(req.body?.category || '') as BookCategory;
        const description = String(req.body?.description || '').trim();
        const price = Math.max(0, Number(req.body?.price) || 0);
        const pages = Math.max(1, Number(req.body?.pages) || 100);
        const inputMethod = req.body?.inputMethod === 'url' ? 'url' : 'upload';
        const externalUrl = String(req.body?.externalUrl || '').trim();

        if (!title) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({ error: 'Judul e-book wajib diisi.' });
          return;
        }
        if (!author) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({ error: 'Nama penulis wajib diisi.' });
          return;
        }
        if (!BOOK_CATEGORIES.includes(category)) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({ error: 'Kategori buku tidak valid.' });
          return;
        }

        // Duplicate title check (case-insensitive)
        const duplicate = db.ebooks.find(
          (b) => b.title.trim().toLowerCase() === title.toLowerCase()
        );
        if (duplicate) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(409).json({
            error: `Buku dengan judul "${title}" sudah terdaftar di Master Data.`,
          });
          return;
        }

        if (inputMethod === 'upload' && !req.file) {
          res.status(400).json({
            error: 'Silakan unggah file e-book (PDF/EPUB/TXT/DOC) terlebih dahulu.',
          });
          return;
        }
        if (inputMethod === 'url' && !isValidHttpUrl(externalUrl)) {
          res.status(400).json({
            error: 'Tautan URL eksternal wajib diawali dengan http:// atau https://.',
          });
          return;
        }

        const coverOptions = [
          '/src/assets/images/cover_tech_indonesia_1795615405528.jpg',
          '/src/assets/images/cover_culture_archipelago_1795615407016.jpg',
          '/src/assets/images/cover_economy_law_1795615407195.jpg',
        ];
        const coverImage = coverOptions[db.ebooks.length % coverOptions.length];
        const now = new Date().toISOString();

        const newBook: StoredEbook = {
          id: `ebk-${crypto.randomUUID().slice(0, 8)}`,
          title,
          author,
          publisher,
          year,
          category,
          description:
            description ||
            `Koleksi digital resmi "${title}" karya ${author} dalam kategori ${category}.`,
          price,
          inputMethod,
          fileName:
            inputMethod === 'upload' && req.file ? req.file.originalname : undefined,
          storedFile:
            inputMethod === 'upload' && req.file ? req.file.filename : undefined,
          fileSize: inputMethod === 'upload' && req.file ? req.file.size : undefined,
          fileMimeType:
            inputMethod === 'upload' && req.file ? req.file.mimetype : undefined,
          externalUrl: inputMethod === 'url' ? externalUrl : undefined,
          coverImage,
          pages,
          createdAt: now,
          updatedAt: now,
        };

        db.ebooks.unshift(newBook);
        saveDb(db);

        res.status(201).json({
          ebook: sanitizeBookForClient(newBook, req.user!, db.transactions),
        });
      } catch (err) {
        if (req.file) removeUploadedFileIfLocal(req.file.filename);
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Gagal menyimpan e-book.',
        });
      }
    }
  );

  app.put(
    '/api/ebooks/:id',
    requireAuth,
    requireBookManager,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const db = getDb();
        const bookIdx = db.ebooks.findIndex((b) => b.id === req.params.id);
        if (bookIdx === -1) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(404).json({ error: 'Data e-book tidak ditemukan.' });
          return;
        }

        const existing = db.ebooks[bookIdx];
        const title = String(req.body?.title || existing.title).trim();
        const author = String(req.body?.author || existing.author).trim();
        const publisher =
          String(req.body?.publisher || existing.publisher).trim() || 'Pustaka Digital';
        const year = Number(req.body?.year) || existing.year;
        const category = String(req.body?.category || existing.category) as BookCategory;
        const description = String(req.body?.description ?? existing.description).trim();
        const price =
          req.body?.price !== undefined
            ? Math.max(0, Number(req.body.price) || 0)
            : existing.price;
        const pages =
          req.body?.pages !== undefined
            ? Math.max(1, Number(req.body.pages) || 100)
            : existing.pages;
        const inputMethod =
          req.body?.inputMethod === 'url'
            ? 'url'
            : req.body?.inputMethod === 'upload'
            ? 'upload'
            : existing.inputMethod;
        const externalUrl = String(
          req.body?.externalUrl ?? existing.externalUrl ?? ''
        ).trim();

        if (!title || !author) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({ error: 'Judul dan penulis e-book wajib diisi.' });
          return;
        }
        if (!BOOK_CATEGORIES.includes(category)) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({ error: 'Kategori buku tidak valid.' });
          return;
        }

        const duplicate = db.ebooks.find(
          (b) =>
            b.id !== existing.id &&
            b.title.trim().toLowerCase() === title.toLowerCase()
        );
        if (duplicate) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(409).json({
            error: `Buku dengan judul "${title}" sudah terdaftar di Master Data.`,
          });
          return;
        }

        if (inputMethod === 'url' && !isValidHttpUrl(externalUrl)) {
          if (req.file) removeUploadedFileIfLocal(req.file.filename);
          res.status(400).json({
            error: 'Tautan URL eksternal wajib diawali dengan http:// atau https://.',
          });
          return;
        }

        if (inputMethod === 'upload' && !req.file && !existing.storedFile) {
          res.status(400).json({
            error: 'Silakan unggah file e-book untuk metode upload.',
          });
          return;
        }

        let fileName = existing.fileName;
        let storedFile = existing.storedFile;
        let fileSize = existing.fileSize;
        let fileMimeType = existing.fileMimeType;
        let finalExternalUrl = existing.externalUrl;

        if (inputMethod === 'url') {
          removeUploadedFileIfLocal(existing.storedFile);
          fileName = undefined;
          storedFile = undefined;
          fileSize = undefined;
          fileMimeType = undefined;
          finalExternalUrl = externalUrl;
        } else {
          finalExternalUrl = undefined;
          if (req.file) {
            removeUploadedFileIfLocal(existing.storedFile);
            fileName = req.file.originalname;
            storedFile = req.file.filename;
            fileSize = req.file.size;
            fileMimeType = req.file.mimetype;
          }
        }

        const updated: StoredEbook = {
          ...existing,
          title,
          author,
          publisher,
          year,
          category,
          description,
          price,
          pages,
          inputMethod,
          fileName,
          storedFile,
          fileSize,
          fileMimeType,
          externalUrl: finalExternalUrl,
          updatedAt: new Date().toISOString(),
        };

        db.ebooks[bookIdx] = updated;
        saveDb(db);

        res.json({
          ebook: sanitizeBookForClient(updated, req.user!, db.transactions),
        });
      } catch (err) {
        if (req.file) removeUploadedFileIfLocal(req.file.filename);
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Gagal memperbarui e-book.',
        });
      }
    }
  );

  app.delete(
    '/api/ebooks/:id',
    requireAuth,
    requireBookManager,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const idx = db.ebooks.findIndex((b) => b.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Data e-book tidak ditemukan.' });
        return;
      }
      const [removed] = db.ebooks.splice(idx, 1);
      removeUploadedFileIfLocal(removed.storedFile);
      saveDb(db);
      res.json({ success: true });
    }
  );

  // Read / preview ebook (logs 'read' history)
  app.post(
    '/api/ebooks/:id/read',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const user = req.user!;
      const book = db.ebooks.find((b) => b.id === req.params.id);
      if (!book) {
        res.status(404).json({ error: 'e-Book tidak ditemukan.' });
        return;
      }

      if (!hasBookAccess(book, user, db.transactions)) {
        res.status(403).json({
          error:
            'Anda belum memiliki akses untuk membaca buku berbayar ini. Lakukan pembayaran dan tunggu verifikasi Admin.',
        });
        return;
      }

      db.readerHistory.unshift({
        id: `his-${crypto.randomUUID().slice(0, 8)}`,
        memberId: user.memberId || 'admin',
        memberName: user.name,
        memberEmail: user.email,
        ebookId: book.id,
        ebookTitle: book.title,
        ebookCategory: book.category,
        action: 'read',
        timestamp: new Date().toISOString(),
      });
      saveDb(db);

      const isPdfFile =
        book.inputMethod === 'upload' &&
        (book.fileMimeType === 'application/pdf' ||
          book.fileName?.toLowerCase().endsWith('.pdf'));

      res.json({
        ebook: sanitizeBookForClient(book, user, db.transactions),
        mode:
          book.inputMethod === 'url'
            ? 'url'
            : book.storedFile?.startsWith('seeded:')
            ? 'seeded-pdf'
            : isPdfFile
            ? 'uploaded-pdf'
            : 'uploaded-other',
      });
    }
  );

  // Stream file inline for reader iframe (without logging duplicate history)
  app.get(
    '/api/ebooks/:id/file',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const user = req.user!;
      const book = db.ebooks.find((b) => b.id === req.params.id);
      if (!book) {
        res.status(404).json({ error: 'e-Book tidak ditemukan.' });
        return;
      }

      if (!hasBookAccess(book, user, db.transactions)) {
        res.status(403).json({
          error: 'Pembayaran buku ini belum diverifikasi oleh Admin.',
        });
        return;
      }

      if (book.storedFile?.startsWith('seeded:')) {
        const pdfBuffer = generateBookSamplePdf(book);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${book.fileName || `${book.id}.pdf`}"`
        );
        res.send(pdfBuffer);
        return;
      }

      if (!book.storedFile) {
        res.status(404).json({ error: 'File tidak tersedia.' });
        return;
      }

      const safePath = resolveUploadedFilePath(book.storedFile);
      if (!safePath || !fs.existsSync(safePath)) {
        res.status(404).json({ error: 'Berkas file e-book tidak ditemukan di server.' });
        return;
      }

      res.setHeader(
        'Content-Type',
        book.fileMimeType || 'application/octet-stream'
      );
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(book.fileName || 'ebook.pdf')}"`
      );
      res.sendFile(safePath);
    }
  );

  // Download ebook (logs 'download' history)
  app.get(
    '/api/ebooks/:id/download',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const user = req.user!;
      const book = db.ebooks.find((b) => b.id === req.params.id);
      if (!book) {
        res.status(404).json({ error: 'e-Book tidak ditemukan.' });
        return;
      }

      if (!hasBookAccess(book, user, db.transactions)) {
        res.status(403).json({
          error:
            'Tidak dapat mengunduh buku berbayar sebelum pembayaran diverifikasi oleh Admin.',
        });
        return;
      }

      db.readerHistory.unshift({
        id: `his-${crypto.randomUUID().slice(0, 8)}`,
        memberId: user.memberId || 'admin',
        memberName: user.name,
        memberEmail: user.email,
        ebookId: book.id,
        ebookTitle: book.title,
        ebookCategory: book.category,
        action: 'download',
        timestamp: new Date().toISOString(),
      });
      saveDb(db);

      if (book.inputMethod === 'url' && book.externalUrl) {
        res.json({ type: 'url', url: book.externalUrl });
        return;
      }

      if (book.storedFile?.startsWith('seeded:')) {
        const pdfBuffer = generateBookSamplePdf(book);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${book.fileName || `${book.id}.pdf`}"`
        );
        res.send(pdfBuffer);
        return;
      }

      if (!book.storedFile) {
        res.status(404).json({ error: 'File tidak tersedia.' });
        return;
      }

      const safePath = resolveUploadedFilePath(book.storedFile);
      if (!safePath || !fs.existsSync(safePath)) {
        res.status(404).json({ error: 'Berkas file e-book tidak ditemukan di server.' });
        return;
      }

      res.download(safePath, book.fileName || 'ebook.pdf');
    }
  );

  // --- MEMBERS ---
  app.get('/api/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    if (user.role === 'admin') {
      res.json({ members: db.members });
      return;
    }
    const ownMember = db.members.filter((m) => m.id === user.memberId);
    res.json({ members: ownMember });
  });

  app.post(
    '/api/members',
    requireAuth,
    requireAdmin,
    (req: Request, res: Response) => {
      const db = getDb();
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const phone = String(req.body?.phone || '').trim() || '-';
      const institution =
        String(req.body?.institution || '').trim() || 'Pembaca Umum';
      const status = req.body?.status === 'nonaktif' ? 'nonaktif' : 'aktif';
      const permissions = {
        canManageBooks: Boolean(req.body?.permissions?.canManageBooks),
        canVerifyPayments: Boolean(req.body?.permissions?.canVerifyPayments),
      };

      if (!name || !isValidEmail(email)) {
        res.status(400).json({ error: 'Nama lengkap dan email valid wajib diisi.' });
        return;
      }
      if (db.members.some((m) => m.email.toLowerCase() === email)) {
        res.status(409).json({ error: 'Email anggota tersebut sudah terdaftar.' });
        return;
      }

      const now = new Date().toISOString();
      const member: Member = {
        id: `mbr-${crypto.randomUUID().slice(0, 8)}`,
        name,
        email,
        phone,
        institution,
        status,
        permissions,
        joinedAt: now,
        lastLoginAt: now,
      };
      db.members.unshift(member);
      saveDb(db);
      res.status(201).json({ member });
    }
  );

  app.put('/api/members/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const idx = db.members.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data anggota tidak ditemukan.' });
      return;
    }

    if (user.role !== 'admin' && user.memberId !== req.params.id) {
      res.status(403).json({ error: 'Anda hanya dapat mengubah profil Anda sendiri.' });
      return;
    }

    const existing = db.members[idx];
    const name = String(req.body?.name ?? existing.name).trim();
    const phone = String(req.body?.phone ?? existing.phone).trim() || '-';
    const institution =
      String(req.body?.institution ?? existing.institution).trim() || 'Pembaca Umum';

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Nama anggota minimal 2 karakter.' });
      return;
    }

    let email = existing.email;
    let status = existing.status;
    let permissions = existing.permissions;

    if (user.role === 'admin') {
      const requestedEmail = String(req.body?.email ?? existing.email)
        .trim()
        .toLowerCase();
      if (!isValidEmail(requestedEmail)) {
        res.status(400).json({ error: 'Format email tidak valid.' });
        return;
      }
      if (
        requestedEmail !== existing.email.toLowerCase() &&
        db.members.some(
          (m) => m.id !== existing.id && m.email.toLowerCase() === requestedEmail
        )
      ) {
        res.status(409).json({ error: 'Email sudah digunakan anggota lain.' });
        return;
      }
      email = requestedEmail;
      if (req.body?.status === 'aktif' || req.body?.status === 'nonaktif') {
        status = req.body.status;
      }
      if (req.body?.permissions) {
        permissions = {
          canManageBooks: Boolean(req.body.permissions.canManageBooks),
          canVerifyPayments: Boolean(req.body.permissions.canVerifyPayments),
        };
      }
    }

    const updated: Member = {
      ...existing,
      name,
      email,
      phone,
      institution,
      status,
      permissions,
    };

    db.members[idx] = updated;
    saveDb(db);
    res.json({ member: updated });
  });

  app.delete(
    '/api/members/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const idx = db.members.findIndex((m) => m.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Data anggota tidak ditemukan.' });
        return;
      }
      db.members.splice(idx, 1);
      saveDb(db);
      res.json({ success: true });
    }
  );

  // --- TRANSACTIONS ---
  app.get(
    '/api/transactions',
    requireAuth,
    requirePaymentVerifier,
    (_req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      res.json({
        transactions: db.transactions,
        members: db.members,
        paidEbooks: db.ebooks
          .filter((b) => b.price > 0)
          .map(({ storedFile: _s, ...rest }) => rest),
      });
    }
  );

  app.get(
    '/api/my-transactions',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const email = req.user!.email.toLowerCase();
      const list = db.transactions.filter(
        (t) => t.memberEmail.toLowerCase() === email
      );
      res.json({ transactions: list });
    }
  );

  app.post(
    '/api/transactions/pay',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const user = req.user!;
      const ebookId = String(req.body?.ebookId || '').trim();
      const paymentNote =
        String(req.body?.paymentNote || '').trim() ||
        `Transfer Bank dari ${user.name}`;

      const book = db.ebooks.find((b) => b.id === ebookId);
      if (!book) {
        res.status(404).json({ error: 'e-Book tidak ditemukan.' });
        return;
      }
      if (book.price <= 0) {
        res.status(400).json({ error: 'Buku ini gratis dan dapat langsung diunduh.' });
        return;
      }

      const existingActive = db.transactions.find(
        (t) =>
          t.ebookId === book.id &&
          t.memberEmail.toLowerCase() === user.email.toLowerCase() &&
          (t.status === 'pending' || t.status === 'verified')
      );
      if (existingActive) {
        res.status(409).json({
          error:
            existingActive.status === 'verified'
              ? 'Pembayaran buku ini sudah terverifikasi.'
              : 'Pembayaran untuk buku ini sedang menunggu verifikasi Admin.',
        });
        return;
      }

      const newTrx: Transaction = {
        id: `trx-${crypto.randomUUID().slice(0, 8)}`,
        memberId: user.memberId || 'admin',
        memberName: user.name,
        memberEmail: user.email,
        ebookId: book.id,
        ebookTitle: book.title,
        amount: book.price,
        status: 'pending',
        paymentMethod: 'Transfer Bank',
        paymentNote,
        createdAt: new Date().toISOString(),
      };

      db.transactions.unshift(newTrx);
      saveDb(db);
      res.status(201).json({ transaction: newTrx });
    }
  );

  app.post(
    '/api/transactions',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const memberId = String(req.body?.memberId || '').trim();
      const ebookId = String(req.body?.ebookId || '').trim();
      const status =
        req.body?.status === 'verified' || req.body?.status === 'rejected'
          ? req.body.status
          : 'pending';
      const paymentMethod =
        String(req.body?.paymentMethod || '').trim() || 'Transfer Bank';
      const paymentNote = String(req.body?.paymentNote || '').trim() || '-';

      const member = db.members.find((m) => m.id === memberId);
      if (!member) {
        res.status(400).json({ error: 'Anggota pembeli tidak ditemukan.' });
        return;
      }
      const book = db.ebooks.find((b) => b.id === ebookId);
      if (!book) {
        res.status(400).json({ error: 'e-Book tidak ditemukan.' });
        return;
      }

      const now = new Date().toISOString();
      const newTrx: Transaction = {
        id: `trx-${crypto.randomUUID().slice(0, 8)}`,
        memberId: member.id,
        memberName: member.name,
        memberEmail: member.email,
        ebookId: book.id,
        ebookTitle: book.title,
        amount:
          req.body?.amount !== undefined
            ? Math.max(0, Number(req.body.amount) || 0)
            : book.price,
        status,
        paymentMethod,
        paymentNote,
        createdAt: now,
        verifiedAt: status === 'verified' ? now : undefined,
        verifiedBy: status === 'verified' ? req.user?.username || 'admin' : undefined,
      };

      db.transactions.unshift(newTrx);
      saveDb(db);
      res.status(201).json({ transaction: newTrx });
    }
  );

  app.put(
    '/api/transactions/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const idx = db.transactions.findIndex((t) => t.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
        return;
      }
      const existing = db.transactions[idx];
      let memberName = existing.memberName;
      let memberEmail = existing.memberEmail;
      let memberId = existing.memberId;

      if (req.body?.memberId && req.body.memberId !== existing.memberId) {
        const m = db.members.find((item) => item.id === req.body.memberId);
        if (m) {
          memberId = m.id;
          memberName = m.name;
          memberEmail = m.email;
        }
      }

      let ebookId = existing.ebookId;
      let ebookTitle = existing.ebookTitle;
      if (req.body?.ebookId && req.body.ebookId !== existing.ebookId) {
        const b = db.ebooks.find((item) => item.id === req.body.ebookId);
        if (b) {
          ebookId = b.id;
          ebookTitle = b.title;
        }
      }

      const nextStatus =
        req.body?.status === 'verified' ||
        req.body?.status === 'rejected' ||
        req.body?.status === 'pending'
          ? req.body.status
          : existing.status;

      const updated: Transaction = {
        ...existing,
        memberId,
        memberName,
        memberEmail,
        ebookId,
        ebookTitle,
        amount:
          req.body?.amount !== undefined
            ? Math.max(0, Number(req.body.amount) || 0)
            : existing.amount,
        status: nextStatus,
        paymentMethod:
          String(req.body?.paymentMethod ?? existing.paymentMethod).trim() ||
          'Transfer Bank',
        paymentNote: String(req.body?.paymentNote ?? existing.paymentNote).trim(),
        verifiedAt:
          nextStatus === 'verified'
            ? existing.verifiedAt || new Date().toISOString()
            : undefined,
        verifiedBy:
          nextStatus === 'verified'
            ? existing.verifiedBy || req.user?.username || 'admin'
            : undefined,
      };

      db.transactions[idx] = updated;
      saveDb(db);
      res.json({ transaction: updated });
    }
  );

  app.post(
    '/api/transactions/:id/verify',
    requireAuth,
    requirePaymentVerifier,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const trx = db.transactions.find((t) => t.id === req.params.id);
      if (!trx) {
        res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
        return;
      }
      trx.status = 'verified';
      trx.verifiedAt = new Date().toISOString();
      trx.verifiedBy = req.user?.username || req.user?.name || 'admin';
      saveDb(db);
      res.json({ transaction: trx });
    }
  );

  app.post(
    '/api/transactions/:id/reject',
    requireAuth,
    requirePaymentVerifier,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const trx = db.transactions.find((t) => t.id === req.params.id);
      if (!trx) {
        res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
        return;
      }
      trx.status = 'rejected';
      trx.verifiedAt = undefined;
      trx.verifiedBy = undefined;
      saveDb(db);
      res.json({ transaction: trx });
    }
  );

  app.delete(
    '/api/transactions/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const idx = db.transactions.findIndex((t) => t.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
        return;
      }
      db.transactions.splice(idx, 1);
      saveDb(db);
      res.json({ success: true });
    }
  );

  // --- READER HISTORY ---
  app.get('/api/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const entries = isAdmin
      ? db.readerHistory
      : db.readerHistory.filter(
          (h) => h.memberEmail.toLowerCase() === user.email.toLowerCase()
        );

    const summaryMap = new Map<string, MemberHistorySummary>();
    for (const entry of entries) {
      const key = entry.memberEmail.toLowerCase();
      const existing = summaryMap.get(key);
      if (!existing) {
        summaryMap.set(key, {
          memberId: entry.memberId,
          memberName: entry.memberName,
          memberEmail: entry.memberEmail,
          totalReads: entry.action === 'read' ? 1 : 0,
          totalDownloads: entry.action === 'download' ? 1 : 0,
          totalActivities: 1,
          lastActivityAt: entry.timestamp,
        });
      } else {
        if (entry.action === 'read') existing.totalReads += 1;
        if (entry.action === 'download') existing.totalDownloads += 1;
        existing.totalActivities += 1;
        if (
          new Date(entry.timestamp).getTime() >
          new Date(existing.lastActivityAt).getTime()
        ) {
          existing.lastActivityAt = entry.timestamp;
        }
      }
    }

    res.json({
      entries,
      memberSummaries: Array.from(summaryMap.values()),
    });
  });

  // --- REPORTS ---
  app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const categoryBreakdown = BOOK_CATEGORIES.map((category) => {
      const books = db.ebooks.filter((b) => b.category === category);
      return {
        category,
        totalBooks: books.length,
        freeBooks: books.filter((b) => b.price <= 0).length,
        paidBooks: books.filter((b) => b.price > 0).length,
      };
    }).filter((row) => row.totalBooks > 0);

    const historyScope = isAdmin
      ? db.readerHistory
      : db.readerHistory.filter(
          (h) => h.memberEmail.toLowerCase() === user.email.toLowerCase()
        );

    const trxScope = isAdmin
      ? db.transactions
      : db.transactions.filter(
          (t) => t.memberEmail.toLowerCase() === user.email.toLowerCase()
        );

    const bookStats = db.ebooks.map((book) => {
      const reads = historyScope.filter(
        (h) => h.ebookId === book.id && h.action === 'read'
      ).length;
      const downloads = historyScope.filter(
        (h) => h.ebookId === book.id && h.action === 'download'
      ).length;
      return {
        id: book.id,
        title: book.title,
        category: book.category,
        price: book.price,
        reads,
        downloads,
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      scope: isAdmin ? 'all' : 'personal',
      totals: {
        ebooks: db.ebooks.length,
        members: isAdmin ? db.members.length : 1,
        transactions: trxScope.length,
        verifiedTransactions: trxScope.filter((t) => t.status === 'verified').length,
        pendingTransactions: trxScope.filter((t) => t.status === 'pending').length,
        verifiedRevenue: trxScope
          .filter((t) => t.status === 'verified')
          .reduce((sum, t) => sum + t.amount, 0),
        reads: historyScope.filter((h) => h.action === 'read').length,
        downloads: historyScope.filter((h) => h.action === 'download').length,
      },
      categoryBreakdown,
      bookStats,
      members: isAdmin
        ? db.members
        : db.members.filter((m) => m.id === user.memberId),
      transactions: trxScope,
      history: historyScope,
    });
  });

  // --- SETTINGS (ADMIN ONLY) ---
  app.get(
    '/api/settings',
    requireAuth,
    requireAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      res.json({
        announcement: db.announcement,
        bankAccount: db.bankAccount,
        adminUsername: db.adminConfig.username,
      });
    }
  );

  app.put(
    '/api/settings/announcement',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      const isActive = Boolean(req.body?.isActive ?? true);

      if (!title || !content) {
        res
          .status(400)
          .json({ error: 'Judul dan isi pengumuman papan informasi wajib diisi.' });
        return;
      }

      db.announcement = {
        title,
        content,
        isActive,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.username || 'admin',
      };
      saveDb(db);
      res.json({ announcement: db.announcement });
    }
  );

  app.put(
    '/api/settings/bank',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const bankName = String(req.body?.bankName || '').trim();
      const accountNumber = String(req.body?.accountNumber || '').trim();
      const accountHolder = String(req.body?.accountHolder || '').trim();
      const instructions = String(req.body?.instructions || '').trim();

      if (!bankName || !accountNumber || !accountHolder) {
        res.status(400).json({
          error: 'Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.',
        });
        return;
      }

      db.bankAccount = {
        bankName,
        accountNumber,
        accountHolder,
        instructions:
          instructions ||
          'Sertakan email anggota saat transfer dan konfirmasi pembayaran pada sistem.',
      };
      saveDb(db);
      res.json({ bankAccount: db.bankAccount });
    }
  );

  app.put(
    '/api/settings/password',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb();
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (!verifyPassword(currentPassword, db.adminConfig.passwordHash)) {
        res.status(400).json({ error: 'Password Admin saat ini tidak sesuai.' });
        return;
      }
      if (newPassword.length < 4) {
        res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({
          error: 'Konfirmasi password baru tidak cocok.',
        });
        return;
      }

      db.adminConfig.passwordHash = hashPassword(newPassword);
      saveDb(db);
      res.json({ success: true, message: 'Password Admin berhasil diperbarui.' });
    }
  );

  // Unknown API route guard
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Multer & global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message || 'Terjadi kesalahan pada server.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan pada http://localhost:${PORT}`);
  });
}

startServer();
