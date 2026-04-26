/** @jsxImportSource hono/jsx */

export function ModelProvidersTabPanel() {
  return (
    <section
      data-tab-panel="model-providers"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <div class="mb-6 shrink-0">
        <p class="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
          Model providers
        </p>
        <p class="mt-3 text-sm text-muted">
          API keys are written to <span class="text-text">data/.env</span>. Optional default model
          fields update <span class="text-text">data/config.yaml</span> under{" "}
          <span class="text-text">model:</span>. Secrets are never shown; leave a field empty to
          keep its current value. Saving restarts the gateway when it is running (one restart per
          save).
        </p>
        <p class="mt-2 text-xs text-muted">
          See the{" "}
          <a
            class="text-accent underline"
            href="https://hermes-agent.nousresearch.com/docs/reference/environment-variables"
            rel="noopener noreferrer"
            target="_blank"
          >
            Hermes environment variable reference
          </a>{" "}
          for details. <span class="text-text">GEMINI_API_KEY</span> is an alias for{" "}
          <span class="text-text">GOOGLE_API_KEY</span>; this UI uses{" "}
          <span class="text-text">GOOGLE_API_KEY</span>.
        </p>
        <p id="model-providers-env-hint" class="mt-2 text-xs text-muted" aria-live="polite">
          Loading…
        </p>
      </div>
      <div class="flex w-full min-w-0 flex-col gap-8">
        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Default model (config.yaml)
          </h3>
          <p class="mt-2 text-xs text-muted leading-relaxed">
            Updates the <span class="text-text">model</span> block only for fields you fill in.
            Empty fields are left unchanged on disk.
          </p>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0 sm:col-span-2">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-yaml-default">
                Default model id (model.default)
              </label>
              <input
                id="mp-yaml-default"
                type="text"
                autoComplete="off"
                placeholder="e.g. anthropic/claude-opus-4.6"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-yaml-provider">
                Provider routing (model.provider)
              </label>
              <input
                id="mp-yaml-provider"
                type="text"
                autoComplete="off"
                placeholder="e.g. auto"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-yaml-base-url">
                Base URL (model.base_url)
              </label>
              <input
                id="mp-yaml-base-url"
                type="text"
                autoComplete="off"
                placeholder="OpenAI-compatible base URL if needed"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="mp-save-yaml"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save default model
            </button>
          </div>
        </div>

        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            OpenRouter
          </h3>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-or-key">
                API key (OPENROUTER_API_KEY)
              </label>
              <input
                id="mp-or-key"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-or-base">
                Base URL (optional, OPENROUTER_BASE_URL)
              </label>
              <input
                id="mp-or-base"
                type="text"
                autoComplete="off"
                placeholder="Leave empty to keep current value"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="mp-save-or"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save OpenRouter
            </button>
            <button
              id="mp-clear-or"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear OpenRouter keys
            </button>
          </div>
        </div>

        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Claude (Anthropic)
          </h3>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-anthropic-key">
                API key (ANTHROPIC_API_KEY)
              </label>
              <input
                id="mp-anthropic-key"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="mp-save-anthropic"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save Claude
            </button>
            <button
              id="mp-clear-anthropic"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear Claude keys
            </button>
          </div>
        </div>

        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">OpenAI</h3>
          <p class="mt-2 text-xs text-muted leading-relaxed">
            For direct OpenAI or a custom OpenAI-compatible endpoint (e.g. vLLM), set{" "}
            <span class="text-text">OPENAI_BASE_URL</span> when not using the default host.
          </p>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-openai-key">
                API key (OPENAI_API_KEY)
              </label>
              <input
                id="mp-openai-key"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-openai-base">
                Base URL (optional, OPENAI_BASE_URL)
              </label>
              <input
                id="mp-openai-base"
                type="text"
                autoComplete="off"
                placeholder="Leave empty to keep current value"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="mp-save-openai"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save OpenAI
            </button>
            <button
              id="mp-clear-openai"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear OpenAI keys
            </button>
          </div>
        </div>

        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Gemini (Google AI Studio)
          </h3>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-google-key">
                API key (GOOGLE_API_KEY)
              </label>
              <input
                id="mp-google-key"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-medium text-text" for="mp-gemini-base">
                Base URL (optional, GEMINI_BASE_URL)
              </label>
              <input
                id="mp-gemini-base"
                type="text"
                autoComplete="off"
                placeholder="Leave empty to keep current value"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="mp-save-gemini"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save Gemini
            </button>
            <button
              id="mp-clear-gemini"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear Gemini keys
            </button>
          </div>
        </div>
      </div>
      <p
        id="model-providers-status"
        class="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        Ready.
      </p>
    </section>
  );
}
