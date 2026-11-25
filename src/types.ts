export const BOOK_CATEGORIES = [
  'Pendidikan',
  'Agama',
  'Sains dan Teknologi',
  'Bahasa dan Sastra',
  'Seni dan Budaya',
  'Filsafat dan Psikologi',
  'Sejarah dan Geografi',
  'Hukum',
  'Ekonomi',
  'Buku Anak',
  'Lainnya',
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export type UserRole = 'admin' | 'visitor';

export interface MemberPermissions {
  canManageBooks: boolean;
  canVerifyPayments: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  institution: string;
  status: 'aktif' | 'nonaktif';
  permissions: MemberPermissions;
  joinedAt: string;
  lastLoginAt: string;
}

export type BookAccessStatus = 'free' | 'unpaid' | 'pending' | 'verified' | 'rejected';

export interface Ebook {
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  category: BookCategory;
  description: string;
  price: number;
  inputMethod: 'upload' | 'url';
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  externalUrl?: string;
  coverImage?: string;
  pages?: number;
  createdAt: string;
  updatedAt: string;
  accessStatus?: BookAccessStatus;
  transactionId?: string;
}

export type TransactionStatus = 'pending' | 'verified' | 'rejected';

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  ebookId: string;
  ebookTitle: string;
  amount: number;
  status: TransactionStatus;
  paymentMethod: string;
  paymentNote: string;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ReaderHistoryEntry {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  ebookId: string;
  ebookTitle: string;
  ebookCategory: BookCategory;
  action: 'read' | 'download';
  timestamp: string;
}

export interface MemberHistorySummary {
  memberId: string;
  memberName: string;
  memberEmail: string;
  totalReads: number;
  totalDownloads: number;
  totalActivities: number;
  lastActivityAt: string;
}

export interface Announcement {
  title: string;
  content: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

export interface SessionUser {
  role: UserRole;
  memberId?: string;
  username?: string;
  name: string;
  email: string;
  permissions: MemberPermissions;
}

export interface DashboardData {
  summary: {
    totalEbooks: number;
    freeEbooks: number;
    paidEbooks: number;
    totalMembers: number;
    totalTransactions: number;
    pendingTransactions: number;
    verifiedTransactions: number;
    verifiedRevenue: number;
    totalReads: number;
    totalDownloads: number;
  };
  announcement: Announcement;
  bankAccount: BankAccount;
  recentBooks: Ebook[];
  recentActivities: ReaderHistoryEntry[];
}
