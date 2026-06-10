import { Badge, BADGE_DEFINITIONS } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProfileBadgesSectionProps {
  badges: Badge[];
}

function formatBadgeDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileBadgesSection({ badges }: ProfileBadgesSectionProps) {
  return (
    <section
      aria-label="Odznaki"
      className="app-surface rounded-xl p-4"
    >
      <h2 className="font-bold mb-3">Odznaki</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(BADGE_DEFINITIONS).map(([key, definition]) => {
          const unlockedBadge = badges.find((badge) => badge.badge_key === key);
          return (
            <li
              key={key}
              aria-label={definition.name}
              className={cn(
                "rounded-xl p-3 transition-all",
                unlockedBadge
                  ? "app-subsurface ring-1 ring-primary/25"
                  : "app-subsurface",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border",
                    unlockedBadge
                      ? "border-primary/20 bg-background"
                      : "border-border bg-muted/40",
                  )}
                >
                  <img
                    src={definition.imageSrc}
                    alt={`Odznaka ${definition.name}`}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                      "h-14 w-14 object-contain",
                      !unlockedBadge && "grayscale opacity-60",
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    {definition.name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {definition.description}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium",
                      unlockedBadge ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {unlockedBadge
                      ? `Odblokowano: ${formatBadgeDate(unlockedBadge.unlocked_at)}`
                      : "Nieodblokowana"}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
