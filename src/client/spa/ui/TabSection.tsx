import { Tabs } from "@base-ui/react";
import type { PropsWithChildren } from "react";
import type { TabKey } from "../../tabs";
import { cn } from "../../lib/cn";

type TabSectionProps = PropsWithChildren<{
  value: TabKey;
  className?: string;
  /** When true, panel content stays mounted when the tab is inactive (e.g. terminals that must not reset). */
  keepMounted?: boolean;
}>;

export function TabSection({ value, className, children, keepMounted }: TabSectionProps) {
  return (
    <Tabs.Panel
      value={value}
      keepMounted={keepMounted}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      {children}
    </Tabs.Panel>
  );
}
