import {
  Bell,
  Flame,
  Home,
  Plus,
  Radio,
  Search,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  User,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/database';
import { PrototypeFrame } from './PrototypeFrame';
import type { DisplayCategory, DisplayEvent } from './useRedesignData';

type VariantProps = {
  events: DisplayEvent[];
  categories: DisplayCategory[];
  profile: Profile | null;
  loading: boolean;
};

const formatOdds = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return value.toFixed(2).replace('.', ',');
};

const formatBalance = (profile: Profile | null) => {
  if (!profile) {
    return '0 zł';
  }
  return `${Number(profile.balance).toFixed(2).replace('.', ',')} zł`;
};

const liveCount = (events: DisplayEvent[]) =>
  events.filter((event) => event.isLive).length;

const Logo = ({ className }: { className?: string }) => (
  <span className={cn('text-[15px] font-black tracking-tight', className)}>
    BSPLIC<span className="text-red-500">.</span>
  </span>
);

const BalancePill = ({
  profile,
  tone = 'light',
}: {
  profile: Profile | null;
  tone?: 'light' | 'dark' | 'neon';
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
        tone === 'light' && 'bg-white/15 text-white backdrop-blur',
        tone === 'dark' && 'bg-neutral-800 text-white',
        tone === 'neon' && 'bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-400/50',
      )}
    >
      <Wallet className="h-3 w-3" /> {formatBalance(profile)}
    </button>
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
        tone === 'light' && 'bg-yellow-400 text-neutral-900',
        tone === 'dark' && 'bg-yellow-400 text-neutral-900',
        tone === 'neon' && 'bg-emerald-400 text-emerald-950',
      )}
    >
      <Plus className="h-3 w-3" /> Doładuj
    </button>
  </div>
);

const CategoryRail = ({
  categories,
  variant = 'light',
}: {
  categories: DisplayCategory[];
  variant?: 'light' | 'dark' | 'underline';
}) => {
  if (categories.length === 0) {
    return <div className="h-9" />;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
          variant === 'underline'
            ? 'border-b-2 border-red-500 px-2 pb-1.5 text-white rounded-none'
            : variant === 'dark'
              ? 'bg-white text-neutral-950'
              : 'bg-white text-red-600 shadow-sm',
        )}
      >
        ✨ Dla Ciebie
      </button>
      {categories.map((category) => {
        if (variant === 'underline') {
          return (
            <button
              key={category.id}
              type="button"
              className="shrink-0 border-b-2 border-transparent px-2 pb-1.5 text-[12px] font-bold text-white/60"
            >
              {category.label}
            </button>
          );
        }

        return (
          <button
            key={category.id}
            type="button"
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
              variant === 'dark'
                ? 'bg-white/10 text-white/80'
                : 'bg-white/15 text-white/90 backdrop-blur',
            )}
          >
            {category.emoji} {category.label}
          </button>
        );
      })}
    </div>
  );
};

const StatusBar = ({ tint = 'dark' }: { tint?: 'dark' | 'light' }) => (
  <div
    className={cn(
      'flex items-center justify-between px-5 pt-2 text-[11px] font-semibold',
      tint === 'dark' ? 'text-white' : 'text-neutral-900',
    )}
  >
    <span>18:57</span>
    <div className="flex items-center gap-1 opacity-80">
      <span>LTE</span>
      <span className="rounded-md bg-current/10 px-1 text-[10px]">23%</span>
    </div>
  </div>
);

const OddsButton = ({
  label,
  value,
  tone = 'yellow',
  highlight,
}: {
  label: string;
  value: number;
  tone?: 'yellow' | 'dark' | 'outline' | 'green' | 'light';
  highlight?: boolean;
}) => (
  <button
    type="button"
    className={cn(
      'flex flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-transform active:scale-95',
      tone === 'yellow' && 'bg-yellow-400 text-neutral-900',
      tone === 'dark' && 'bg-neutral-800 text-white',
      tone === 'outline' && 'border border-white/20 bg-white/5 text-white',
      tone === 'green' && 'bg-emerald-500 text-emerald-950',
      tone === 'light' && 'bg-neutral-100 text-neutral-900',
      highlight && 'ring-2 ring-red-500',
    )}
  >
    <span className="line-clamp-1 text-[10px] font-medium opacity-80">{label}</span>
    <span className="text-[15px] font-black leading-none">{formatOdds(value)}</span>
  </button>
);

const PopularityBar = ({ value }: { value: number }) => (
  <div className="flex gap-1">
    <div
      className="h-[3px] flex-1 rounded-full"
      style={{
        background: `linear-gradient(90deg, #facc15 ${value}%, rgba(255,255,255,0.12) ${value}%)`,
      }}
    />
    <div
      className="h-[3px] flex-1 rounded-full"
      style={{
        background: `linear-gradient(90deg, #ef4444 ${Math.max(0, 100 - value)}%, rgba(255,255,255,0.12) ${Math.max(0, 100 - value)}%)`,
      }}
    />
    <div className="h-[3px] flex-1 rounded-full bg-white/10" />
  </div>
);

const EventCard = ({ event }: { event: DisplayEvent }) => (
  <article className="rounded-2xl bg-neutral-900/80 p-3 shadow-lg ring-1 ring-white/5">
    <header className="mb-2 flex items-center gap-2 text-[11px] text-white/60">
      <span>{event.leagueEmoji}</span>
      <span className="truncate font-medium">{event.league}</span>
      <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/80">
        {event.startsAt}
      </span>
      {event.isLive && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
        </span>
      )}
      {event.isBoosted && (
        <span className="rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black text-neutral-900">
          BOOST
        </span>
      )}
    </header>
    <h3 className="mb-3 line-clamp-2 text-[14px] font-bold leading-snug text-white">
      {event.title}
    </h3>
    <div className="flex gap-1.5">
      {event.options.slice(0, 3).map((option) => (
        <OddsButton
          key={`${event.id}-${option.label}`}
          label={option.label}
          value={option.odds}
        />
      ))}
    </div>
    <div className="mt-2">
      <PopularityBar value={event.popularity} />
    </div>
  </article>
);

const VariantTitle = ({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string;
  title: string;
  className?: string;
}) => (
  <div className={cn('px-3 py-3', className)}>
    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
      {eyebrow}
    </div>
    <h1 className="text-[20px] font-black leading-tight text-white">{title}</h1>
  </div>
);

const BottomNavItem = ({
  icon: Icon,
  label,
  badge,
  active,
  emphasis,
}: {
  icon: LucideIcon;
  label: string;
  badge?: number | string;
  active?: boolean;
  emphasis?: boolean;
}) => (
  <button
    type="button"
    className={cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors',
      active ? 'text-white' : 'text-white/55',
      emphasis && 'text-yellow-400',
    )}
  >
    <span className="relative">
      <Icon className={cn('h-5 w-5', emphasis && 'h-6 w-6')} />
      {badge !== undefined && badge !== 0 && badge !== '0' && (
        <span className="absolute -right-2 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
          {badge}
        </span>
      )}
    </span>
    <span>{label}</span>
  </button>
);

const StandardBottomBar = ({ events }: { events: DisplayEvent[] }) => (
  <div className="border-t border-white/5 bg-neutral-950/95 backdrop-blur">
    <div className="flex items-center pb-3 pt-1">
      <BottomNavItem icon={Search} label="Sport" active />
      <BottomNavItem icon={Radio} label="Live" badge={liveCount(events)} />
      <BottomNavItem icon={Flame} label="Popularne" emphasis />
      <BottomNavItem icon={Star} label="Misje" />
      <BottomNavItem icon={Ticket} label="Kupon" />
    </div>
  </div>
);

const SectionHeading = ({
  children,
  className,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) => (
  <div className={cn('mb-2 mt-4 flex items-end justify-between px-3', className)}>
    <h2 className="text-[16px] font-black text-white">{children}</h2>
    {action}
  </div>
);

const TopGradient = ({
  children,
  gradient = 'from-red-600 via-red-700 to-red-900',
}: {
  children: React.ReactNode;
  gradient?: string;
}) => (
  <div className={cn('bg-gradient-to-br pb-2 pt-1 shadow-lg', gradient)}>
    <StatusBar />
    {children}
  </div>
);

const EmptyState = ({ loading }: { loading: boolean }) => (
  <div className="mx-3 my-6 rounded-2xl bg-white/[0.04] p-6 text-center ring-1 ring-white/5">
    <Sparkles className="mx-auto mb-2 h-6 w-6 text-white/60" />
    <p className="text-[13px] font-bold text-white">
      {loading ? 'Ładowanie zakładów z bazy…' : 'Brak aktywnych zakładów w bazie'}
    </p>
    <p className="mt-1 text-[11px] text-white/50">
      Prototyp tej karty pokazuje realne zakłady – dodaj jakiś w panelu admina, a
      zobaczysz go tutaj.
    </p>
  </div>
);

export const Variant1Classic = ({ events, categories, profile, loading }: VariantProps) => (
  <PrototypeFrame
    background="bg-neutral-950"
    top={
      <TopGradient gradient="from-red-600 via-red-700 to-red-900">
        <div className="flex items-center justify-between px-3 py-2">
          <Logo className="text-white" />
          <BalancePill profile={profile} tone="light" />
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
        <CategoryRail categories={categories} />
      </TopGradient>
    }
    bottom={<StandardBottomBar events={events} />}
  >
    <div className="pb-28 pt-[112px]">
      <VariantTitle eyebrow="V1 · Classic" title="Feed inspirowany kartami Betclic" />
      <div className="space-y-3 px-3">
        {events.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          events.slice(0, 8).map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </div>
  </PrototypeFrame>
);

export const Variant2LivePulse = ({ events, categories, profile, loading }: VariantProps) => {
  const liveEvents = events.filter((event) => event.isLive);
  const restEvents = events.filter((event) => !event.isLive);
  const ordered = [...liveEvents, ...restEvents];

  return (
    <PrototypeFrame
      background="bg-[#0a0a0f]"
      top={
        <TopGradient gradient="from-red-700 via-rose-900 to-neutral-950">
          <div className="flex items-center justify-between px-3 py-2">
            <Logo className="text-white" />
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-black uppercase text-red-300 ring-1 ring-red-500/40">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />{' '}
              {liveEvents.length} LIVE
            </div>
            <BalancePill profile={profile} tone="light" />
          </div>
          {ordered.length > 0 && (
            <div className="mx-3 mb-2 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
              <div className="flex animate-[ticker_22s_linear_infinite] gap-6 whitespace-nowrap py-1.5 pl-3 text-[11px] font-semibold text-white/90">
                {[...ordered, ...ordered].slice(0, 12).map((event, idx) => (
                  <span
                    key={`${event.id}-${idx}`}
                    className={cn(
                      event.isLive && 'text-red-300',
                      event.isBoosted && 'text-yellow-300',
                    )}
                  >
                    {event.leagueEmoji} {event.title} · {event.startsAt}
                  </span>
                ))}
              </div>
            </div>
          )}
          <CategoryRail categories={categories} variant="dark" />
        </TopGradient>
      }
      bottom={
        <div className="border-t border-white/5 bg-black/95 backdrop-blur">
          <div className="flex items-center px-2 pb-3 pt-1">
            <BottomNavItem icon={Home} label="Start" />
            <BottomNavItem
              icon={Radio}
              label="Live"
              badge={liveEvents.length || undefined}
              active
              emphasis
            />
            <BottomNavItem icon={Trophy} label="Sport" />
            <BottomNavItem icon={Ticket} label="Kupon" />
            <BottomNavItem icon={User} label="Profil" />
          </div>
        </div>
      }
    >
      <div className="pb-28 pt-[156px]">
        <VariantTitle eyebrow="V2 · Live pulse" title="Wszystko, co dzieje się teraz" />
        <div className="space-y-2 px-3">
          {ordered.length === 0 ? (
            <EmptyState loading={loading} />
          ) : (
            ordered.slice(0, 9).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/5"
              >
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px]"
                  style={{ background: `${event.leagueColor}33` }}
                >
                  {event.leagueEmoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[12px] font-bold text-white">
                    {event.title}
                  </div>
                  <div className="truncate text-[10px] text-white/50">
                    {event.league} · {event.startsAt}
                    {event.isLive && ' · LIVE'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {event.options.slice(0, 2).map((option, idx) => (
                    <span
                      key={`${event.id}-${option.label}`}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-black',
                        idx === 0
                          ? 'bg-yellow-400 text-neutral-900'
                          : 'bg-white/10 text-white',
                      )}
                    >
                      {formatOdds(option.odds)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PrototypeFrame>
  );
};

export const Variant3BoostSpotlight = ({
  events,
  categories,
  profile,
  loading,
}: VariantProps) => {
  const boostEvents = events.filter((event) => event.isBoosted);
  const featured = boostEvents[0] ?? events[0];

  return (
    <PrototypeFrame
      background="bg-neutral-950"
      top={
        <div className="bg-gradient-to-b from-fuchsia-950 via-neutral-950 to-transparent pt-1">
          <StatusBar />
          <div className="flex items-center justify-between px-3 py-2">
            <Logo className="text-white" />
            <BalancePill profile={profile} tone="neon" />
          </div>
          <CategoryRail categories={categories} variant="dark" />
        </div>
      }
      bottom={<StandardBottomBar events={events} />}
    >
      <div className="pb-28 pt-[124px]">
        <VariantTitle eyebrow="V3 · Boost spotlight" title="Wzmacniane kursy dnia" />
        {featured ? (
          <section className="mx-3 overflow-hidden rounded-3xl border border-yellow-400/30 bg-[radial-gradient(120%_140%_at_0%_0%,#facc1540,transparent_60%),linear-gradient(135deg,#1d0a0d,#3b0a4d)] p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase text-yellow-300">
              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-neutral-900">
                {featured.isBoosted ? 'BOOST' : 'NA TOPIE'}
              </span>
              <span>{featured.league}</span>
            </div>
            <div className="mb-1 line-clamp-3 text-[22px] font-black uppercase leading-tight tracking-tight text-white">
              {featured.title}
            </div>
            <div className="mb-3 text-[12px] text-white/70">
              {featured.leagueEmoji} {featured.league} · {featured.startsAt}
            </div>
            <div className="flex flex-wrap items-stretch gap-2">
              {featured.options.slice(0, 3).map((option) => (
                <button
                  key={`${featured.id}-${option.label}`}
                  className="flex min-w-[80px] flex-1 flex-col items-center rounded-2xl bg-yellow-400 px-3 py-2 text-neutral-900"
                >
                  <span className="line-clamp-1 text-[10px] font-bold opacity-80">
                    {option.label}
                  </span>
                  <span className="text-[18px] font-black leading-none">
                    {formatOdds(option.odds)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState loading={loading} />
        )}
        <SectionHeading>Pozostałe wzmocnione</SectionHeading>
        <div className="space-y-2 px-3">
          {boostEvents
            .slice(1)
            .concat(events.filter((event) => !event.isBoosted))
            .slice(0, 5)
            .map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
        </div>
      </div>
    </PrototypeFrame>
  );
};

export const Variant4Compact = ({ events, categories, profile, loading }: VariantProps) => (
  <PrototypeFrame
    background="bg-neutral-900"
    top={
      <div className="bg-neutral-950/95 backdrop-blur">
        <StatusBar />
        <div className="flex items-center gap-2 px-3 py-2">
          <Logo className="text-white" />
          <div className="ml-2 flex flex-1 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white/60">
            <Search className="h-3.5 w-3.5" />
            <span>Szukaj zakładu, drużyny…</span>
          </div>
          <BalancePill profile={profile} tone="dark" />
        </div>
        <CategoryRail categories={categories} variant="underline" />
      </div>
    }
    bottom={<StandardBottomBar events={events} />}
  >
    <div className="pb-28 pt-[120px]">
      <VariantTitle eyebrow="V4 · Compact" title="Gęsta lista dla profesjonalistów" />
      {events.length === 0 ? (
        <EmptyState loading={loading} />
      ) : (
        <div className="divide-y divide-white/5 border-y border-white/5">
          {events.slice(0, 14).map((event) => (
            <div key={event.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="w-12 text-center text-[11px] font-bold text-white/70">
                {event.startsAt.split(' · ').pop()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-bold text-white">
                  {event.title}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {event.leagueEmoji} {event.league}
                  {event.isLive && ' · LIVE'}
                  {event.isBoosted && ' · BOOST'}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {event.options.slice(0, 3).map((option, idx) => (
                  <span
                    key={`${event.id}-${option.label}`}
                    className={cn(
                      'rounded-md px-2 py-1 text-[10px] font-black',
                      idx === 0
                        ? 'bg-yellow-400 text-neutral-900'
                        : 'bg-white/10 text-white',
                    )}
                  >
                    {formatOdds(option.odds)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </PrototypeFrame>
);

export const Variant5StoryCarousel = ({
  events,
  categories,
  profile,
  loading,
}: VariantProps) => (
  <PrototypeFrame
    background="bg-gradient-to-b from-neutral-950 to-neutral-900"
    top={
      <TopGradient gradient="from-rose-700 to-red-600">
        <div className="flex items-center justify-between px-3 py-2">
          <Logo className="text-white" />
          <BalancePill profile={profile} tone="light" />
        </div>
      </TopGradient>
    }
    bottom={<StandardBottomBar events={events} />}
  >
    <div className="pb-28 pt-[80px]">
      <div className="flex gap-3 overflow-x-auto px-3 py-3 scrollbar-hide">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-red-500 to-yellow-400 p-[2px]">
            <div className="grid h-full w-full place-items-center rounded-full bg-neutral-950 text-[12px] font-black text-white">
              ★
            </div>
          </div>
          <span className="text-[9px] font-semibold text-white/70">Twoje</span>
        </div>
        {events.slice(0, 8).map((event) => (
          <div key={event.id} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <div
              className="grid h-16 w-16 place-items-center rounded-full p-[2px]"
              style={{
                background: `conic-gradient(from 200deg, ${event.leagueColor}, #facc15, ${event.leagueColor})`,
              }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-neutral-950 text-[14px] font-bold text-white">
                {event.leagueEmoji}
              </div>
            </div>
            <span className="line-clamp-1 w-full text-center text-[9px] font-semibold text-white/70">
              {event.startsAt.split(' · ').pop()}
            </span>
          </div>
        ))}
      </div>

      <VariantTitle eyebrow="V5 · Stories" title="Wydarzenia jak relacje" />
      <div className="space-y-3 px-3">
        {events.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          events.slice(0, 6).map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </div>
  </PrototypeFrame>
);

export const Variant6PlayerSpotlight = ({
  events,
  categories,
  profile,
  loading,
}: VariantProps) => {
  const spotlights = events.filter((event) => event.isBoosted || event.popularity > 60);
  const featured = (spotlights.length > 0 ? spotlights : events).slice(0, 4);
  const rest = events.filter((event) => !featured.includes(event)).slice(0, 6);

  return (
    <PrototypeFrame
      background="bg-neutral-950"
      top={
        <TopGradient gradient="from-red-700 via-red-600 to-rose-700">
          <div className="flex items-center justify-between px-3 py-2">
            <Logo className="text-white" />
            <BalancePill profile={profile} tone="light" />
          </div>
          <CategoryRail categories={categories} />
        </TopGradient>
      }
      bottom={<StandardBottomBar events={events} />}
    >
      <div className="pb-28 pt-[112px]">
        <SectionHeading className="mt-2">
          <span className="text-white">Warci uwagi</span>
        </SectionHeading>
        {featured.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <div className="flex gap-3 overflow-x-auto px-3 pb-2 scrollbar-hide">
            {featured.map((event, index) => {
              const topOption = event.options.find((option) => option.isHighest);
              return (
                <article
                  key={event.id}
                  className="relative w-[200px] shrink-0 overflow-hidden rounded-2xl p-3 ring-1 ring-white/10"
                  style={{
                    background: `radial-gradient(120% 140% at 0% 0%, ${event.leagueColor}55, transparent 56%), linear-gradient(165deg, #18110c, #070707)`,
                  }}
                >
                  <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                    #{index + 1}
                  </span>
                  <div className="mb-2 line-clamp-2 text-[13px] font-black uppercase leading-tight text-white">
                    {event.title}
                  </div>
                  <div
                    className="mb-3 grid h-20 place-items-center rounded-xl text-[34px] font-black text-white/90"
                    style={{ background: `${event.leagueColor}aa` }}
                  >
                    {event.leagueEmoji}
                  </div>
                  <div className="mb-2 flex items-center justify-between text-[10px] text-white/70">
                    <span className="truncate">{event.league}</span>
                    <span>{event.startsAt}</span>
                  </div>
                  {topOption && (
                    <button className="w-full rounded-xl bg-yellow-400 py-2 text-center text-[12px] font-black text-neutral-900">
                      {topOption.label} · {formatOdds(topOption.odds)}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <SectionHeading>Pozostałe zdarzenia</SectionHeading>
        <div className="space-y-2 px-3">
          {rest.map((event) => (
            <article
              key={event.id}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/5"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px]"
                style={{ background: `${event.leagueColor}55` }}
              >
                {event.leagueEmoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[13px] font-bold text-white">
                  {event.title}
                </div>
                <div className="text-[11px] text-white/60">
                  {event.league} · {event.startsAt}
                </div>
              </div>
              {event.options[0] && (
                <span className="rounded-md bg-yellow-400 px-2 py-1 text-[11px] font-black text-neutral-900">
                  {formatOdds(event.options[0].odds)}
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </PrototypeFrame>
  );
};

export const Variant7GlassDark = ({
  events,
  categories,
  profile,
  loading,
}: VariantProps) => (
  <PrototypeFrame
    background="bg-[radial-gradient(120%_120%_at_0%_0%,#3b0764_0%,transparent_55%),radial-gradient(120%_120%_at_100%_0%,#7c1d1d_0%,transparent_55%),#050507]"
    top={
      <div className="pt-1">
        <StatusBar />
        <div className="mx-3 mt-2 flex items-center justify-between rounded-2xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/10 backdrop-blur-xl">
          <Logo className="text-white" />
          <button className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">
            <Search className="h-3 w-3" />
            <span className="opacity-60">Szukaj</span>
          </button>
          <BalancePill profile={profile} tone="neon" />
        </div>
        <CategoryRail categories={categories} variant="dark" />
      </div>
    }
    bottom={
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center justify-around rounded-full bg-white/[0.08] px-2 py-1.5 ring-1 ring-white/15 backdrop-blur-xl">
          <BottomNavItem icon={Home} label="Start" active />
          <BottomNavItem icon={Radio} label="Live" badge={liveCount(events) || undefined} />
          <BottomNavItem icon={Sparkles} label="Boost" emphasis />
          <BottomNavItem icon={Ticket} label="Kupon" />
          <BottomNavItem icon={User} label="Profil" />
        </div>
      </div>
    }
  >
    <div className="pb-28 pt-[124px]">
      <VariantTitle eyebrow="V7 · Glass" title="Szklane karty na ciemnym tle" />
      {events.length === 0 ? (
        <EmptyState loading={loading} />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3">
          {events.slice(0, 8).map((event) => (
            <article
              key={event.id}
              className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10 backdrop-blur-xl"
            >
              <div className="mb-1 text-[10px] text-white/50">
                {event.leagueEmoji} {event.league}
              </div>
              <div className="mb-2 line-clamp-2 text-[12px] font-black leading-tight text-white">
                {event.title}
              </div>
              <div className="mb-2 text-[10px] text-white/50">{event.startsAt}</div>
              <div className="flex flex-wrap gap-1">
                {event.options.slice(0, 2).map((option, idx) => (
                  <span
                    key={`${event.id}-${option.label}`}
                    className={cn(
                      'rounded-md px-1.5 py-1 text-[10px] font-black ring-1',
                      idx === 0
                        ? 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/30'
                        : 'bg-white/10 text-white ring-white/10',
                    )}
                  >
                    {formatOdds(option.odds)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </PrototypeFrame>
);

export const Variant8MinimalBold = ({
  events,
  categories,
  profile,
  loading,
}: VariantProps) => (
  <PrototypeFrame
    background="bg-white"
    top={
      <div className="bg-white">
        <StatusBar tint="light" />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[18px] font-black tracking-tight text-neutral-900">
            BSPLIC.
          </span>
          <div className="flex items-center gap-2">
            <button className="rounded-full bg-neutral-100 p-2">
              <Search className="h-4 w-4 text-neutral-700" />
            </button>
            <button className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white">
              {formatBalance(profile)}
            </button>
            <button className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black text-white">
              + 100 zł
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          <button className="shrink-0 text-[13px] font-black text-neutral-900">
            Dla Ciebie
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className="shrink-0 text-[13px] font-black text-neutral-400 hover:text-neutral-900"
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    }
    bottom={
      <div className="border-t border-neutral-200 bg-white">
        <div className="flex items-center pb-3 pt-1 text-neutral-500">
          <BottomNavItem icon={Home} label="Start" active />
          <BottomNavItem icon={Radio} label="Live" />
          <BottomNavItem icon={Trophy} label="Sport" />
          <BottomNavItem icon={Ticket} label="Kupon" />
          <BottomNavItem icon={User} label="Profil" />
        </div>
      </div>
    }
  >
    <div className="bg-white pb-28 pt-[124px] text-neutral-900">
      <div className="px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">
          V8 · Minimal bold
        </div>
        <h1 className="text-[26px] font-black leading-tight text-neutral-900">
          Typografia ponad wszystko.
        </h1>
      </div>
      {events.length === 0 ? (
        <div className="mx-4 my-6 rounded-2xl bg-neutral-100 p-6 text-center">
          <p className="text-[13px] font-bold text-neutral-700">
            {loading ? 'Ładowanie z bazy…' : 'Brak aktywnych zakładów'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 border-y border-neutral-200">
          {events.slice(0, 8).map((event) => (
            <article key={event.id} className="px-4 py-4">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                <span>{event.league}</span>
                <span>·</span>
                <span>{event.startsAt}</span>
                {event.isLive && (
                  <span className="rounded-sm bg-red-600 px-1 text-white">LIVE</span>
                )}
                {event.isBoosted && (
                  <span className="rounded-sm bg-yellow-400 px-1 text-neutral-900">
                    BOOST
                  </span>
                )}
              </div>
              <div className="mb-3 line-clamp-2 text-[18px] font-black leading-tight text-neutral-900">
                {event.title}
              </div>
              <div className="flex gap-2">
                {event.options.slice(0, 3).map((option, idx) => (
                  <button
                    key={`${event.id}-${option.label}`}
                    className={cn(
                      'flex flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2',
                      idx === 0
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 text-neutral-900',
                    )}
                  >
                    <span className="line-clamp-1 text-[11px] font-bold opacity-70">
                      {option.label}
                    </span>
                    <span className="text-[15px] font-black">
                      {formatOdds(option.odds)}
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </PrototypeFrame>
);

export type VariantDefinition = {
  id: number;
  slug: string;
  label: string;
  description: string;
  component: (props: VariantProps) => JSX.Element;
};

export const variantDefinitions: VariantDefinition[] = [
  {
    id: 1,
    slug: 'classic',
    label: 'Classic Cards',
    description: 'Czerwone górne pasy + karty z kursami jak referencja Betclic.',
    component: Variant1Classic,
  },
  {
    id: 2,
    slug: 'live-pulse',
    label: 'Live Pulse',
    description: 'Live-first z paskiem tickera i listą wierszy.',
    component: Variant2LivePulse,
  },
  {
    id: 3,
    slug: 'boost',
    label: 'Boost Spotlight',
    description: 'Wielki neonowy boost banner + dodatkowe karty.',
    component: Variant3BoostSpotlight,
  },
  {
    id: 4,
    slug: 'compact',
    label: 'Compact List',
    description: 'Gęsta lista z searchem, dla power-userów.',
    component: Variant4Compact,
  },
  {
    id: 5,
    slug: 'stories',
    label: 'Story Carousel',
    description: 'Karuzela kółek u góry jak relacje, potem karty.',
    component: Variant5StoryCarousel,
  },
  {
    id: 6,
    slug: 'players',
    label: 'Player Spotlight',
    description: 'Karty wyróżnione + lista zdarzeń.',
    component: Variant6PlayerSpotlight,
  },
  {
    id: 7,
    slug: 'glass',
    label: 'Dark Glass',
    description: 'Glassmorphism w siatce 2-kolumnowej.',
    component: Variant7GlassDark,
  },
  {
    id: 8,
    slug: 'minimal',
    label: 'Minimal Bold',
    description: 'Jasny, typograficzny, bez obrazów.',
    component: Variant8MinimalBold,
  },
];
