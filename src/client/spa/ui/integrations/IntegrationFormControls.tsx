import { Field, Select } from "@base-ui/react";
import type { ReactNode } from "react";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { cn } from "../../../lib/cn";

export type TextFieldConfig = {
  id: string;
  label: string;
  className?: string;
  type?: "text" | "password";
  autoComplete?: string;
  placeholder?: string;
  dataDiscordKey?: string;
};

export type SelectFieldConfig = {
  id: string;
  label: string;
  className?: string;
  dataDiscordKey?: string;
  options: readonly string[];
};

export type ActionKind = "primary" | "secondary";

export type ActionConfig<TAction extends string> = {
  actionId: string;
  label: string;
  kind: ActionKind;
  action: TAction;
};

const inputClass =
  "rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none";
const compactInputClass =
  "rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none";
const selectTriggerClass =
  "inline-flex w-full items-center justify-between rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none";
const selectPopupClass =
  "z-50 min-w-[var(--anchor-width)] rounded-md border border-frosted bg-background p-1 shadow-xl";
const selectItemClass =
  "cursor-pointer rounded-sm px-2 py-1 text-xs text-text data-[highlighted]:bg-frosted/50";

export function FormInput({
  config,
  value,
  onChange,
  compact = false,
}: {
  config: TextFieldConfig;
  value: string;
  onChange: (id: string, value: string) => void;
  compact?: boolean;
}) {
  return (
    <Field.Root className={config.className}>
      <Field.Label className="sr-only">{config.label}</Field.Label>
      <Input
        id={config.id}
        data-discord-key={config.dataDiscordKey}
        type={config.type ?? "text"}
        autoComplete={config.autoComplete}
        placeholder={config.placeholder}
        className={cn(compact ? compactInputClass : inputClass)}
        value={value}
        onChange={(event) => {
          onChange(config.id, event.target.value);
        }}
      />
    </Field.Root>
  );
}

export function FormSelect({
  config,
  value,
  onChange,
}: {
  config: SelectFieldConfig;
  value: string;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <Field.Root className={config.className}>
      <Field.Label className="sr-only">{config.label}</Field.Label>
      <Select.Root
        id={config.id}
        value={value}
        onValueChange={(nextValue) => {
          onChange(config.id, String(nextValue ?? ""));
        }}
      >
        <Select.Trigger data-discord-key={config.dataDiscordKey} className={cn(selectTriggerClass)}>
          <Select.Value placeholder="Unchanged" />
          <Select.Icon aria-hidden>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={4}>
            <Select.Popup className={cn(selectPopupClass)}>
              <Select.List>
                <Select.Item value="" className={cn(selectItemClass)}>
                  <Select.ItemText>Unchanged</Select.ItemText>
                </Select.Item>
                {config.options.map((option) => (
                  <Select.Item key={option} value={option} className={cn(selectItemClass)}>
                    <Select.ItemText>{option}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Field.Root>
  );
}

export function ActionButton({
  actionId,
  kind,
  disabled,
  onClick,
  children,
}: {
  actionId: string;
  kind: ActionKind;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      id={actionId}
      type="button"
      className={cn(
        "rounded-full px-3 py-2 text-xs disabled:opacity-50",
        kind === "primary" ? "bg-text text-background" : "bg-frosted text-text",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
