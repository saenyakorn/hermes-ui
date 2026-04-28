import { Tabs } from "@base-ui/react";
import type { PropsWithChildren } from "react";
import type { TabKey } from "../../tabs";
import { cn } from "../../lib/cn";

type TabSectionProps = PropsWithChildren<{
  value: TabKey;
  className?: string;
}>;

export function TabSection({ value, className, children }: TabSectionProps) {
  return (
    <Tabs.Panel value={value} className={cn("min-h-0 min-w-0 flex-1", className)}>
      {children}
    </Tabs.Panel>
  );
}
