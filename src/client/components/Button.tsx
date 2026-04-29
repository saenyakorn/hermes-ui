import { Button as BaseButton } from "@base-ui/react";
import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = PropsWithChildren<
  ComponentPropsWithoutRef<typeof BaseButton> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>;

export function Button({
  children,
  className,
  variant = "secondary",
  size = "sm",
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md border transition",
        "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
        size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
        variant === "primary" && "border-accent bg-accent text-background",
        variant === "secondary" && "border-accent-border bg-surface text-text",
        variant === "danger" && "border-red-300/35 bg-red-500/20 text-red-200",
        variant === "ghost" && "border-transparent bg-transparent text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  );
}
