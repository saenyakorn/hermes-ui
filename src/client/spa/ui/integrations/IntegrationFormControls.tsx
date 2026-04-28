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

const inputClass = "";
const compactInputClass = "py-1.5";
const selectTriggerClass =
  "inline-flex w-full items-center justify-between rounded-md border border-accent-border/70 bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent";
const selectPopupClass =
  "z-50 min-w-[var(--anchor-width)] rounded-md border border-accent-border/80 bg-surface p-1 shadow-xl";
const selectItemClass =
  "cursor-pointer rounded-sm px-2 py-1 text-xs text-text data-[highlighted]:bg-accent/20";

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
      <Field.Label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
        {config.label}
      </Field.Label>
      <Input
        id={config.id}
        data-discord-key={config.dataDiscordKey}
        type={config.type ?? "text"}
        autoComplete={config.autoComplete}
        placeholder={config.placeholder ?? `Enter ${config.label.toLowerCase()}`}
        className={cn(inputClass, compact && compactInputClass)}
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
      <Field.Label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
        {config.label}
      </Field.Label>
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
        "px-3 py-2 text-xs",
        kind === "primary"
          ? "border-accent bg-accent text-background"
          : "border-accent-border bg-surface text-text",
      )}
      variant={kind === "primary" ? "primary" : "secondary"}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
