import { useState } from 'react';
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
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { key: 'create', label: 'Utwórz zakład', shortLabel: 'Utwórz', icon: PlusCircle },
  { key: 'manage', label: 'Zarządzaj', shortLabel: 'Zarządzaj', icon: ListChecks },
  { key: 'proposals', label: 'Propozycje', shortLabel: 'Propozycje', icon: Lightbulb },
  { key: 'categories', label: 'Kategorie', shortLabel: 'Kategorie', icon: Tag },
];

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Desktop sidebar + content */}
      <div className="flex-1 flex">
        {/* Sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Panel Admin
            </h2>
          </div>
          <nav className="flex-1 py-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                  tab === key
                    ? 'border-r-2 border-primary text-primary font-semibold'
                    : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-4">
          <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
            {/* Mobile page header */}
            <div className="md:hidden mb-4">
              <h1 className="text-lg font-bold">
                {TABS.find((t) => t.key === tab)?.label}
              </h1>
            </div>

            {/* Desktop page header */}
            <div className="hidden md:block mb-6">
              <h1 className="text-xl font-bold">
                {TABS.find((t) => t.key === tab)?.label}
              </h1>
            </div>

            {tab === 'dashboard' && <DashboardTab />}
            {tab === 'create' && <CreateBetTab />}
            {tab === 'manage' && <ManageBetsTab />}
            {tab === 'proposals' && <ProposalsTab />}
            {tab === 'categories' && <CategoriesTab />}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex">
          {TABS.map(({ key, shortLabel, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                tab === key
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', tab === key && 'text-primary')} />
              {shortLabel}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
