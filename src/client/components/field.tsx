import type { ComponentPropsWithoutRef, TextareaHTMLAttributes } from "react";
import { Input as BaseInput } from "@base-ui/react";
import { cn } from "../lib/cn";

type FieldProps = ComponentPropsWithoutRef<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive";
};

type FieldInputProps = ComponentPropsWithoutRef<typeof BaseInput>;
type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
type FieldErrorProps = {
  errors: ReadonlyArray<unknown>;
  className?: string;
} & ComponentPropsWithoutRef<"p">;

export function Field({ className, orientation = "vertical", ...props }: FieldProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        orientation === "horizontal" && "grid-cols-[1fr_auto] items-center gap-3",
        orientation === "responsive" && "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center",
        "data-[invalid=true]:**:data-[slot='field-control']:border-danger/70",
        className,
      )}
      {...props}
    />
  );
}

export function FieldGroup({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

export function FieldContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("grid gap-1", className)} {...props} />;
}

export function FieldSet({ className, ...props }: ComponentPropsWithoutRef<"fieldset">) {
  return <fieldset className={cn("grid gap-3", className)} {...props} />;
}

export function FieldLegend({ className, ...props }: ComponentPropsWithoutRef<"legend">) {
  return (
    <legend className={cn("text-xs font-semibold tracking-[0.02em] text-text", className)} {...props} />
  );
}

export function FieldLabel({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return <label className={cn("text-xs font-medium text-text", className)} {...props} />;
}

export function FieldTitle({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-xs font-medium text-text", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-[11px] text-muted", className)} {...props} />;
}

export function FieldError({ errors, className, ...props }: FieldErrorProps) {
  const first = errors[0];
  if (!first) return null;

  const text = typeof first === "string" ? first : first instanceof Error ? first.message : String(first);
  return (
    <p className={cn("text-[11px] text-danger", className)} {...props}>
      {text}
    </p>
  );
}

export function FieldSeparator({ className, ...props }: ComponentPropsWithoutRef<"hr">) {
  return <hr className={cn("border-0 border-b border-frosted", className)} {...props} />;
}

export function Input({ className, ...props }: FieldInputProps) {
  return (
    <BaseInput
      data-slot="field-control"
      className={cn(
        "w-full rounded-md border border-accent-border/70 bg-surface px-2 py-1.5 text-xs text-text outline-none",
        "placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: FieldTextareaProps) {
  return (
    <textarea
      data-slot="field-control"
      className={cn(
        "w-full rounded-md border border-accent-border/70 bg-surface px-2 py-1.5 text-xs text-text outline-none",
        "placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}

export const field = {
  Field,
  FieldGroup,
  FieldContent,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldError,
  FieldSeparator,
  Input,
  Textarea,
} as const;
