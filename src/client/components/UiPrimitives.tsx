import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../lib/cn";

export function SectionLabel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("text-[11px] uppercase tracking-[0.14em] text-muted", className)}>{children}</p>
  );
}

export function StatusChip({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent-border/80 bg-background px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />;
}

export function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-frosted bg-background p-3", className)}>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1.5 text-[30px] leading-none font-semibold text-text">{value}</p>
    </div>
  );
}
