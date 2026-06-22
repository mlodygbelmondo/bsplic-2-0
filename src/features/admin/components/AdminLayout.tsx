import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import LiquidGlass from 'liquid-glass-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Navbar } from '@/components/Navbar';
import {
  getLiquidGlassMobileNavActiveItemClassName,
  getLiquidGlassMobileNavBorderClassName,
  getLiquidGlassMobileNavInactiveItemClassName,
  getLiquidGlassMobileNavShellClassName,
  LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME,
  LIQUID_GLASS_MOBILE_NAV_STYLE,
} from '@/components/liquidGlassMobileNavStyles';
import { cn } from '@/lib/utils';
import {
  getNextScrollChromeState,
  type ScrollChromeState,
} from '@/lib/scroll-chrome';
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
    shortLabel: 'Propozycje',
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
  const { theme } = useTheme();
  const availableTabs = isAdmin
    ? TABS
    : TABS.filter((availableTab) => availableTab.key === 'proposals');
  const defaultTab: AdminTab = isAdmin ? 'manage' : 'proposals';
  const [tab, setTab] = useState<AdminTab>('manage');
  const [mobileChromeHidden, setMobileChromeHidden] = useState(false);
  const mobileChromeStateRef = useRef<ScrollChromeState>();
  const mobileNavTone = 'default';
  const mobileActiveClassName = getLiquidGlassMobileNavActiveItemClassName(
    theme,
    mobileNavTone,
  );
  const mobileInactiveClassName = getLiquidGlassMobileNavInactiveItemClassName(
    theme,
    mobileNavTone,
  );

  const handleAdminScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const nextChromeState = getNextScrollChromeState(
      mobileChromeStateRef.current,
      {
        scrollTop,
        scrollHeight,
        clientHeight,
      },
    );

    mobileChromeStateRef.current = nextChromeState;
    setMobileChromeHidden((current) =>
      current === nextChromeState.hidden ? current : nextChromeState.hidden,
    );
  };

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
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <div
            data-testid="admin-scroll-container"
            onScroll={handleAdminScroll}
            className="h-full overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
          >
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
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] transition-[transform,opacity] duration-200 ease-out will-change-transform',
          mobileChromeHidden
            ? 'translate-y-full opacity-0'
            : 'translate-y-0 opacity-100',
        )}
      >
        <div className="pointer-events-auto relative mx-auto h-[72px] w-full max-w-[430px]">
          <LiquidGlass
            displacementScale={46}
            blurAmount={0.035}
            saturation={152}
            aberrationIntensity={1.35}
            elasticity={0.04}
            cornerRadius={28}
            padding="0px"
            overLight={false}
            mode="standard"
            className="w-full"
            style={LIQUID_GLASS_MOBILE_NAV_STYLE}
          >
            <div
              className={cn(
                'grid h-[72px] w-[calc(100vw-1rem)] max-w-[430px] overflow-visible rounded-[1.75rem] border px-1.5 py-1.5 ring-1 backdrop-blur-2xl',
                getLiquidGlassMobileNavShellClassName(theme, mobileNavTone),
                getLiquidGlassMobileNavBorderClassName(theme, mobileNavTone),
              )}
              style={{
                gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))`,
              }}
            >
              {mobileTabs.map(({ key, label, shortLabel, icon: Icon }) => {
                const isMoreActive =
                  key === 'more' &&
                  (activeTab === 'more' ||
                    MOBILE_MORE_TAB_KEYS.includes(activeTab));
                const isActive = activeTab === key || isMoreActive;

                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    aria-label={label}
                    className={cn(
                      LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME,
                      isActive ? cn('font-bold', mobileActiveClassName) : mobileInactiveClassName,
                    )}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    <span
                      className={cn(
                        'w-full truncate pb-0.5 text-center leading-[1.15]',
                        isActive && 'font-bold',
                      )}
                    >
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </LiquidGlass>
        </div>
      </nav>
    </div>
  );
}
