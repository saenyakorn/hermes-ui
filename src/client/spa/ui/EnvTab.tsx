import { z } from "zod";
import type { EnvReadResult } from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useAppForm } from "../../components/tanstack-form";
import { useEnvTab } from "../../hooks/useEnvTab";

export function EnvTab() {
  const env = useEnvTab();
  const envFormSchema = z.object({
    key: z.string(),
    value: z.string(),
  });
  const form = useAppForm({
    defaultValues: {
      key: env.key,
      value: env.value,
    },
    validators: {
      onSubmit: envFormSchema,
    },
    onSubmit: async () => {
      await env.upsert();
    },
  });
  const envFormKey = `${env.key}\u0000${env.value}`;

  return (
    <section data-tab-panel="env" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="rounded-lg border border-frosted bg-background px-3 py-2">
          <p className="text-xs uppercase text-muted">Environment Variables</p>
          <p id="env-path" className="mt-1 text-sm text-text">
            {env.path}
          </p>
          <p id="env-updated-at" className="mt-1 text-xs text-muted">
            {env.updatedAt ? `Updated ${env.updatedAt}` : "Not saved yet"}
          </p>
        </div>
        <Button
          id="env-reload"
          type="button"
          variant="secondary"
          onClick={() => void env.reload()}
        >
          Reload
        </Button>
      </div>
      <form.AppForm key={envFormKey}>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <select
          id="env-list"
          size={12}
          className="min-h-[280px] w-full rounded-lg border border-accent-border/70 bg-background p-2 text-xs text-text"
          value={env.entries.some((entry) => entry.key === env.key) ? env.key : ""}
          onChange={(event) => env.setSelectedKey(event.target.value)}
        >
          {env.entries.map((entry: EnvReadResult["entries"][number]) => (
            <option key={entry.key} value={entry.key}>
              {`${entry.key}=${entry.maskedValue}`}
            </option>
          ))}
        </select>
          <Card variant="soft" className="flex min-h-0 flex-col gap-2 p-3">
            <form.Form>
              <form.AppField name="key">
                {(field) => (
                  <field.Field>
                    <field.FieldLabel htmlFor="env-key-input">Key</field.FieldLabel>
                    <field.Input
                      id="env-key-input"
                      type="text"
                      placeholder="OPENAI_API_KEY"
                      value={field.state.value}
                      onChange={(event) => {
                        const next = event.target.value;
                        field.handleChange(next);
                        env.setKey(next);
                      }}
                    />
                  </field.Field>
                )}
              </form.AppField>
              <form.AppField name="value">
                {(field) => (
                  <field.Field className="mt-2">
                    <field.FieldLabel htmlFor="env-value-input">Value</field.FieldLabel>
                    <field.Input
                      id="env-value-input"
                      type="password"
                      placeholder="Enter value"
                      value={field.state.value}
                      onChange={(event) => {
                        const next = event.target.value;
                        field.handleChange(next);
                        env.setValue(next);
                      }}
                    />
                  </field.Field>
                )}
              </form.AppField>
              <div className="mt-3 flex flex-wrap gap-2">
                <form.SubmitButton id="env-save" variant="primary" disabled={!env.canMutate}>
                  Add / Update
                </form.SubmitButton>
                <Button
                  id="env-remove"
                  type="button"
                  variant="secondary"
                  disabled={!env.canMutate}
                  onClick={() => void env.remove()}
                >
                  Remove
                </Button>
              </div>
            </form.Form>
          </Card>
        </div>
      </form.AppForm>
      <p
        id="env-status"
        className="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {env.status}
      </p>
    </section>
  );
}
