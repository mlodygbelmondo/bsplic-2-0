import { lazy, Suspense, useEffect, useState } from 'react';
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
  Bot,
  BadgePlus,
  MoreHorizontal,
  Vote,
} from 'lucide-react';

const DashboardTab = lazy(() => import('./DashboardTab'));
const CreateBetTab = lazy(() => import('./CreateBetTab'));
const ManageBetsTab = lazy(() => import('./ManageBetsTab'));
const ProposalsTab = lazy(() => import('./ProposalsTab'));
const CategoriesTab = lazy(() => import('./CategoriesTab'));
const EniuBotTab = lazy(() => import('./EniuBotTab'));
const BonusCampaignsTab = lazy(() => import('./BonusCampaignsTab'));
const FeaturePollsTab = lazy(() => import('./FeaturePollsTab'));

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
    shortLabel: 'Panel',
    icon: LayoutDashboard,
  },
  {
    key: 'manage',
    label: 'Zarządzaj',
    shortLabel: 'Bety',
    icon: ListChecks,
  },
  {
    key: 'create',
    label: 'Utwórz zakład',
    shortLabel: 'Dodaj',
    icon: PlusCircle,
  },
  {
    key: 'proposals',
    label: 'Propozycje',
    shortLabel: 'Propo',
    icon: Lightbulb,
  },
  { key: 'categories', label: 'Kategorie', shortLabel: 'Kat.', icon: Tag },
  { key: 'eniu', label: 'Eniu', shortLabel: 'Eniu', icon: Bot },
  { key: 'bonuses', label: 'Bonusy', shortLabel: 'Bonus', icon: BadgePlus },
  {
    key: 'feature-polls',
    label: 'Głosowania',
    shortLabel: 'Głosy',
    icon: Vote,
  },
];

const MOBILE_PRIMARY_TAB_KEYS: AdminTab[] = [
  'manage',
  'proposals',
  'create',
  'bonuses',
  'more',
];

const MOBILE_MORE_TAB_KEYS: AdminTab[] = [
  'dashboard',
  'categories',
  'eniu',
  'feature-polls',
];

const MORE_TAB_CONFIG: TabConfig = {
  key: 'more',
  label: 'Więcej',
  shortLabel: 'Więcej',
  icon: MoreHorizontal,
};

function AdminTabFallback() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-lg bg-muted animate-pulse" />
      <div className="h-48 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

export default function AdminLayout() {
  const { isAdmin, isModerator, loading } = useAuth();
  const availableTabs = isAdmin
    ? TABS
    : TABS.filter((availableTab) => availableTab.key === 'proposals');
  const defaultTab: AdminTab = isAdmin ? 'dashboard' : 'proposals';
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
  if (!isAdmin && !isModerator) return <Navigate to="/" />;

  const activeTab = availableTabs.some(
    (availableTab) => availableTab.key === tab,
  )
    ? tab
    : isAdmin && tab === 'more'
      ? tab
    : defaultTab;
  const activeTabLabel =
    activeTab === 'more'
      ? MORE_TAB_CONFIG.label
      : availableTabs.find((t) => t.key === activeTab)?.label;
  const mobileTabs = isAdmin
    ? MOBILE_PRIMARY_TAB_KEYS.map((key) =>
        key === 'more'
          ? MORE_TAB_CONFIG
          : availableTabs.find((availableTab) => availableTab.key === key),
      ).filter(Boolean) as TabConfig[]
    : availableTabs;
  const mobileMoreTabs = MOBILE_MORE_TAB_KEYS.map((key) =>
    availableTabs.find((availableTab) => availableTab.key === key),
  ).filter(Boolean) as TabConfig[];

  return (
    <div className="h-safe-screen overflow-hidden bg-muted/30 flex flex-col">
      <Navbar />

      {/* Desktop sidebar + content */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-6 border-b border-border/50">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {isAdmin ? 'Panel Admina' : 'Panel Moderatora'}
            </h2>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1">
            {availableTabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left',
                  activeTab === key
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    activeTab === key ? 'text-primary' : '',
                  )}
                />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="h-full overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-none p-4 sm:p-6 md:p-8">
              {/* Mobile page header */}
              <div className="md:hidden mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">
                  {activeTabLabel}
                </h1>
              </div>

              {/* Desktop page header */}
              <div className="hidden md:flex mb-8 items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">
                  {activeTabLabel}
                </h1>
              </div>

              <Suspense fallback={<AdminTabFallback />}>
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'create' && <CreateBetTab />}
                {activeTab === 'manage' && <ManageBetsTab />}
                {activeTab === 'proposals' && <ProposalsTab />}
                {activeTab === 'categories' && <CategoriesTab />}
                {activeTab === 'eniu' && <EniuBotTab />}
                {activeTab === 'bonuses' && <BonusCampaignsTab />}
                {activeTab === 'feature-polls' && <FeaturePollsTab />}
                {activeTab === 'more' && (
                  <div className="space-y-3">
                    <h2 className="text-base font-semibold">
                      Pozostałe sekcje
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mobileMoreTabs.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTab(key)}
                          className="flex min-h-[56px] items-center gap-3 rounded-xl bg-card p-4 text-left card-shadow transition-colors hover:bg-muted"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="font-semibold">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Nawigacja admina"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none"
      >
        <div
          className="grid bg-card/95 backdrop-blur-md border-t border-border/60 shadow-[0_-6px_18px_rgba(15,23,42,0.12)] px-2.5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-auto overflow-visible"
          style={{
            gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {mobileTabs.map(({ key, label, shortLabel, icon: Icon }) => {
            const isCenter = key === 'create';
            const isMoreActive =
              key === 'more' &&
              (activeTab === 'more' ||
                MOBILE_MORE_TAB_KEYS.includes(activeTab));
            const isActive = activeTab === key || isMoreActive;

            if (isCenter) {
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  aria-label={label}
                  className="relative -top-4 flex min-h-[76px] w-full min-w-0 flex-col items-center justify-center"
                >
                  <div
                    className={cn(
                      'flex h-[68px] w-[68px] items-center justify-center rounded-full border-4 border-background text-white shadow-lg transition-transform active:scale-95',
                      isActive
                        ? 'gradient-primary'
                        : 'bg-primary hover:brightness-110',
                    )}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-label={label}
                className={cn(
                  'flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={cn(
                    'w-full truncate text-center text-[11px] font-medium leading-none',
                    isActive && 'font-semibold',
                  )}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
