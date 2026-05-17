import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { cn } from '@/lib/utils';
import type { AdminTab } from '../constants';
import {
  LayoutDashboard,
  PlusCircle,
  ListChecks,
  Lightbulb,
  Tag,
} from 'lucide-react';

import DashboardTab from './DashboardTab';
import CreateBetTab from './CreateBetTab';
import ManageBetsTab from './ManageBetsTab';
import ProposalsTab from './ProposalsTab';
import CategoriesTab from './CategoriesTab';

interface TabConfig {
  key: AdminTab;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'manage',
    label: 'Zarządzaj',
    shortLabel: 'Zarządzaj',
    icon: ListChecks,
  },
  {
    key: 'create',
    label: 'Utwórz zakład',
    shortLabel: 'Utwórz',
    icon: PlusCircle,
  },
  {
    key: 'proposals',
    label: 'Propozycje',
    shortLabel: 'Propozycje',
    icon: Lightbulb,
  },
  { key: 'categories', label: 'Kategorie', shortLabel: 'Kategorie', icon: Tag },
];

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="h-safe-screen overflow-hidden bg-background flex flex-col">
      <Navbar />

      {/* Desktop sidebar + content */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-6 border-b border-border/50">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Panel Admina
            </h2>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left',
                  tab === key
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    tab === key ? 'text-primary' : '',
                  )}
                />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden md:pb-0">
          <div className="h-full overflow-y-auto overscroll-contain">
            <div className="app-mobile-content-pad mx-auto w-full max-w-none p-4 sm:p-6 md:p-8 md:pb-8">
              {/* Mobile page header */}
              <div className="md:hidden mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">
                  {TABS.find((t) => t.key === tab)?.label}
                </h1>
              </div>

              {/* Desktop page header */}
              <div className="hidden md:flex mb-8 items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">
                  {TABS.find((t) => t.key === tab)?.label}
                </h1>
              </div>

              {tab === 'dashboard' && <DashboardTab />}
              {tab === 'create' && <CreateBetTab />}
              {tab === 'manage' && <ManageBetsTab />}
              {tab === 'proposals' && <ProposalsTab />}
              {tab === 'categories' && <CategoriesTab />}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile admin tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50" aria-label="Nawigacja admina">
        <div className="grid grid-cols-5 border-t border-white/10 bg-[#10131e]/96 px-2 pt-2 shadow-[0_-18px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {TABS.map(({ key, shortLabel, icon: Icon }) => {
            const isActive = tab === key;

            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-black transition-colors',
                  isActive
                    ? 'text-[#ffd83f]'
                    : 'text-white/56 hover:text-white',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    isActive && 'drop-shadow-[0_0_10px_rgba(255,216,63,0.5)]',
                  )}
                  strokeWidth={isActive ? 2.8 : 2.2}
                />
                <span className="leading-none">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
