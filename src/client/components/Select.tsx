import { Select as BaseSelect } from "@base-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";

type SelectRootProps = ComponentPropsWithoutRef<typeof BaseSelect.Root>;
type SelectTriggerProps = ComponentPropsWithoutRef<typeof BaseSelect.Trigger>;
type SelectValueProps = ComponentPropsWithoutRef<typeof BaseSelect.Value>;
type SelectContentProps = ComponentPropsWithoutRef<typeof BaseSelect.Popup>;
type SelectItemProps = ComponentPropsWithoutRef<typeof BaseSelect.Item>;
type SelectItemTextProps = ComponentPropsWithoutRef<typeof BaseSelect.ItemText>;
type SelectIconProps = ComponentPropsWithoutRef<typeof BaseSelect.Icon>;

export function Select({ ...props }: SelectRootProps) {
  return <BaseSelect.Root {...props} />;
}

export function SelectTrigger({ className, ...props }: SelectTriggerProps) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "inline-flex min-w-[140px] items-center justify-between rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function SelectValue({ ...props }: SelectValueProps) {
  return <BaseSelect.Value {...props} />;
}

export function SelectContent({ className, ...props }: SelectContentProps) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4}>
        <BaseSelect.Popup
          className={cn(
            "z-50 min-w-(--anchor-width) rounded-md border border-frosted bg-background p-1 shadow-xl",
            className,
          )}
          {...props}
        />
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({ className, ...props }: SelectItemProps) {
  return (
    <BaseSelect.Item
      className={cn(
        "cursor-pointer rounded-sm px-2 py-1 text-xs text-text data-highlighted:bg-frosted/50",
        className,
      )}
      {...props}
    />
  );
}

export function SelectItemText({ ...props }: SelectItemTextProps) {
  return <BaseSelect.ItemText {...props} />;
}

export function SelectIcon({ className, ...props }: SelectIconProps) {
  return <BaseSelect.Icon className={cn(className)} {...props} />;
}
