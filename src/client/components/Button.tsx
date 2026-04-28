import { Button as BaseButton } from "@base-ui/react";
import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { cn } from "../lib/cn";

type ButtonProps = PropsWithChildren<ComponentPropsWithoutRef<typeof BaseButton>>;

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <BaseButton className={cn(className)} {...props}>
      {children}
    </BaseButton>
  );
}
