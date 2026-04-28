import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/cn";

type CardVariant = "panel" | "soft";

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    variant?: CardVariant;
  }
>;

export function Card({ children, className, variant = "panel", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border",
        variant === "panel"
          ? "border-accent-border/80 bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-frosted bg-surface/80",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
