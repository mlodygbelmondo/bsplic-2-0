import { cn } from "@/lib/utils";

interface SectionLoaderProps {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Branded in-content loader used wherever a panel waits for data.
 * Replaces the old gray skeleton placeholders.
 */
export function SectionLoader({
  label = "Ładowanie...",
  size = "md",
  className,
}: SectionLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        size === "md" ? "py-14" : "py-7",
        className,
      )}
    >
      <span
        className={cn("brand-spinner", size === "sm" && "brand-spinner-sm")}
        aria-hidden="true"
      />
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
