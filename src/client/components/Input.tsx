import { Input as BaseInput } from "@base-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";

type InputProps = ComponentPropsWithoutRef<typeof BaseInput>;

export function Input({ className, ...props }: InputProps) {
  return <BaseInput className={cn(className)} {...props} />;
}
