import { Input as BaseInput } from "@base-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";

type InputSize = "sm" | "md";

type InputProps = Omit<ComponentPropsWithoutRef<typeof BaseInput>, "size"> & {
  size?: InputSize;
};

export function Input({ className, size = "sm", ...props }: InputProps) {
  return (
    <BaseInput
      className={cn(
        "w-full rounded-md border border-accent-border/70 bg-surface text-text outline-none placeholder:text-muted focus:border-accent",
        size === "md" ? "px-3 py-2 text-sm" : "px-2 py-1.5 text-xs",
        className,
      )}
      {...props}
    />
  );
}
