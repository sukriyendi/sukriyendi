import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { EbookCatalogView } from './components/EbookCatalogView';
import { LoginView } from './components/LoginView';
import { MembersView } from './components/MembersView';
import { ReaderHistoryView } from './components/ReaderHistoryView';
import { LibraryReportPayload, ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { TransactionsView } from './components/TransactionsView';
import { apiFetch, setAuthToken } from './lib/api';
import {
  BankAccount,
  DashboardData,
  Ebook,
  Member,
  MemberHistorySummary,
  ReaderHistoryEntry,
  SessionUser,
  Transaction,
} from './types';

type TabId =
  | 'dashboard'
  | 'ebooks'
  | 'members'
  | 'transactions'
  | 'history'
  | 'reports'
  | 'settings';

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Data states
  const [loadingData, setLoadingData] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount>({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    instructions: '',
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paidEbooks, setPaidEbooks] = useState<Ebook[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ReaderHistoryEntry[]>([]);
  const [memberSummaries, setMemberSummaries] = useState<MemberHistorySummary[]>([]);
  const [reportData, setReportData] = useState<LibraryReportPayload | null>(null);

  const loadWorkspaceData = useCallback(async (currentUser: SessionUser) => {
    setLoadingData(true);
    try {
      const canSeeTransactions =
        currentUser.role === 'admin' ||
        Boolean(currentUser.permissions?.canVerifyPayments);

      const [dashRes, booksRes, membersRes, historyRes, reportRes] =
        await Promise.all([
          apiFetch<DashboardData>('/api/dashboard'),
          apiFetch<{ ebooks: Ebook[]; bankAccount: BankAccount }>('/api/ebooks'),
          apiFetch<{ members: Member[] }>('/api/members'),
          apiFetch<{
            entries: ReaderHistoryEntry[];
            memberSummaries: MemberHistorySummary[];
          }>('/api/history'),
          apiFetch<LibraryReportPayload>('/api/reports'),
        ]);

      setDashboardData(dashRes);
      setEbooks(booksRes.ebooks);
      setBankAccount(booksRes.bankAccount);
      setMembers(membersRes.members);
      setHistoryEntries(historyRes.entries);
      setMemberSummaries(historyRes.memberSummaries);
      setReportData(reportRes);

      if (canSeeTransactions) {
        const trxRes = await apiFetch<{
          transactions: Transaction[];
          members: Member[];
          paidEbooks: Ebook[];
        }>('/api/transactions');
        setTransactions(trxRes.transactions);
        setPaidEbooks(trxRes.paidEbooks);
      } else {
        setTransactions([]);
        setPaidEbooks([]);
      }
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Gagal memuat data perpustakaan.',
        'error'
      );
    } finally {
      setLoadingData(false);
    }
  }, [notify]);

  const handleLoginSuccess = (loggedUser: SessionUser, welcomeNotice?: string) => {
    setUser(loggedUser);
    setActiveTab('dashboard');
    if (welcomeNotice) {
      notify(welcomeNotice);
    }
    loadWorkspaceData(loggedUser);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setDashboardData(null);
    setEbooks([]);
    setMembers([]);
    setTransactions([]);
    setHistoryEntries([]);
    setReportData(null);
    setActiveTab('dashboard');
  };

  const handleRefresh = useCallback(() => {
    if (user) {
      loadWorkspaceData(user);
    }
  }, [user, loadWorkspaceData]);

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = user.role === 'admin';
  const canVerify =
    isAdmin || Boolean(user.permissions?.canVerifyPayments);
  const pendingCount = dashboardData?.summary.pendingTransactions || 0;

  const navItems: {
    id: TabId;
    label: string;
    group?: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    meta?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'ebooks',
      label: 'Data e-Book',
      group: 'Master Data',
      icon: BookOpen,
      visible: true,
    },
    {
      id: 'members',
      label: isAdmin ? 'Data Anggota' : 'Profil Anggota Saya',
      group: 'Master Data',
      icon: Users,
      visible: true,
    },
    {
      id: 'transactions',
      label: 'Transaksi',
      icon: CreditCard,
      visible: canVerify,
      meta: pendingCount > 0 ? `${pendingCount} Baru` : undefined,
    },
    {
      id: 'history',
      label: 'Riwayat Pembaca',
      icon: History,
      visible: true,
    },
    {
      id: 'reports',
      label: 'Laporan',
      icon: BarChart3,
      visible: true,
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: Settings,
      visible: isAdmin,
    },
  ];

  const visibleNav = navItems.filter((item) => item.visible);

  // Guard activeTab if permissions prevent access
  const currentTabItem = visibleNav.find((n) => n.id === activeTab) || visibleNav[0];
  const safeTab = currentTabItem.id;

  const renderSidebarContent = () => {
    let lastGroup: string | undefined;
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-sm text-slate-900 leading-tight">
            Perpustakaan Digital AI
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const showGroupHeader = item.group && item.group !== lastGroup;
            lastGroup = item.group;
            const isActive = safeTab === item.id;

            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-400">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.meta && (
                    <span className="text-xs font-semibold text-amber-700 tabular-nums shrink-0">
                      {item.meta}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {user.name}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {isAdmin ? 'Administrator' : `Pengunjung · ${user.email}`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-white border-r border-slate-200 shrink-0 no-print">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Tutup menu"
              className="absolute right-3 top-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Brand/Breadcrumb — Context — Single Primary Action */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium text-slate-500 truncate">
              <span>Perpustakaan AI Indonesia</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-900 font-semibold">
                {currentTabItem.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-600 truncate max-w-[200px]">
              {isAdmin ? 'Admin' : user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm no-print">
            <div
              role="status"
              className={`px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start justify-between gap-3 ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="opacity-70 hover:opacity-100 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {safeTab === 'dashboard' && (
            <DashboardView
              user={user}
              data={dashboardData}
              loading={loadingData}
              onNavigate={(tab) => setActiveTab(tab as TabId)}
              onRefresh={handleRefresh}
              onNotify={notify}
            />
          )}

          {safeTab === 'ebooks' && (
            <EbookCatalogView
              user={user}
              ebooks={ebooks}
              bankAccount={bankAccount}
              loading={loadingData}
              onRefresh={handleRefresh}
              onNotify={notify}
            />
          )}

          {safeTab === 'members' && (
            <MembersView
              user={user}
              members={members}
              loading={loadingData}
              onRefresh={handleRefresh}
              onNotify={notify}
            />
          )}

          {safeTab === 'transactions' && canVerify && (
            <TransactionsView
              user={user}
              transactions={transactions}
              members={members}
              paidEbooks={paidEbooks}
              loading={loadingData}
              onRefresh={handleRefresh}
              onNotify={notify}
            />
          )}

          {safeTab === 'history' && (
            <ReaderHistoryView
              user={user}
              entries={historyEntries}
              memberSummaries={memberSummaries}
              loading={loadingData}
            />
          )}

          {safeTab === 'reports' && (
            <ReportsView
              user={user}
              report={reportData}
              loading={loadingData}
            />
          )}

          {safeTab === 'settings' && isAdmin && (
            <SettingsView onRefresh={handleRefresh} onNotify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}
